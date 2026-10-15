import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { VerifyEmailFlow } from "./verify-email-flow";

export const metadata: Metadata = {
  title: "Verify Email | JobEthiopia",
  description: "Verify your email address.",
  robots: "noindex, nofollow",
};

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamsValue>;

function firstValue(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const t = await getI18n();

  const token = firstValue(params.token) ?? "";
  const rawType = firstValue(params.type) ?? "verify";
  const type: "verify" | "change" =
    rawType === "change" ? "change" : "verify";

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
        <div
          role="status"
          className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm"
        >
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.verifyEmail.invalidTitle}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {t.verifyEmail.invalidBody}
          </p>
          <Link
            href="/settings"
            className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t.verifyEmail.backToSettings}
          </Link>
        </div>
      </div>
    );
  }

  return <VerifyEmailFlow token={token} type={type} t={t} />;
}