"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  requestPhoneOtp,
  submitPhoneCode,
  createPhoneAccount,
} from "./actions";
import type { PhoneStepResult } from "./phone-action-types";

type Step = "phone" | "code" | "name";

export default function PhoneForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const codeRef = useRef<string>("");

  function run(action: () => Promise<PhoneStepResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (result.needsName === false) {
        router.push("/jobs");
        router.refresh();
        return;
      }
      if (result.needsName === true && result.requestId) {
        setRequestId(result.requestId);
        setStep("name");
        return;
      }
      if (result.requestId) {
        setRequestId(result.requestId);
        setStep("code");
      }
    });
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="flex items-center justify-between text-sm font-medium">
        {step === "phone" && (
          <span className="text-primary">
            1 · Verify your number
          </span>
        )}
        {step === "code" && (
          <div className="w-full space-y-4">
            <span className="block text-primary">2 · Enter the code</span>
            <ol className="flex items-center gap-1 text-xs text-muted">
              <li className={step === "code" ? "font-semibold text-primary" : ""}>Number</li>
              <li aria-hidden="true">→</li>
              <li className="font-semibold text-primary">Code</li>
              <li aria-hidden="true">→</li>
              <li>Name</li>
            </ol>
            <input type="hidden" name="phone" value={phone} readOnly />
          </div>
        )}
        {step === "name" && (
          <span className="text-primary">3 · Tell us your name</span>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === "phone" ? (
        <PhoneStep
          pending={isPending}
          onSubmit={(value) => {
            setPhone(value);
            run(() => requestPhoneOtp(value));
          }}
        />
      ) : null}

      {step === "code" ? (
        <CodeStep
          pending={isPending}
          onSubmit={(code) => {
            codeRef.current = code;
            run(() => submitPhoneCode(requestId!, code, phone));
          }}
        />
      ) : null}

      {step === "name" ? (
        <NameStep
          pending={isPending}
          onSubmit={(name) =>
            run(() => createPhoneAccount(requestId!, codeRef.current, phone, name))
          }
        />
      ) : null}

      <div className="border-t border-border-subtle pt-4">
        <SocialOptions />
      </div>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

function PhoneStep({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (phone: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <fieldset disabled={pending} className="space-y-4">
      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-foreground"
        >
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          autoFocus
          placeholder="09 12 34 56 78"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-xs text-muted">
          We&apos;ll send a one-time verification code to this number.
        </p>
      </div>
      <button
        type="button"
        disabled={pending || value.trim().length < 9}
        onClick={() => onSubmit(value.trim())}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Get code"}
      </button>
    </fieldset>
  );
}

function CodeStep({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (code: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <fieldset disabled={pending} className="space-y-4">
      <div>
        <label
          htmlFor="code"
          className="block text-sm font-medium text-foreground"
        >
          Verification code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          placeholder="6-digit code"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <button
        type="button"
        disabled={pending || value.length < 4}
        onClick={() => onSubmit(value)}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Continue"}
      </button>
    </fieldset>
  );
}

function NameStep({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <fieldset disabled={pending} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-foreground"
        >
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          autoFocus
          placeholder="e.g. Abebe Kebede"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-xs text-muted">
          We&apos;ll use this to personalise your JobEthiopia experience.
        </p>
      </div>
      <button
        type="button"
        disabled={pending || value.trim().length === 0}
        onClick={() => onSubmit(value.trim())}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </fieldset>
  );
}

function SocialOptions() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border-subtle" />
        or continue with
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-lg border border-border bg-surface px-2 py-2 text-xs font-medium text-muted opacity-60"
        >
          Google
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-lg border border-border bg-surface px-2 py-2 text-xs font-medium text-muted opacity-60"
        >
          Apple
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="rounded-lg border border-border bg-surface px-2 py-2 text-xs font-medium text-muted opacity-60"
        >
          Telegram
        </button>
      </div>
      <p className="text-center text-xs text-muted">
        Google, Apple &amp; Telegram sign-in are coming soon.
      </p>
    </div>
  );
}
