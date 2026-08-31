export interface RegisterActionState {
  fieldErrors?: Record<string, string>;
  error?: string | null;
}

export const REGISTER_ERROR_NEUTRAL =
  "Unable to create the account. Please try again.";
