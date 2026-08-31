"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

type ResumeInfo =
  | { originalName: string; size: number; updatedAt: string }
  | null;

type Message = { kind: "error"; text: string } | null;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function ResumeForm({
  applicationId,
  current,
}: {
  applicationId: string;
  current: ResumeInfo;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const url = `/api/applications/${applicationId}/resume`;

  function upload(file: File) {
    const body = new FormData();
    body.append("file", file);

    startTransition(async () => {
      setMessage(null);
      try {
        const res = await fetch(url, { method: "POST", body });
        if (res.status === 413) {
          setMessage({ kind: "error", text: "File is larger than 5 MB." });
          return;
        }
        if (res.status === 429) {
          setMessage({
            kind: "error",
            text: "Too many uploads. Please try again later.",
          });
          return;
        }
        if (!res.ok) {
          setMessage({
            kind: "error",
            text: "Could not save the resume. Please check the file is a PDF and try again.",
          });
          return;
        }
        router.refresh();
      } catch {
        setMessage({
          kind: "error",
          text: "Could not reach the server. Please try again.",
        });
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    upload(file);
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          setMessage({
            kind: "error",
            text: "Could not remove the resume. Please try again.",
          });
          return;
        }
        setConfirmDelete(false);
        router.refresh();
      } catch {
        setMessage({
          kind: "error",
          text: "Could not reach the server. Please try again.",
        });
      }
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Resume
          </h3>
          {current ? (
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
              {current.originalName} · {formatBytes(current.size)}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              No resume uploaded yet.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {current && (
            <a
              href={url}
              download
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Download
            </a>
          )}

          <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600">
            {current ? "Replace" : "Upload"}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={pending}
              onChange={handleFileChange}
            />
          </label>

          {current &&
            (confirmDelete ? (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="inline-flex items-center justify-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Remove
              </button>
            ))}
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        PDF only, up to 5 MB. Replace uploads or removes the current file.
      </p>

      {message && (
        <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {message.text}
        </p>
      )}
    </section>
  );
}