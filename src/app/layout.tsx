import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { I18nProvider } from "@/lib/i18n/client";
import { getCurrentLocale } from "@/lib/i18n/server";
import { LOCALE_METADATA } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function siteUrl(): URL {
  return new URL(getAppBaseUrl());
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "JobEthiopia",
    template: "%s | JobEthiopia",
  },
  description: "An Ethiopian job and career platform.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getCurrentLocale();
  const htmlLang = LOCALE_METADATA[locale].htmlLang;

  return (
    <html
      lang={htmlLang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          <SiteHeader />
          <main className="flex w-full flex-1 flex-col">{children}</main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
