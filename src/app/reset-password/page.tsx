import type { Metadata } from "next";
import Link from "next/link";
import ResetPasswordForm from "./reset-password-form";
import { AuthCard } from "@/components/auth/auth-card";

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

  if (!token) {
    return (
      <AuthCard
        eyebrow="Account recovery"
        title="Invalid link"
        description="This reset link is missing. Please request a new one."
        footer={
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Request a new link
          </Link>
        }
      />
    );
  }

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Enter a new password for your account."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
