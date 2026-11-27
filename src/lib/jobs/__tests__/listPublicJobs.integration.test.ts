import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { jobs } from "@/db/schema/jobs";
import { organizations } from "@/db/schema/organizations";
import { buildJobListOrder } from "@/lib/search/jobSearch";
import type { JobListQuery } from "@/lib/validations/jobQuery";

vi.mock("@/lib/analytics/events", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/analytics/events")>();
  return {
    ...actual,
    trackDiscoveryEvent: vi.fn(async () => undefined),
  };
});

const STAGING_HOST = "ep-billowing-unit-a6psoh1y.us-west-2.aws.neon.tech";
const STAGING_DATABASE = "neondb";

function readStagingDatabaseUrl(): string | null {
  const envPath = path.join(process.cwd(), ".env.staging.local");
  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
  if (!line) {
    return null;
  }

  let value = line.replace(/^\s*DATABASE_URL\s*=\s*/, "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || null;
}

function assertStagingTarget(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (parsed.hostname !== STAGING_HOST || databaseName !== STAGING_DATABASE) {
    throw new Error(
      "Refusing to run integration tests: .env.staging.local does not target the approved staging database.",
    );
  }
}

const stagingDatabaseUrl = readStagingDatabaseUrl();
const describeIntegration = stagingDatabaseUrl ? describe : describe.skip;

type DbModule = typeof import("@/db");
type ListModule = typeof import("@/lib/jobs/listPublicJobs");
type RouteModule = typeof import("@/app/api/jobs/route");

let db: DbModule["db"];
let listPublicJobs: ListModule["listPublicJobs"];
let GET: RouteModule["GET"];
let trgmAvailable = false;

beforeAll(async () => {
  if (!stagingDatabaseUrl) {
    return;
  }

  assertStagingTarget(stagingDatabaseUrl);
  process.env.DATABASE_URL = stagingDatabaseUrl;
  delete process.env.DISABLE_PG_TRGM;

  const dbModule = await import("@/db");
  db = dbModule.db;

  const listModule = await import("@/lib/jobs/listPublicJobs");
  listPublicJobs = listModule.listPublicJobs;

  const trgmModule = await import("@/lib/search/trgm");
  trgmModule.resetTrgmAvailabilityForTests();
  trgmAvailable = await trgmModule.isPgTrgmAvailable();

  const routeModule = await import("@/app/api/jobs/route");
  GET = routeModule.GET;
}, 60_000);

afterAll(async () => {
  if (!db) {
    return;
  }

  const client = (
    db as unknown as { $client?: { end: () => Promise<void> } }
  ).$client;
  await client?.end();
  delete process.env.DATABASE_URL;
}, 30_000);

async function executeRelevanceOrder(input: {
  q: string;
  organizationIds: string[];
  trgm: boolean;
}): Promise<void> {
  const order = buildJobListOrder("relevance", input);
  await db.select({ id: jobs.id }).from(jobs).orderBy(...order).limit(1);
}

async function sampleOrganizationIds(): Promise<string[]> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .limit(1);
  return rows.length > 0 ? [rows[0].id] : [randomUUID()];
}

describeIntegration("relevance SQL against staging PostgreSQL", () => {
  it("executes substring-tier relevance with empty organization ids", async () => {
    await executeRelevanceOrder({
      q: "a",
      organizationIds: [],
      trgm: false,
    });
  }, 30_000);

  it("executes substring-tier relevance with non-empty organization ids", async () => {
    await executeRelevanceOrder({
      q: "a",
      organizationIds: await sampleOrganizationIds(),
      trgm: false,
    });
  }, 30_000);

  it("parameterizes organization ids and uses decimal ELSE weights", async () => {
    const dialect = new PgDialect();
    const order = buildJobListOrder("relevance", {
      q: "a",
      organizationIds: [randomUUID()],
      trgm: false,
    });
    const rendered = order
      .map((fragment) => dialect.sqlToQuery(fragment).sql)
      .join(", ");

    expect(rendered).toMatch(/ANY\(\$\d+\)/);
    expect(rendered).not.toContain("ANY((");
    expect(rendered).toContain("ELSE 0.0");
    expect(rendered).not.toMatch(/ELSE 0(?!\.)/);
  }, 30_000);

  it("executes trgm-tier relevance when pg_trgm is available", async () => {
    if (!trgmAvailable) {
      return;
    }

    await executeRelevanceOrder({
      q: "a",
      organizationIds: [],
      trgm: true,
    });
    await executeRelevanceOrder({
      q: "a",
      organizationIds: await sampleOrganizationIds(),
      trgm: true,
    });
  }, 30_000);

  it("executes the shared listing path for q=a&sort=relevance", async () => {
    const query: JobListQuery = {
      page: 1,
      limit: 20,
      q: "a",
      sort: "relevance",
    };
    const result = await listPublicJobs(query);

    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.pagination.total).toBe("number");
  }, 30_000);

  it("returns HTTP 200 with an empty result when zero eligible jobs match", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/jobs?q=a&sort=relevance&organizationId=${randomUUID()}`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: unknown[];
      pagination: { total: number };
    };
    expect(body.items).toEqual([]);
    expect(body.pagination.total).toBe(0);
  }, 30_000);
});
