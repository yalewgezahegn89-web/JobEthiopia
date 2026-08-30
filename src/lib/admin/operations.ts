import { desc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema/auditLog";
import { sources } from "@/db/schema/sources";

const RECENT_LIMIT = 20;

export type MaintenanceRunSummary = {
  timestamp: string;
  expiredJobs: number;
  sourcesChecked: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  sourcesSkipped: number;
  durationMs: number | null;
};

export type IngestionBatchSummary = {
  timestamp: string;
  sourceId: string;
  sourceName: string | null;
  total: number | null;
  created: number;
  updated: number;
  duplicate: number;
  linked: number | null;
  possibleDuplicate: number | null;
  failed: number;
  durationMs: number | null;
};

export type FailingSource = {
  id: string;
  name: string;
  lastError: string | null;
  consecutiveFailures: number;
  lastAttemptedCheck: string | null;
  lastSuccessfulCheck: string | null;
};

export type OperationsSummary = {
  latestMaintenance: MaintenanceRunSummary | null;
  recentMaintenance: MaintenanceRunSummary[];
  latestIngestion: IngestionBatchSummary | null;
  recentIngestion: IngestionBatchSummary[];
  failingSources: FailingSource[];
};

function toMaintenanceSummary(row: {
  metadata: unknown;
  createdAt: Date;
}): MaintenanceRunSummary {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    timestamp: row.createdAt.toISOString(),
    expiredJobs: Number(meta.expiredJobs ?? 0),
    sourcesChecked: Number(meta.sourcesChecked ?? 0),
    sourcesSucceeded: Number(meta.sourcesSucceeded ?? 0),
    sourcesFailed: Number(meta.sourcesFailed ?? 0),
    sourcesSkipped: Number(meta.sourcesSkipped ?? 0),
    durationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
  };
}

function toIngestionSummary(
  row: { metadata: unknown; createdAt: Date; targetId: string | null },
  sourceNameMap: Map<string, string>,
): IngestionBatchSummary {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const sourceId = row.targetId ?? "";
  return {
    timestamp: row.createdAt.toISOString(),
    sourceId,
    sourceName: sourceNameMap.get(sourceId) ?? null,
    total: typeof meta.total === "number" ? meta.total : null,
    created: Number(meta.created ?? 0),
    updated: Number(meta.updated ?? 0),
    duplicate: Number(meta.duplicate ?? 0),
    linked: typeof meta.linked === "number" ? meta.linked : null,
    possibleDuplicate:
      typeof meta.possibleDuplicate === "number" ? meta.possibleDuplicate : null,
    failed: Number(meta.failed ?? 0),
    durationMs: typeof meta.durationMs === "number" ? meta.durationMs : null,
  };
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const [maintenanceRows, ingestionRows, failingSources] = await Promise.all([
    db.query.auditLog.findMany({
      where: eq(auditLog.action, "MAINTENANCE_RUN"),
      orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
      limit: RECENT_LIMIT,
      columns: { metadata: true, createdAt: true },
    }),
    db.query.auditLog.findMany({
      where: eq(auditLog.action, "JOB_INGESTED"),
      orderBy: [desc(auditLog.createdAt), desc(auditLog.id)],
      limit: RECENT_LIMIT,
      columns: { metadata: true, createdAt: true, targetId: true },
    }),
    db.query.sources.findMany({
      where: or(
        gt(sources.consecutiveFailures, 0),
        sql`${sources.lastError} IS NOT NULL`,
      ),
      orderBy: [
        desc(sources.consecutiveFailures),
        desc(sources.lastAttemptedCheck),
      ],
      limit: RECENT_LIMIT,
      columns: {
        id: true,
        name: true,
        lastError: true,
        consecutiveFailures: true,
        lastAttemptedCheck: true,
        lastSuccessfulCheck: true,
      },
    }),
  ]);

  const sourceIds = Array.from(
    new Set(
      ingestionRows
        .map((r) => r.targetId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let sourceNameMap = new Map<string, string>();
  if (sourceIds.length > 0) {
    const found = await db
      .select({ id: sources.id, name: sources.name })
      .from(sources)
      .where(
        sql`${sources.id} IN (${sql.join(
          sourceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    sourceNameMap = new Map(found.map((s) => [s.id, s.name]));
  }

  const recentMaintenance = maintenanceRows.map(toMaintenanceSummary);
  const recentIngestion = ingestionRows.map((r) =>
    toIngestionSummary(r, sourceNameMap),
  );

  return {
    latestMaintenance: recentMaintenance[0] ?? null,
    recentMaintenance,
    latestIngestion: recentIngestion[0] ?? null,
    recentIngestion,
    failingSources: failingSources.map((s) => ({
      id: s.id,
      name: s.name,
      lastError: s.lastError,
      consecutiveFailures: s.consecutiveFailures,
      lastAttemptedCheck: s.lastAttemptedCheck?.toISOString() ?? null,
      lastSuccessfulCheck: s.lastSuccessfulCheck?.toISOString() ?? null,
    })),
  };
}
