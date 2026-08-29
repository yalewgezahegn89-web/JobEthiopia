import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
};

export default function LoginPage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">JobEthiopia Admin</h1>
        <p className="mt-1 text-neutral-600">
          Sign in to access the admin workspace.
        </p>
      </div>
      <LoginForm />
      <Link href="/" className="text-sm text-neutral-600 underline">
        Back to JobEthiopia
      </Link>
    </section>
  );
}