import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email associated with your account and we'll send you a reset link."
      footer={
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
