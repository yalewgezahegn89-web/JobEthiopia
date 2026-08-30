"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { assertTrustedCsrfFromRequest, getAppBaseUrl } from "@/lib/auth/csrf";
import { normalizeEmail } from "@/lib/auth/login";
import {
  forgotPasswordRateLimited,
  requestPasswordReset,
  equalizeUnknownEmailWork,
} from "@/lib/auth/resetPassword";
import { dispatchPasswordResetEmail } from "@/lib/email";
import { FORGOT_MESSAGE, FORGOT_ERROR_SERVER } from "./types";
import type { ForgotPasswordActionState } from "./types";

const initialState: ForgotPasswordActionState = { error: null, success: false };

export async function forgotPasswordAction(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  try {
    await assertTrustedCsrfFromRequest();
  } catch {
    return { error: FORGOT_MESSAGE, success: true };
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) {
    return { ...initialState, error: FORGOT_ERROR_SERVER };
  }

  if (!forgotPasswordRateLimited(email)) {
    return { error: FORGOT_MESSAGE, success: true };
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, isActive: true },
    });

    if (user && user.isActive) {
      const token = await requestPasswordReset(user.id);
      if (token) {
        const resetUrl = `${getAppBaseUrl()}/reset-password?token=${token.rawToken}`;
        await dispatchPasswordResetEmail(token.email, resetUrl);
      }
    } else {
      await equalizeUnknownEmailWork();
    }

    return { error: FORGOT_MESSAGE, success: true };
  } catch {
    return { ...initialState, error: FORGOT_ERROR_SERVER };
  }
}
