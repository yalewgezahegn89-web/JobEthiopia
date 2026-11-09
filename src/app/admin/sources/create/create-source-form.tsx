"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSourceAction, type SourceActionResult } from "../actions";

const INITIAL_STATE: SourceActionResult = { ok: false };

const SOURCE_TYPES = [
  "MANUAL",
  "WEBSITE",
  "API",
  "FEED",
  "EMPLOYER",
  "OTHER",
  "FACEBOOK",
];
const TRUST_LEVELS = ["HIGH", "MEDIUM", "LOW"];

export default function CreateSourceForm() {
  const [createState, createFormAction, createPending] = useActionState<
    SourceActionResult,
    FormData
  >(createSourceAction, INITIAL_STATE);

  if (createState.ok) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-success-light p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-success">Source created</h2>
        <p className="mt-2 text-sm text-muted">
          The source was created successfully.
        </p>
        <Link
          href="/admin/sources"
          className="mt-3 inline-block text-sm font-medium text-success hover:text-primary"
        >
          &larr; Back to sources
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New source</h2>
      <form action={createFormAction} className="mt-4 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="e.g. Ethiopian Reporter"
          />
        </div>

        <div>
          <label htmlFor="sourceType" className="block text-sm font-medium text-foreground">
            Source type
          </label>
          <select
            id="sourceType"
            name="sourceType"
            required
            defaultValue=""
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <option value="" disabled>
              Select a source type
            </option>
            {SOURCE_TYPES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="baseUrl" className="block text-sm font-medium text-foreground">
            Base URL
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="url"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="https://example.com"
          />
        </div>

        <fieldset className="rounded-lg border border-border bg-surface-raised p-4">
          <legend className="px-1 text-sm font-medium text-foreground">
            Facebook Page (only for FACEBOOK sources)
          </legend>
          <p className="mt-1 text-xs text-muted">
            Tokens are never stored here. Owned Pages use a server-side Page
            access token; external Pages stay blocked until Meta approval and
            content-use authorization are both recorded.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="facebookPageId" className="block text-sm font-medium text-foreground">
                Facebook Page ID
              </label>
              <input
                id="facebookPageId"
                name="facebookPageId"
                type="text"
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="e.g. 123456789012345"
              />
            </div>
            <div>
              <label htmlFor="facebookPageKind" className="block text-sm font-medium text-foreground">
                Page kind
              </label>
              <select
                id="facebookPageKind"
                name="facebookPageKind"
                defaultValue=""
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="">Not a Facebook source</option>
                <option value="OWNED_PAGE">OWNED_PAGE</option>
                <option value="EXTERNAL_PAGE">EXTERNAL_PAGE</option>
              </select>
            </div>
            <div>
              <label htmlFor="facebookApprovalState" className="block text-sm font-medium text-foreground">
                Meta Page Public Content Access
              </label>
              <select
                id="facebookApprovalState"
                name="facebookApprovalState"
                defaultValue="NOT_REQUESTED"
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="NOT_REQUESTED">NOT_REQUESTED</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label htmlFor="facebookContentUseState" className="block text-sm font-medium text-foreground">
                Content-use authorization
              </label>
              <select
                id="facebookContentUseState"
                name="facebookContentUseState"
                defaultValue="NOT_RECORDED"
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <option value="NOT_RECORDED">NOT_RECORDED</option>
                <option value="PENDING">PENDING</option>
                <option value="AUTHORIZED">AUTHORIZED</option>
                <option value="DENIED">DENIED</option>
              </select>
            </div>
            <div>
              <label htmlFor="facebookAuthorizationNote" className="block text-sm font-medium text-foreground">
                Authorization note
              </label>
              <textarea
                id="facebookAuthorizationNote"
                name="facebookAuthorizationNote"
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                placeholder="Reference for written Page-owner permission (do not paste secrets)"
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="trustLevel" className="block text-sm font-medium text-foreground">
            Trust level
          </label>
          <select
            id="trustLevel"
            name="trustLevel"
            required
            defaultValue="MEDIUM"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {TRUST_LEVELS.map((tl) => (
              <option key={tl} value={tl}>
                {tl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="checkFrequencyMinutes" className="block text-sm font-medium text-foreground">
            Check frequency (minutes)
          </label>
          <input
            id="checkFrequencyMinutes"
            name="checkFrequencyMinutes"
            type="number"
            min={5}
            max={10080}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            placeholder="e.g. 1440"
          />
          <p className="mt-1 text-xs text-muted">
            Optional. Leave blank to use the default sweep cadence.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="autoPublish"
              value="true"
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Auto-publish qualifying imports
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Requires HIGH trust, explicit applicant eligibility, a valid
                deadline and full publication validation. Imports otherwise stay
                as drafts for review.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={createPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          Create source
        </button>
      </form>
      {createState.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {createState.error}
        </p>
      )}
    </section>
  );
}