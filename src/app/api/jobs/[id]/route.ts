import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema/jobs";
import { jobIdParamSchema } from "@/lib/validations/jobQuery";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = jobIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return jsonError(`${path}${issue.message}`, 400);
  }

  try {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, parsed.data.id),
    });

    if (!job) {
      return jsonError("Job not found", 404);
    }

    return NextResponse.json({ item: job });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
