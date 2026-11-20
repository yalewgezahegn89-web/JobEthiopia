import { describe, it, expect } from "vitest";
import {
  AIRLINE_PROVIDERS,
  ETHIOPIAN_AIRLINES_PROVIDER,
  MONITORED_AIRLINE_SOURCES,
  getAirlineProviderByHost,
  getAutomatedAirlineProviders,
  isAllowedAirlineHost,
} from "../registry";

describe("airline provider registry", () => {
  it("allows only the automated Ethiopian Airlines host", () => {
    expect(isAllowedAirlineHost("ethiopianairlines.com")).toBe(true);
    expect(isAllowedAirlineHost("www.ethiopianairlines.com")).toBe(true);
    expect(isAllowedAirlineHost("WWW.ETHIOPIANAIRLINES.COM")).toBe(true);
    expect(isAllowedAirlineHost("careers.ethiopianairlines.com")).toBe(true);
  });

  it("rejects look-alike, unrelated and monitored-airline hosts", () => {
    expect(isAllowedAirlineHost("notethiopianairlines.com")).toBe(false);
    expect(isAllowedAirlineHost("ethiopianairlines.com.evil.test")).toBe(
      false,
    );
    expect(isAllowedAirlineHost("example.com")).toBe(false);
    for (const provider of MONITORED_AIRLINE_SOURCES) {
      expect(provider.automated).toBe(false);
      for (const host of provider.hosts) {
        expect(isAllowedAirlineHost(host)).toBe(false);
      }
    }
  });

  it("resolves the provider for any known airline host", () => {
    expect(getAirlineProviderByHost("www.ethiopianairlines.com")?.key).toBe(
      ETHIOPIAN_AIRLINES_PROVIDER.key,
    );
    expect(getAirlineProviderByHost("jobs.emirates.com")?.key).toBe(
      "emirates",
    );
    expect(getAirlineProviderByHost("example.com")).toBeNull();
  });

  it("returns only automated providers for ingestion", () => {
    const automated = getAutomatedAirlineProviders();
    expect(automated).toEqual([ETHIOPIAN_AIRLINES_PROVIDER]);
    expect(AIRLINE_PROVIDERS).toHaveLength(
      1 + MONITORED_AIRLINE_SOURCES.length,
    );
  });
});
