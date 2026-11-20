import { redirect } from "next/navigation";
import { getCurrentLocale } from "@/lib/i18n/server";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Sign in with Telegram");

export default async function PhonePage() {
  const locale = await getCurrentLocale();
  redirect(locale === "en" ? "/login" : `/${locale}/login`);
}
