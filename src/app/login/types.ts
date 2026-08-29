export interface LoginActionState {
  error: string | null;
}

export const LOGIN_ERROR_GENERIC = "Invalid email or password";
export const LOGIN_ERROR_SERVER = "Unable to sign in. Please try again.";