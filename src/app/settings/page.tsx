import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { sessions } from "@/db/schema/sessions";
import { getCurrentUser } from "@/lib/auth/context";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { hashSessionToken, listSessionsForUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { ChangeEmailForm } from "./change-email-form";
import { SettingsPasswordForm } from "./password-form";
import { ResendVerificationForm } from "./resend-verification-form";
import { SessionsManager } from "./sessions-manager";
import type { SettingsSession } from "./sessions-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings | JobEthiopia",
  description: "Manage your account, email, password, and active sessions.",
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getI18n();

  let emailVerifiedAt: Date | null = null;
  let isActive = true;
  let hasPassword = false;
  let loadError = false;
  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        emailVerifiedAt: true,
        isActive: true,
        passwordHash: true,
      },
    });
    emailVerifiedAt = row?.emailVerifiedAt ?? null;
    isActive = row?.isActive ?? true;
    hasPassword = Boolean(row?.passwordHash);
  } catch {
    loadError = true;
  }

  let activeSessions: SettingsSession[] = [];
  let currentSessionId = "";
  try {
    const store = await cookies();
    const rawToken = store.get(SESSION_COOKIE_NAME)?.value ?? "";
    const tokenHash = rawToken ? hashSessionToken(rawToken) : "";
    if (tokenHash) {
      const current = await db.query.sessions.findFirst({
        where: eq(sessions.tokenHash, tokenHash),
        columns: { id: true },
      });
      currentSessionId = current?.id ?? "";
    }
    const rows = await listSessionsForUser(user.id);
    activeSessions = rows.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
      expiresAt: s.expiresAt.toISOString(),
    }));
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
        <p role="status" className="text-muted">
          {t.settings.errorLoad}
        </p>
      </div>
    );
  }

  const emailKnown = Boolean(user.email);
  const emailVerified = emailKnown && Boolean(emailVerifiedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          {t.settings.heading}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t.nav.settings}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          {t.settings.subtitle}
        </p>
      </header>

      <section
        aria-labelledby="account-heading"
        className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6">
          <h2 id="account-heading" className="text-xl font-bold tracking-tight text-foreground">
            {t.settings.accountHeading}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.settings.accountSubtitle}</p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
              {initials(user.name)}
            </span>
            <dl className="min-w-0 space-y-1">
              <div>
                <dt className="inline text-sm font-semibold text-foreground">
                  {t.settings.nameLabel}:
                </dt>
                <dd className="inline text-sm text-muted"> {user.name}</dd>
              </div>
              <div>
                <dt className="inline text-sm font-semibold text-foreground">
                  {t.settings.emailLabel}:
                </dt>
                <dd className="inline text-sm text-muted">
                  {" "}
                  {user.email ?? t.settings.noEmail}
                </dd>
              </div>
              <div>
                <dt className="inline text-sm font-semibold text-foreground">
                  {t.settings.accountStatusLabel}:
                </dt>
                <dd className="inline text-sm text-muted">
                  {" "}
                  {isActive ? t.settings.accountActive : t.settings.accountInactive}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                emailVerified
                  ? "bg-primary-light text-primary"
                  : "bg-surface-raised text-muted"
              }`}
            >
              {emailVerified
                ? t.settings.emailVerified
                : t.settings.emailUnverified}
            </span>
          </div>
        </div>
      </section>

      {emailKnown && !emailVerified ? (
        <section
          aria-labelledby="email-verification-heading"
          className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
          <div className="p-6">
            <h2
              id="email-verification-heading"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              {t.settings.emailVerificationHeading}
            </h2>
            <div className="mt-3">
              <ResendVerificationForm t={t} />
            </div>
          </div>
        </section>
      ) : null}

      {emailKnown ? (
        <section
          aria-labelledby="change-email-heading"
          className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
          <div className="p-6">
            <h2
              id="change-email-heading"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              {t.settings.changeEmailHeading}
            </h2>
            <div className="mt-4">
              <ChangeEmailForm t={t} />
            </div>
          </div>
        </section>
      ) : null}

      {hasPassword ? (
        <section
          aria-labelledby="password-heading"
          className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
          <div className="p-6">
            <h2
              id="password-heading"
              className="text-xl font-bold tracking-tight text-foreground"
            >
              {t.settings.passwordHeading}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.settings.passwordSubtitle}</p>
            <div className="mt-4">
              <SettingsPasswordForm t={t} />
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="sessions-heading"
        className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
        <div className="p-6">
          <h2
            id="sessions-heading"
            className="text-xl font-bold tracking-tight text-foreground"
          >
            {t.settings.sessionsHeading}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.settings.sessionsSubtitle}</p>
          <div className="mt-4">
            <SessionsManager
              sessions={activeSessions}
              currentSessionId={currentSessionId}
              t={t}
            />
          </div>
        </div>
      </section>
    </div>
  );
}