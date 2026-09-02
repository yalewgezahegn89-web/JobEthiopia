import type { Metadata } from "next";
import Link from "next/link";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      {token ? (
        <>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>
            <p className="mt-1 text-muted">
              Enter a new password for your account.
            </p>
          </div>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Invalid link</h1>
          <p className="mt-1 text-muted">
            This reset link is missing. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm text-muted underline"
          >
            Request a new link
          </Link>
        </div>
      )}
    </section>
  );
}
