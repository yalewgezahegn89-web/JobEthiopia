"use server";

import { redirect } from "next/navigation";
import { assertTrustedCsrfFromRequest } from "@/lib/auth/csrf";
import {
  resetAttemptRateLimited,
  findValidPasswordResetToken,
  resetPasswordWithToken,
} from "@/lib/auth/resetPassword";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  RESET_ERROR_INVALID,
  RESET_ERROR_WEAK,
  RESET_ERROR_SERVER,
} from "./types";
import type { ResetPasswordActionState } from "./types";

export interface ResetPasswordFormValues {
  rawToken: string;
  newPassword: string;
}

export async function resetPasswordAction(
  _previousState: ResetPasswordActionState,
  formData: FormData,
): Promise<ResetPasswordActionState> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { error: RESET_ERROR_INVALID };
  }

  const rawToken = String(formData.get("token") ?? "").trim();
  const newPassword = String(formData.get("password") ?? "");

  if (!rawToken) {
    return { error: RESET_ERROR_INVALID };
  }

  if (!resetAttemptRateLimited(rawToken)) {
    return { error: RESET_ERROR_INVALID };
  }

  const valid = await findValidPasswordResetToken(rawToken).catch(() => null);
  if (!valid) {
    return { error: RESET_ERROR_INVALID };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: RESET_ERROR_WEAK };
  }

  const result = await resetPasswordWithToken(rawToken, newPassword).catch(() => null);
  if (!result || !result.ok) {
    return { error: RESET_ERROR_SERVER };
  }

  redirect("/login");
}
