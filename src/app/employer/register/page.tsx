import type { Metadata } from "next";
import Link from "next/link";
import EmployerRegisterForm from "./employer-register-form";

export const metadata: Metadata = {
  title: "Request an employer account",
};

export default function EmployerRegisterPage() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Request an employer account</h1>
        <p className="mt-1 text-neutral-600">
          Submit your request and our team will review it before your
          organization is activated.
        </p>
      </div>
      <EmployerRegisterForm />
      <div className="flex flex-col items-center gap-2">
        <Link href="/login" className="text-sm text-neutral-600 underline">
          Already have an account? Sign in
        </Link>
        <Link href="/" className="text-sm text-neutral-600 underline">
          Back to JobEthiopia
        </Link>
      </div>
    </section>
  );
}
