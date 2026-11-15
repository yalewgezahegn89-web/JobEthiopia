"use client";

import { useActionState } from "react";
import {
  assignJobCategoryAction,
  type AssignJobCategoryActionResult,
} from "../actions";

const initialState: AssignJobCategoryActionResult = { ok: true };

export default function CategoryAssignmentPanel({
  jobId,
  status,
  categoryId,
  categoryName,
  categories,
}: {
  jobId: string;
  status: string;
  categoryId: string | null;
  categoryName: string | null;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState<
    AssignJobCategoryActionResult,
    FormData
  >(assignJobCategoryAction, initialState);

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  const canAssign = status === "DRAFT" && categoryId === null;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Category</h2>

      {categoryId ? (
        <p className="mt-2 text-sm text-foreground">
          Current category:{" "}
          <strong>{categoryName ?? "Unknown category"}</strong>
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">No category assigned.</p>
      )}

      {canAssign ? (
        categories.length > 0 ? (
          <form action={formAction} className="mt-4 space-y-3">
            <input type="hidden" name="jobId" value={jobId} />
            <div>
              <label
                htmlFor="categoryId"
                className="block text-sm font-medium text-foreground"
              >
                Assign category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none"
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className={`rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {isPending ? "Assigning..." : "Assign category"}
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No active categories are available to assign.
          </p>
        )
      ) : !categoryId ? (
        <p className="mt-3 text-sm text-muted">
          A category can only be assigned while the job is a draft.
        </p>
      ) : null}

      {!state.ok && state.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
