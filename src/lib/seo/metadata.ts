import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_METADATA,
  type Locale,
} from "@/lib/i18n/locale";
import { getCurrentLocale } from "@/lib/i18n/server";
import { localizePath } from "@/lib/i18n/routing";
import { X_DEFAULT_LOCALE } from "./constants";

export { X_DEFAULT_LOCALE } from "./constants";

/** Shared noindex policy for authenticated, account, and private surfaces. */
export const NOINDEX_METADATA: Metadata["robots"] = {
  index: false,
  follow: false,
};

export type PageMetadataOptions = {
  /** Locale-free canonical path (for example `/jobs` or `/careers/article-1`). */
  path: string;
  /** Locale of the content being rendered. Defaults to English. */
  locale?: Locale;
  /**
   * Locale used to build the canonical URL. Untranslated detail pages pin this
   * to English so locale-prefixed UI variants do not create duplicate URLs.
   */
  canonicalLocale?: Locale;
  title: string;
  description: string;
  /** Use a Next.js absolute title instead of the root layout title template. */
  absoluteTitle?: boolean;
  /** Emit full hreflang alternates. Only for genuinely localized pages. */
  includeAlternates?: boolean;
  /** Add x-default. Only for fully localized pages. */
  includeXDefault?: boolean;
  locales?: readonly Locale[];
  baseUrl?: string;
  openGraphType?: "website" | "article";
  openGraphLocale?: string;
  publishedTime?: string;
  robots?: Metadata["robots"];
};

/** Strip trailing slashes so joins never emit double-slash canonical URLs. */
export function normalizeBaseUrl(base: string = getAppBaseUrl()): string {
  return base.trim().replace(/\/+$/, "");
}

/** Convert a known date value to ISO 8601 without inventing a value. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Resolve a locale-free or localized path to a single absolute URL. */
export function absoluteUrl(path: string, base?: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeBaseUrl(base)}${normalizedPath}`;
}

/** Build absolute hreflang alternates from one locale-free path. */
export function languageAlternates(
  canonicalPath: string,
  options: {
    base?: string;
    locales?: readonly Locale[];
    includeXDefault?: boolean;
  } = {},
): Record<string, string> {
  const base = normalizeBaseUrl(options.base ?? getAppBaseUrl());
  const locales = options.locales ?? LOCALES;
  const languages: Record<string, string> = {};

  for (const locale of locales) {
    languages[locale] = absoluteUrl(localizePath(canonicalPath, locale), base);
  }

  if (options.includeXDefault) {
    languages[X_DEFAULT_LOCALE] = absoluteUrl(
      localizePath(canonicalPath, DEFAULT_LOCALE),
      base,
    );
  }

  return languages;
}

function isNoindex(robots: Metadata["robots"]): boolean {
  if (robots == null) return false;
  if (typeof robots === "string") return robots.includes("noindex");
  if (Array.isArray(robots)) {
    return robots.some((rule) => rule.index === false);
  }
  return robots.index === false;
}

/**
 * Shared metadata builder for public pages. Every caller gets one canonical
 * URL and, only when explicitly opted in, a complete hreflang cluster.
 */
export function buildPageMetadata(options: PageMetadataOptions): Metadata {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const base = normalizeBaseUrl(options.baseUrl ?? getAppBaseUrl());
  const canonical = absoluteUrl(
    localizePath(options.path, options.canonicalLocale ?? locale),
    base,
  );

  const languages = options.includeAlternates
    ? languageAlternates(options.path, {
        base,
        locales: options.locales,
        includeXDefault: options.includeXDefault,
      })
    : undefined;

  const title = options.absoluteTitle
    ? { absolute: options.title }
    : options.title;
  const socialTitle = options.title.includes("JobEthiopia")
    ? options.title
    : `${options.title} | JobEthiopia`;
  const indexable = !isNoindex(options.robots);

  const openGraph: Metadata["openGraph"] = indexable
    ? {
        title: socialTitle,
        description: options.description,
        url: canonical,
        type: options.openGraphType ?? "website",
        siteName: "JobEthiopia",
        locale: options.openGraphLocale ?? LOCALE_METADATA[locale].intl,
        ...(options.publishedTime ? { publishedTime: options.publishedTime } : {}),
      }
    : undefined;

  return {
    title,
    description: options.description,
    alternates: {
      canonical,
      ...(languages ? { languages } : {}),
    },
    ...(openGraph ? { openGraph } : {}),
    ...(indexable
      ? {
          twitter: {
            card: "summary_large_image" as const,
            title: socialTitle,
            description: options.description,
          },
        }
      : {}),
    ...(options.robots ? { robots: options.robots } : {}),
  };
}

/** Convenience wrapper for pages that need the request locale from middleware. */
export async function buildCurrentLocaleMetadata(
  options: Omit<PageMetadataOptions, "locale">,
): Promise<Metadata> {
  const locale = await getCurrentLocale();
  return buildPageMetadata({ ...options, locale });
}

/** Paths that must never be indexed, in robots.txt and page metadata. */
export const PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/organization",
  "/employer",
  "/applications",
  "/saved-jobs",
  "/recommendations",
  "/job-alerts",
  "/notifications",
  "/cv",
  "/cover-letter",
  "/interview-prep",
] as const;

export const PRIVATE_EXACT_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/phone",
  "/profile",
  "/settings",
] as const;

/**
 * Robots.txt is prefix-based. Prefixes therefore keep a trailing slash so
 * `/organization/` cannot accidentally disallow the public `/organizations`.
 */
export function privateRobotsDisallowPaths(): string[] {
  const paths = new Set<string>([
    ...PRIVATE_PATH_PREFIXES.map((path) => `${path}/`),
    ...PRIVATE_EXACT_PATHS,
  ]);

  for (const locale of LOCALES) {
    for (const path of PRIVATE_PATH_PREFIXES) {
      paths.add(`${localizePath(path, locale)}/`);
    }
    for (const path of PRIVATE_EXACT_PATHS) {
      paths.add(localizePath(path, locale));
    }
  }

  return [...paths];
}

/** Metadata helper for account/auth pages that must stay out of the index. */
export function privateMetadata(
  title: string,
  description?: string,
): Metadata {
  return {
    title,
    ...(description ? { description } : {}),
    robots: NOINDEX_METADATA,
  };
}
