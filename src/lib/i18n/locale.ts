export type Locale = "en" | "am" | "om";

export const LOCALES: readonly Locale[] = ["en", "am", "om"] as const;

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_METADATA: Record<
  Locale,
  { name: string; intl: string; htmlLang: string }
> = {
  en: { name: "English", intl: "en-US", htmlLang: "en" },
  am: { name: "አማርኛ", intl: "am-ET", htmlLang: "am" },
  om: { name: "Afaan Oromoo", intl: "om-ET", htmlLang: "om" },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (value === "en" || value === "am" || value === "om")
  );
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function toLocaleFromCookie(value: string | undefined | null): Locale {
  return toLocale(value);
}

export function localeToIntl(locale: Locale): string {
  return LOCALE_METADATA[locale].intl;
}

export const LOCALE_COOKIE_NAME = "jobethiopia_locale";
