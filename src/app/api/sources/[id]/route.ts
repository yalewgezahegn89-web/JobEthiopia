import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources } from "@/db/schema/sources";
import { sourceIdParamSchema } from "@/lib/validations/sourceParams";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const parsed = sourceIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return jsonError("Invalid source ID", 400);
  }

  try {
    const source = await db.query.sources.findFirst({
      where: eq(sources.id, parsed.data.id),
      columns: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        isActive: true,
        trustLevel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!source) {
      return jsonError("Source not found", 404);
    }

    return NextResponse.json({ item: source });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
