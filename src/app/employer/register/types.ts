export interface EmployerOnboardingActionState {
  fieldErrors?: Record<string, string>;
  error?: string | null;
}

export const EMPLOYER_ONBOARDING_ERROR_NEUTRAL =
  "Unable to submit your employer request. Please try again.";
