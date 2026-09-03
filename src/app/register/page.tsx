import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "./register-form";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your account"
      description="Join JobEthiopia to find and apply for jobs."
      footer={
        <>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Already have an account? Sign in
            </Link>
            <Link
              href="/"
              className="text-sm text-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Back to JobEthiopia
            </Link>
          </div>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
