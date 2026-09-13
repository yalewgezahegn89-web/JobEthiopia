import type { Messages } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";
import {
  isPlacementEligible,
  type AdPlacementId,
} from "@/lib/monetization/config";
import { getAdProvider } from "@/lib/monetization/providers";
import { trackAdEvent } from "@/lib/analytics/adEvents";

/**
 * Provider-neutral reserved ad slot.
 *
 * Renders nothing unless: monetization is enabled, the placement is enabled
 * and route-eligible, and a registered provider returns ad content for the
 * request. This keeps every slot invisible (no layout shift, no fake ads)
 * while keeping the placement reserved and measurable the moment a provider
 * is wired up. Ad links are `nofollow` and privacy-safe by default.
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

  void trackAdEvent({
    event: "ad_impression",
    placementId,
    locale: resolvedLocale,
  });

  return (
    <aside
      aria-label={t.ads.label}
      data-ad-placement={placementId}
      className="mt-4 rounded-xl border border-border bg-surface p-4"
    >
      <a
        href={content.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        referrerPolicy="no-referrer"
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="block text-sm font-semibold text-primary underline-offset-2 hover:underline">
          {content.title}
        </span>
        {content.body && (
          <span className="mt-1 block text-sm leading-6 text-muted">
            {content.body}
          </span>
        )}
      </a>
    </aside>
  );
}