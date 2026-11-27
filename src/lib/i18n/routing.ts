import { LOCALES, toLocale, type Locale } from "./locale";

const PREFIXED: readonly string[] = ["/am", "/om"] as const;

export function localeFromPathname(pathname: string): Locale | null {
  if (pathname === "/am" || pathname.startsWith("/am/")) return "am";
  if (pathname === "/om" || pathname.startsWith("/om/")) return "om";
  return null;
}

export function isPrefixedPath(pathname: string): boolean {
  return PREFIXED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/am" || pathname === "/om") return "/";
  for (const p of PREFIXED) {
    if (pathname.startsWith(`${p}/`)) {
      return pathname.slice(p.length) || "/";
    }
  }
  return pathname;
}

export function localizePath(
  currentPathname: string,
  targetLocale: Locale,
): string {
  const cleaned = stripLocalePrefix(currentPathname);
  if (targetLocale === "en") {
    return cleaned;
  }
  if (cleaned === "/") {
    return `/${targetLocale}`;
  }
  return `/${targetLocale}${cleaned}`;
}

const LOCALE_INDEPENDENT_PREFIXES: readonly string[] = [
  "/api",
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/ads.txt",
  "/manifest",
  "/static",
  "/assets",
] as const;

function splitHref(href: string): { pathname: string; suffix: string } {
  const marker = href.search(/[?#]/);
  if (marker === -1) return { pathname: href, suffix: "" };
  return { pathname: href.slice(0, marker), suffix: href.slice(marker) };
}

export function isLocaleIndependentHref(href: string): boolean {
  const { pathname } = splitHref(href);

  if (!pathname.startsWith("/") || pathname.startsWith("//")) return true;

  if (
    LOCALE_INDEPENDENT_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  return /\.[a-z0-9]+$/i.test(pathname);
}

export function localizeHref(href: string, locale: Locale): string {
  if (isLocaleIndependentHref(href)) return href;

  const { pathname, suffix } = splitHref(href);
  return `${localizePath(pathname, locale)}${suffix}`;
}

export function isActivePath(currentPathname: string, href: string): boolean {
  const current = stripLocalePrefix(splitHref(currentPathname).pathname);
  const target = stripLocalePrefix(splitHref(href).pathname);

  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

export function cookieValueForLocale(locale: Locale): string {
  return locale;
}

export function detectPathLocale(raw: string | null | undefined): Locale {
  return toLocale(raw);
}

export { LOCALES };
