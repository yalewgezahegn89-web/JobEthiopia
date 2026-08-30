import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySession, hashSessionToken } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/password";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
  if (!rawToken) {
    return jsonError("Unauthorized", 401);
  }

  const user = await verifySession(rawToken);
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const tokenHash = hashSessionToken(rawToken);
  const currentSessionId = await resolveSessionId(tokenHash);
  if (!currentSessionId) {
    return jsonError("Unauthorized", 401);
  }

  const result = await changePassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    currentSessionId,
  );

  if (!result.ok) {
    if (result.reason === "invalid_current") {
      return jsonError("Invalid current password", 401);
    }
    if (result.reason === "weak_new") {
      return jsonError("New password must be at least 8 characters", 400);
    }
    return jsonError("Internal server error", 500);
  }

  return NextResponse.json({ success: true });
}

async function resolveSessionId(tokenHash: string): Promise<string | null> {
  const { db } = await import("@/db");
  const { sessions } = await import("@/db/schema/sessions");
  const { eq } = await import("drizzle-orm");

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, tokenHash),
    columns: { id: true },
  });

  return session?.id ?? null;
}
