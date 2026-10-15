import type { Messages } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import {
  isPlacementEligible,
  getAdPlacement,
  reserveClassForFormat,
  type AdContent,
  type AdPlacementId,
} from "@/lib/monetization/config";
import { isAdRenderingPermitted } from "@/lib/monetization/consent";
import { getAdProvider } from "@/lib/monetization/providers";
import { trackAdEvent } from "@/lib/analytics/adEvents";

/**
 * Provider-neutral reserved ad slot.
 *
 * Renders nothing unless: monetization is enabled, the placement is enabled
 * and route-eligible (never on ad-free routes), the provider passes the
 * consent gate, and the provider returns ad content. This keeps every slot
 * invisible in the disabled/no-provider state (no broken UI, no failed
 * external requests, no fake placeholders) while remaining measurable the
 * moment a provider is wired up. The reserved minimum heights protect layout
 * (CLS) for known unit sizes; text content grows naturally.
 *
 * Advertising is clearly labeled ("Advertisement", localized) so it can never
 * be mistaken for editorial/job content, and links are `nofollow` +
 * `no-referrer` by default.
 *
 * The component is deliberately synchronous: page tests render the tree with
 * renderToStaticMarkup, so no internal awaits. The impression is fire-and-
 * forget (best-effort, never throws).
 */
export default function AdSlot({
  placementId,
  pathname,
  t,
  locale,
}: {
  placementId: AdPlacementId;
  pathname: string;
  t: Messages;
  locale?: Locale;
}) {
  if (!isPlacementEligible(placementId, pathname)) {
    return null;
  }

  const provider = getAdProvider();
  if (!provider) {
    return null;
  }

  const resolvedLocale = locale ?? "en";
  const content = provider.render({
    placementId,
    pathname,
    locale: resolvedLocale,
  });
  if (!content) {
    return null;
  }

  // Consent gate: non-tracking providers pass; tracking providers fail closed
  // until a genuine consent source exists.
  if (!isAdRenderingPermitted(provider)) {
    return null;
  }

  const title = resolveCopy(content.titleKey, content.title, t);
  if (!title) {
    return null;
  }
  const body = resolveCopy(content.bodyKey, content.body, t);

  const placement = getAdPlacement(placementId);
  const reserveClass = placement
    ? reserveClassForFormat(placement.format)
    : "";

  void trackAdEvent({
    event: "ad_impression",
    placementId,
    locale: resolvedLocale,
  });

  return (
    <aside
      aria-label={t.ads.label}
      data-ad-placement={placementId}
      data-ad-provider={provider.id.slice(0, 32)}
      className={`mt-4 w-full overflow-hidden rounded-xl border border-border bg-surface p-4 ${reserveClass}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {t.ads.label}
      </p>
      <a
        href={content.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        referrerPolicy="no-referrer"
        className="mt-2 block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="block text-sm font-semibold text-primary underline-offset-2 hover:underline">
          {title}
        </span>
        {body && (
          <span className="mt-1 block text-sm leading-6 text-muted">
            {body}
          </span>
        )}
      </a>
    </aside>
  );
}

function resolveCopy(
  key: AdContent["titleKey"],
  literal: string | undefined,
  t: Messages,
): string | undefined {
  if (key) {
    return t.ads.house[key] ?? undefined;
  }
  const trimmed = literal?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}