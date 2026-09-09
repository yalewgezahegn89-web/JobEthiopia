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

export function cookieValueForLocale(locale: Locale): string {
  return locale;
}

export function detectPathLocale(raw: string | null | undefined): Locale {
  return toLocale(raw);
}

export { LOCALES };
