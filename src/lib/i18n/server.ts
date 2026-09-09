import { headers } from "next/headers";
import { toLocale, type Locale, DEFAULT_LOCALE } from "./locale";
import { dictionaries, type Dictionary } from "./dictionary";

export const LOCALE_HEADER = "x-jobethiopia-locale";

export function resolveLocaleFromHeaderValue(
  value: string | null | undefined,
): Locale {
  return toLocale(value);
}

export async function getCurrentLocale(): Promise<Locale> {
  const headerStore = await headers();
  const value = headerStore.get(LOCALE_HEADER);
  return resolveLocaleFromHeaderValue(value);
}

export async function getI18n(): Promise<Dictionary> {
  const locale = await getCurrentLocale();
  return dictionaries[locale];
}

export async function getLocaleCode(): Promise<string> {
  const locale = await getCurrentLocale();
  return locale;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export { DEFAULT_LOCALE };
