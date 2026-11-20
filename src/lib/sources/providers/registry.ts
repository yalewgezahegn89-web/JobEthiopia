/**
 * Registry of airline recruitment sources.
 *
 * Only providers with a machine-readable, official careers endpoint are
 * eligible for automated ingestion. Others are tracked here as monitored
 * airlines: they have no adapter until a compliant official feed is confirmed,
 * so they can never be scraped implicitly from an arbitrary host.
 */
export type AirlineSourceType = "WEBSITE" | "FEED";

export interface AirlineProvider {
  key: string;
  name: string;
  /** Official careers page or feed URL. */
  careersUrl: string;
  /** Exact hostnames (or parent domains) owned by the airline. */
  hosts: string[];
  sourceType: AirlineSourceType;
  /** True only when an automated, compliant feed/page is supported. */
  automated: boolean;
}

export const ETHIOPIAN_AIRLINES_PROVIDER: AirlineProvider = {
  key: "ethiopian-airlines",
  name: "Ethiopian Airlines",
  careersUrl: "https://www.ethiopianairlines.com/corporate/careers",
  hosts: ["ethiopianairlines.com"],
  sourceType: "WEBSITE",
  automated: true,
};

/**
 * Airlines whose official careers pages are monitored for a compliant feed.
 * They are intentionally NOT auto-ingested: no adapter is registered until an
 * official, machine-readable endpoint is confirmed.
 */
export const MONITORED_AIRLINE_SOURCES: AirlineProvider[] = [
  {
    key: "emirates",
    name: "Emirates",
    careersUrl: "https://www.emiratesgroupcareers.com/",
    hosts: ["emiratesgroupcareers.com", "emirates.com"],
    sourceType: "WEBSITE",
    automated: false,
  },
  {
    key: "flydubai",
    name: "flydubai",
    careersUrl: "https://www.flydubai.com/en/careers",
    hosts: ["flydubai.com"],
    sourceType: "WEBSITE",
    automated: false,
  },
  {
    key: "kenya-airways",
    name: "Kenya Airways",
    careersUrl: "https://www.kenya-airways.com/en/careers/",
    hosts: ["kenya-airways.com"],
    sourceType: "WEBSITE",
    automated: false,
  },
  {
    key: "turkish-airlines",
    name: "Turkish Airlines",
    careersUrl: "https://careers.turkishairlines.com/",
    hosts: ["turkishairlines.com"],
    sourceType: "WEBSITE",
    automated: false,
  },
];

export const AIRLINE_PROVIDERS: AirlineProvider[] = [
  ETHIOPIAN_AIRLINES_PROVIDER,
  ...MONITORED_AIRLINE_SOURCES,
];

function hostMatches(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`);
}

export function getAirlineProviderByHost(
  host: string,
): AirlineProvider | null {
  const normalized = host.toLowerCase();
  for (const provider of AIRLINE_PROVIDERS) {
    if (provider.hosts.some((allowed) => hostMatches(normalized, allowed))) {
      return provider;
    }
  }
  return null;
}

/**
 * Returns true only for hosts of providers with an active automated adapter.
 * Merely being a known airline host is not enough.
 */
export function isAllowedAirlineHost(host: string): boolean {
  const provider = getAirlineProviderByHost(host);
  return provider?.automated === true;
}

export function getAutomatedAirlineProviders(): AirlineProvider[] {
  return AIRLINE_PROVIDERS.filter((provider) => provider.automated);
}
