import type { Metadata } from "next";
import LegalDocumentView from "@/components/legal/legal-document";
import { getCurrentLocale } from "@/lib/i18n/server";
import { getPublicInformationContent } from "@/lib/publicInfo/content";
import { buildPublicInformationMetadata } from "@/lib/publicInfo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildPublicInformationMetadata("faq");
}

export default async function FaqPage() {
  const locale = await getCurrentLocale();
  return <LegalDocumentView document={getPublicInformationContent(locale).faq} />;
}
