import { LocalizedLink } from "@/components/i18n/localized-link";
import type { Messages } from "@/lib/i18n/dictionary";

/**
 * Legal links shown beneath the authentication forms. Labels are supplied by
 * the caller so this component stays synchronous and presentation-only.
 */
export default function AuthLegalLinks({
  labels,
}: {
  labels: Messages["legalNav"];
}) {
  return (
    <p className="mt-4 text-center text-xs text-muted">
      <LocalizedLink
        href="/privacy"
        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {labels.privacy}
      </LocalizedLink>
      {" · "}
      <LocalizedLink
        href="/terms"
        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {labels.terms}
      </LocalizedLink>
      {" · "}
      <LocalizedLink
        href="/cookies"
        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {labels.cookies}
      </LocalizedLink>
    </p>
  );
}
