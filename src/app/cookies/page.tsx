import type { Metadata } from "next";
import LegalDocumentView from "@/components/legal/legal-document";
import { getCurrentLocale } from "@/lib/i18n/server";
import { getLegalContent } from "@/lib/legal/content";
import { buildLegalMetadata } from "@/lib/legal/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return buildLegalMetadata("cookies");
}

export default async function CookiesPage() {
  const locale = await getCurrentLocale();
  return <LegalDocumentView document={getLegalContent(locale).cookies} />;
}
