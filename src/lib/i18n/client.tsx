"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./locale";
import type { Dictionary } from "./dictionary";
import { dictionaries } from "./dictionary";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(
  null,
);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: dictionaries[locale] }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): { locale: Locale; t: Dictionary } {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
