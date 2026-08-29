import { NextResponse } from "next/server";
import { desc, eq, and, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { isSourceDueForCheck } from "@/lib/sources/health";
import { dueListQuerySchema } from "@/lib/validations/sourceQuery";
import { checkApiKey } from "@/lib/auth/apiKey";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const keyCheck = checkApiKey(request);
  if (!keyCheck.ok) return jsonError(keyCheck.message, keyCheck.status);

  const { searchParams } = new URL(request.url);

  const parsed = dueListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    sourceType: searchParams.get("sourceType") ?? undefined,
    maxConsecutiveFailures:
      searchParams.get("maxConsecutiveFailures") ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  const { page, limit, sourceType, maxConsecutiveFailures } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [eq(sources.isActive, true)];
    if (sourceType) {
      conditions.push(eq(sources.sourceType, sourceType));
    }
    if (maxConsecutiveFailures !== undefined) {
      conditions.push(
        sql`consecutive_failures >= ${maxConsecutiveFailures}`,
      );
    }

    const where = and(...conditions);

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(sources)
        .where(where),
      db
        .select({
          id: sources.id,
          name: sources.name,
          sourceType: sources.sourceType,
          baseUrl: sources.baseUrl,
          consecutiveFailures: sources.consecutiveFailures,
          lastSuccessfulCheck: sources.lastSuccessfulCheck,
          checkFrequencyMinutes: sources.checkFrequencyMinutes,
        })
        .from(sources)
        .where(where)
        .orderBy(
          asc(sources.lastSuccessfulCheck),
          desc(sources.consecutiveFailures),
        )
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    const items = await Promise.all(
      rows.map(async (row) => {
        const isDue = await isSourceDueForCheck(row.id);
        const neverChecked = row.lastSuccessfulCheck === null;
        const noFrequency = row.checkFrequencyMinutes === null;

        let urgency: string;
        if (!isDue) {
          urgency = "current";
        } else if (neverChecked || noFrequency) {
          urgency = "overdue";
        } else {
          urgency = "due";
        }

        return {
          id: row.id,
          name: row.name,
          sourceType: row.sourceType,
          baseUrl: row.baseUrl,
          consecutiveFailures: row.consecutiveFailures,
          isDue,
          urgency,
        };
      }),
    );

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
