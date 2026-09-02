import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-muted">
          Enter the email associated with your account and we&apos;ll send you a
          reset link.
        </p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm text-muted underline">
        Back to sign in
      </Link>
    </section>
  );
}
