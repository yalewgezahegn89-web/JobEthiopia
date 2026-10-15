"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import {
  saveCoverLetterAction,
  type CoverLetterActionResult,
} from "@/app/cover-letter/actions";
import {
  COVER_LETTER_TITLE_MAX,
  COVER_LETTER_FIELD_MAX,
  COVER_LETTER_BODY_MAX,
} from "@/lib/validations/coverLetter";

export type CoverLetterPrefill = {
  jobId: string;
  position: string;
  employer: string;
  location: string | null;
};

export type CoverLetterFormProps = {
  existing?: {
    id: string;
    jobId: string | null;
    title: string;
    position: string;
    employer: string;
    recipient: string | null;
    location: string | null;
    body: string;
  } | null;
  prefill?: CoverLetterPrefill | null;
};

const INITIAL_STATE: CoverLetterActionResult = { ok: false };

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "block text-sm font-medium text-foreground";

export function CoverLetterForm({ existing, prefill }: CoverLetterFormProps) {
  const { t } = useI18n();
  const f = t.coverLetter.form;

  const [state, formAction, isPending] = useActionState<
    CoverLetterActionResult,
    FormData
  >(saveCoverLetterAction, INITIAL_STATE);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [position, setPosition] = useState(
    existing?.position ?? prefill?.position ?? "",
  );
  const [employer, setEmployer] = useState(
    existing?.employer ?? prefill?.employer ?? "",
  );
  const [recipient, setRecipient] = useState(existing?.recipient ?? "");
  const [location, setLocation] = useState(
    existing?.location ?? prefill?.location ?? "",
  );
  const [body, setBody] = useState(existing?.body ?? "");

  const jobId = existing?.jobId ?? prefill?.jobId ?? "";

  const payload = JSON.stringify({
    id: existing?.id ?? "",
    jobId,
    title,
    position,
    employer,
    recipient,
    location,
    body,
  });

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="data" value={payload} />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="cl-title" className={labelClass}>
            {f.titleLabel}
          </label>
          <input
            id="cl-title"
            type="text"
            value={title}
            maxLength={COVER_LETTER_TITLE_MAX}
            placeholder={f.titlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cl-position" className={labelClass}>
            {f.positionLabel}
          </label>
          <input
            id="cl-position"
            type="text"
            value={position}
            maxLength={COVER_LETTER_FIELD_MAX}
            placeholder={f.positionPlaceholder}
            onChange={(e) => setPosition(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cl-employer" className={labelClass}>
            {f.employerLabel}
          </label>
          <input
            id="cl-employer"
            type="text"
            value={employer}
            maxLength={COVER_LETTER_FIELD_MAX}
            placeholder={f.employerPlaceholder}
            onChange={(e) => setEmployer(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cl-recipient" className={labelClass}>
            {f.recipientLabel}
          </label>
          <input
            id="cl-recipient"
            type="text"
            value={recipient}
            maxLength={COVER_LETTER_FIELD_MAX}
            placeholder={f.recipientPlaceholder}
            onChange={(e) => setRecipient(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cl-location" className={labelClass}>
            {f.locationLabel}
          </label>
          <input
            id="cl-location"
            type="text"
            value={location}
            maxLength={COVER_LETTER_FIELD_MAX}
            placeholder={f.locationPlaceholder}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cl-body" className={labelClass}>
            {f.bodyLabel}
          </label>
          <textarea
            id="cl-body"
            rows={12}
            value={body}
            maxLength={COVER_LETTER_BODY_MAX}
            placeholder={f.bodyPlaceholder}
            onChange={(e) => setBody(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-subtle">{f.privateHint}</p>
        </div>
      </section>

      {prefill ? (
        <p className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-muted">
          {t.coverLetter.prefillHint}
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t.coverLetter.messages.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="focus-visible:outline-2 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? f.saving : f.save}
        </button>
        <a
          href={existing ? `/cover-letter/${existing.id}` : "/cover-letter"}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.common.cancel}
        </a>
      </div>
    </form>
  );
}