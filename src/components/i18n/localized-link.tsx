"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useOptionalI18n } from "@/lib/i18n/client";
import { localizeHref } from "@/lib/i18n/routing";

type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/**
 * Internal links use the active locale while preserving the destination route
 * and query string. External, API, static and locale-independent hrefs pass
 * through unchanged via localizeHref().
 */
export function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
  const locale = useOptionalI18n()?.locale ?? "en";
  return <Link href={localizeHref(href, locale)} {...props} />;
}
