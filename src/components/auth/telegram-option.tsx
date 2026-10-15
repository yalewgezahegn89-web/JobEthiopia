import Link from "next/link";
import { getCurrentLocale } from "@/lib/i18n/server";

const COPY = {
  en: {
    divider: "OR",
    button: "Continue with Telegram",
    hint: "Sign in securely with your Telegram account.",
    error: "Telegram sign-in could not be completed. Please try again or use email and password.",
  },
  am: {
    divider: "ወይም",
    button: "በቴሌግራም ይግቡ",
    hint: "የቴሌግራም መለያዎን በመጠቀም በደህንነት ይግቡ።",
    error: "በቴሌግራም መግባት አልተሳካም። እንደገና ይሞክሩ ወይም በኢሜይል ይግቡ።",
  },
  om: {
    divider: "YKN",
    button: "Telegramiin seeni",
    hint: "Herrega Telegram kee fayyadamuun nagaadhaan seeni.",
    error: "Telegramiin seenuun hin milkoofne. Irra deebi'ii yaali yookaan imeelii fi jecha icciitii fayyadami.",
  },
} as const;

/** Shared Telegram OIDC sign-in / sign-up entry point, localized by the current route. */
export async function TelegramOption({ showError = false }: { showError?: boolean }) {
  const locale = await getCurrentLocale();
  const copy = COPY[locale];
  const configured = Boolean(
    process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET,
  );

  // Do not advertise a login method before BotFather credentials are configured.
  // If a user returns from a stale/manual attempt, still show a localized error.
  if (!configured && !showError) return null;

  return (
    <div className="mt-5 space-y-3">
      {configured ? (
        <>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border-subtle" />
            <span className="text-xs font-semibold tracking-wider text-subtle">{copy.divider}</span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>
          <Link
            href={`/api/auth/telegram/start?locale=${locale}`}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#229ED9] bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:border-[#168AC0] hover:bg-[#168AC0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#229ED9]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
            >
              <path d="M21.8 3.2 18.7 20c-.23 1.19-.86 1.48-1.75.92l-4.84-3.57-2.34 2.25c-.26.26-.48.48-.98.48l.35-4.92 8.96-8.1c.39-.35-.08-.55-.6-.2L6.43 13.83l-4.75-1.49c-1.03-.32-1.05-1.03.22-1.53L20.47 3.3c.86-.32 1.61.2 1.33-.1Z" />
            </svg>
            {copy.button}
          </Link>
          <p className="text-center text-xs leading-5 text-muted">{copy.hint}</p>
        </>
      ) : null}
      {showError ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {copy.error}
        </p>
      ) : null}
    </div>
  );
}
