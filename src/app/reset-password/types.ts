export interface ResetPasswordActionState {
  error: string | null;
}

export const RESET_ERROR_INVALID = "This reset link is invalid or has expired.";
export const RESET_ERROR_WEAK = "Password must be at least 8 characters.";
export const RESET_ERROR_SERVER = "Something went wrong. Please try again.";
