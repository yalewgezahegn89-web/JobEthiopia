"use client";

import { useSyncExternalStore } from "react";

export type PrepSection = {
  heading: string;
  items: string[];
};

type PrepChecklistLabels = {
  title: string;
  hint: string;
  progress: (done: number, total: number) => string;
  reset: string;
  done: string;
};

type PrepChecklistProps = {
  checklistId: string;
  sections: PrepSection[];
  labels: PrepChecklistLabels;
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const EMPTY: Record<string, boolean> = {};

const listeners = new Set<() => void>();
const storageCache = new Map<string, Record<string, boolean>>();

function readFromStorage(storageKey: string): Record<string, boolean> {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return EMPTY;
    }
    return parsed;
  } catch {
    return EMPTY;
  }
}

function readSnapshot(storageKey: string): Record<string, boolean> {
  let value = storageCache.get(storageKey);
  if (value === undefined) {
    value = readFromStorage(storageKey);
    storageCache.set(storageKey, value);
  }
  return value;
}

function notify() {
  for (const listener of listeners) listener();
}

function handleStorageChange() {
  storageCache.clear();
  notify();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function persist(storageKey: string, next: Record<string, boolean>) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // storage unavailable — keep in-memory only
  }
  storageCache.set(storageKey, next);
  notify();
}

/**
 * Local, browser-only interview prep checklist (Phase 13).
 *
 * Checklist state lives in localStorage keyed by a stable id (generic or
 * job-scoped), never sent to the server — nothing about a candidate's
 * preparation is tracked or stored remotely.
 */
export function PrepChecklist({
  checklistId,
  sections,
  labels,
}: PrepChecklistProps) {
  const storageKey = `je_interview_checklist:${checklistId}`;

  const flatItems = sections.flatMap((s) => s.items);
  const total = flatItems.length;

  const checked = useSyncExternalStore(
    subscribe,
    () => readSnapshot(storageKey),
    () => EMPTY,
  );
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const done = flatItems.filter((item) => checked[item]).length;

  function toggle(item: string) {
    persist(storageKey, { ...checked, [item]: !checked[item] });
  }

  function reset() {
    persist(storageKey, EMPTY);
  }

  const progressPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section
      aria-label={labels.title}
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{labels.title}</h2>
          <button
            type="button"
            onClick={reset}
            disabled={!hydrated}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.reset}
          </button>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          {done === total && total > 0
            ? labels.done
            : labels.progress(done, total)}
        </p>

        <p className="mt-4 text-xs leading-5 text-subtle">{labels.hint}</p>
      </div>

      <div className="space-y-8 border-t border-border-subtle p-6 sm:p-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h3 className="text-base font-semibold text-foreground">
              {section.heading}
            </h3>
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => {
                const isChecked = Boolean(checked[item]);
                return (
                  <li key={item}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5 transition-colors hover:border-border has-[:checked]:border-primary/40">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(item)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span
                        className={`text-sm leading-6 ${
                          isChecked
                            ? "text-muted line-through decoration-muted/50"
                            : "text-foreground"
                        }`}
                      >
                        {item}
                      </span>
                      {isChecked ? (
                        <CheckIcon className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}