"use client";

import { useActionState } from "react";
import { revokeOtherSessionsAction, revokeSessionAction } from "./actions";
import type { SettingsActionResult } from "./types";
import type { Dictionary } from "@/lib/i18n/dictionary";

export type SettingsSession = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function SessionRow({
  session,
  isCurrent,
  t,
}: {
  session: SettingsSession;
  isCurrent: boolean;
  t: Dictionary;
}) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionResult,
    FormData
  >(revokeSessionAction, {});

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {isCurrent ? t.settings.sessionsCurrent : t.settings.sessionOther}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted">
          {t.settings.sessionsLastUsed}: {formatDate(session.lastUsedAt)} ·{" "}
          {t.settings.sessionsExpires}: {formatDate(session.expiresAt)}
        </p>
        {state?.ok ? (
          <p role="status" className="mt-1 text-xs font-medium text-success">
            {t.settings.sessionRevoked}
          </p>
        ) : state?.code ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {t.settings.sessionRevokeError}
          </p>
        ) : null}
      </div>

      {isCurrent ? (
        <span className="inline-flex items-center rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
          {t.settings.sessionsCurrent}
        </span>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="sessionId" value={session.id} />
          <button
            type="submit"
            disabled={isPending || !!state?.ok}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? t.settings.sessionsRevoking : t.settings.sessionsRevoke}
          </button>
        </form>
      )}
    </li>
  );
}

export function SessionsManager({
  sessions,
  currentSessionId,
  t,
}: {
  sessions: SettingsSession[];
  currentSessionId: string;
  t: Dictionary;
}) {
  const [otherState, otherFormAction, otherPending] = useActionState<
    SettingsActionResult,
    FormData
  >(revokeOtherSessionsAction, {});

  const hasOtherSessions = sessions.some((s) => s.id !== currentSessionId);

  return (
    <div className="space-y-4">
      <form action={otherFormAction}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm leading-6 text-muted">
              {t.settings.sessionsRevokeOtherSub}
            </p>
            {otherState?.ok ? (
              <p role="status" className="mt-1 text-sm font-medium text-success">
                {t.settings.sessionsSignedOutAll}
              </p>
            ) : otherState?.code ? (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {t.settings.sessionsRevokeOtherError}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={otherPending || !hasOtherSessions}
            className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {otherPending
              ? t.settings.sessionsRevokeOtherPending
              : t.settings.sessionsRevokeOther}
          </button>
        </div>
      </form>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted">{t.settings.sessionsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isCurrent={session.id === currentSessionId}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
}