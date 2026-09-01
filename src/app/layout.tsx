import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex w-full flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
