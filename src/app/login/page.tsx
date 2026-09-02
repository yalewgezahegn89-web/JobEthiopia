import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Sign in to JobEthiopia</h1>
        <p className="mt-1 text-muted">
          Sign in to access your applications, saved jobs, and account.
        </p>
      </div>
      <LoginForm />
      <Link href="/" className="text-sm text-muted underline">
        Back to JobEthiopia
      </Link>
    </section>
  );
}