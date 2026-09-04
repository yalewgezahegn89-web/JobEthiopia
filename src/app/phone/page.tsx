import type { Metadata } from "next";
import PhoneForm from "./phone-form";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Phone sign in",
};

export default function PhonePage() {
  return (
    <AuthCard
      eyebrow="Phone sign in"
      title="Get started with your phone"
      description="Verify your mobile number to sign in or create your JobEthiopia account in under a minute."
    >
      <PhoneForm />
    </AuthCard>
  );
}
