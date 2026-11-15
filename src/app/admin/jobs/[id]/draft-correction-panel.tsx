"use client";

import { useActionState } from "react";
import {
  correctDraftJobAction,
  type CorrectDraftJobActionResult,
} from "../actions";
import { toEthiopiaDateTimeInput } from "@/lib/time/ethiopia";

const initialState: CorrectDraftJobActionResult = { ok: false };

export default function DraftCorrectionPanel({
  jobId,
  deadline,
  description,
  requirements,
}: {
  jobId: string;
  deadline: string | Date | null;
  description: string;
  requirements: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    CorrectDraftJobActionResult,
    FormData
  >(correctDraftJobAction, initialState);

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const inputClass =
    "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        Correct draft details
      </h2>
      <p className="mt-2 text-sm text-muted">
        This updates only the deadline, description, and requirements of this
        draft. It does not publish the job or change its verification status.
      </p>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="jobId" value={jobId} />
        <div>
          <label
            htmlFor="deadline"
            className="block text-sm font-medium text-foreground"
          >
            Application deadline (Ethiopia Time)
          </label>
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            required
            defaultValue={toEthiopiaDateTimeInput(deadline)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-subtle">
            Entered and displayed in Ethiopia Time (EAT, UTC+03:00).
          </p>
          {state.fieldErrors?.deadline?.[0] ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {state.fieldErrors.deadline[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-foreground"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={8}
            minLength={50}
            maxLength={50000}
            defaultValue={description}
            className={inputClass}
          />
          {state.fieldErrors?.description?.[0] ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {state.fieldErrors.description[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="requirements"
            className="block text-sm font-medium text-foreground"
          >
            Requirements (optional)
          </label>
          <textarea
            id="requirements"
            name="requirements"
            rows={5}
            maxLength={20000}
            defaultValue={requirements ?? ""}
            className={inputClass}
          />
          {state.fieldErrors?.requirements?.[0] ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {state.fieldErrors.requirements[0]}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
        >
          {isPending ? "Saving..." : "Save corrections"}
        </button>

        {state.ok ? (
          <p role="status" className="text-sm text-success">
            Draft details saved.
          </p>
        ) : state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
