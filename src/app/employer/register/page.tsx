import type { Metadata } from "next";
import Link from "next/link";
import EmployerRegisterForm from "./employer-register-form";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Request an employer account",
};

export default async function EmployerRegisterPage() {
  const t = await getI18n();
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">{t.employerAuth.registerHeading}</h1>
        <p className="mt-1 text-muted">
          {t.employerAuth.registerSubtitle}
        </p>
      </div>
      <EmployerRegisterForm t={t} />
      <div className="flex flex-col items-center gap-2">
        <Link href="/login" className="text-sm text-muted underline">
          {t.employerAuth.registerSignIn}
        </Link>
        <Link href="/" className="text-sm text-muted underline">
          {t.employerAuth.registerBack}
        </Link>
      </div>
    </section>
  );
}
