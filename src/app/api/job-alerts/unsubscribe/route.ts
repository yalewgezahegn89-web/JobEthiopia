import { NextResponse } from "next/server";
import { unsubscribeAlertWithToken } from "@/lib/jobAlerts/delivery";
import { dictionaries } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

/**
 * One-click alert unsubscribe (Phase 7 Batch 6).
 *
 * Intentional design: this is a public GET triggered by the link inside each
 * alert email. No session or CSRF is required — the secret-bearing capability
 * is the random per-alert token itself, which is single-use, rotates on every
 * send, and expires after 90 days. The token is only ever compared by its
 * SHA-256 hash; the raw token is never stored or logged.
 *
 * The page body is generated server-side and localized to the alert's saved
 * locale. Nothing from the request is reflected into the page.
 */

function htmlPage(documentLocale: Locale, bodyHtml: string): string {
  const t = dictionaries[documentLocale].jobAlerts;
  return `<!doctype html>
<html lang="${documentLocale}">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${t.email.unsubscribeConfirmationTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
    <main style="max-width:560px;margin:48px auto;padding:32px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;text-align:center;">
      ${bodyHtml}
      <p style="margin:24px 0 0;">
        <a href="/" style="color:#1d4ed8;text-decoration:none;font-weight:600;">${t.email.backToHome}</a>
      </p>
    </main>
  </body>
</html>`;
}

function toLocale(value: string | null): Locale {
  return value === "am" || value === "om" ? value : "en";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const locale = toLocale(searchParams.get("locale"));
  const t = dictionaries[locale].jobAlerts.email;

  const confirmed = await unsubscribeAlertWithToken(token);

  const bodyHtml = confirmed
    ? `<h1 style="margin:0;font-size:22px;color:#111827;">${t.unsubscribeConfirmation}</h1>
       <p style="margin:12px 0 0;color:#4b5563;font-size:15px;">${t.unsubscribeConfirmationBody}</p>`
    : `<h1 style="margin:0;font-size:22px;color:#111827;">${t.unsubscribeExpired}</h1>
       <p style="margin:12px 0 0;color:#4b5563;font-size:15px;">${t.unsubscribeExpiredBody}</p>`;

  return new NextResponse(htmlPage(locale, bodyHtml), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}