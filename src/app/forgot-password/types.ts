export interface ForgotPasswordActionState {
  error: string | null;
  success: boolean;
}

export const FORGOT_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";
export const FORGOT_ERROR_SERVER = "Unable to process your request. Please try again.";
