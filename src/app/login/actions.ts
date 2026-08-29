"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginUser } from "@/lib/auth/login";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/constants";
import { LOGIN_ERROR_GENERIC, LOGIN_ERROR_SERVER } from "./types";
import type { LoginActionState } from "./types";

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { error: LOGIN_ERROR_GENERIC };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = await loginUser(email, password).catch(() => null);
  if (!result) {
    return { error: LOGIN_ERROR_SERVER };
  }
  if (!result.ok) {
    return { error: LOGIN_ERROR_GENERIC };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, result.rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  redirect("/admin");
}
