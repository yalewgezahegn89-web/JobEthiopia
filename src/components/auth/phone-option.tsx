import Link from "next/link";

interface PhoneOptionProps {
  actionLabel: string;
}

/**
 * Polished "continue / sign up with phone" secondary option used on the login
 * and register pages. It is purely presentational and navigates to the shared
 * /phone flow (which already handles both existing-phone sign-in and new
 * candidate account creation). Styling matches the UI button/link language.
 */
export function PhoneOption({ actionLabel }: PhoneOptionProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
        <span>OR</span>
        <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
      </div>
      <Link
        href="/phone"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:border-border hover:bg-surface-raised hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {actionLabel}
      </Link>
      <p className="text-center text-xs text-muted">
        Use your Ethiopian mobile number instead.
      </p>
    </div>
  );
}
