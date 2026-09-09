import { toLocale, LOCALE_METADATA, type Locale } from "./locale";

export interface DateFormatterOptions {
  year?: "numeric" | "2-digit";
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
}

function intlLocale(locale: Locale): string {
  return LOCALE_METADATA[locale].intl;
}

export function resolveLocale(value: string | null | undefined): Locale {
  return toLocale(value);
}

export function formatDate(
  value: Date | string | number | null | undefined,
  locale: Locale = "en",
): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}

export function formatDateLong(
  value: Date | string | number | null | undefined,
  locale: Locale = "en",
): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}

export function formatNumber(
  value: number | null | undefined,
  locale: Locale = "en",
): string {
  if (value == null) return "";
  try {
    return new Intl.NumberFormat(intlLocale(locale)).format(value);
  } catch {
    return String(value);
  }
}
