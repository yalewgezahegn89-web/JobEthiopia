import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { revokeSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";

export async function GET(request: Request) {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";

  if (rawToken) {
    const userId = await revokeSession(rawToken);
    if (userId) {
      await writeAuditLog({
        actorUserId: userId,
        action: "LOGOUT",
        targetType: "user",
        targetId: userId,
      });
    }
  }

  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}