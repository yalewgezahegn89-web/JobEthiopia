import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ADVERTISING_ENV_KEYS,
  readAdvertisingSettings,
  validateAdvertisingEnv,
} from "../settings";
import { AD_PLACEMENTS } from "../config";

afterEach(() => {
  vi.unstubAllEnvs();
});

const asEnv = (value: Record<string, string>): NodeJS.ProcessEnv =>
  ({ ...process.env, ...value }) as NodeJS.ProcessEnv;

describe("ADVERTISING_ENV_KEYS", () => {
  it("documents every advertising switch in one place", () => {
    expect(ADVERTISING_ENV_KEYS).toEqual([
      "MONETIZATION_ENABLED",
      "AD_PROVIDER",
      "AD_CONSENT_REQUIRED",
    ]);
  });
});

describe("validateAdvertisingEnv", () => {
  it("rejects a configuration that lacks the required switches", () => {
    const result = validateAdvertisingEnv(asEnv({}));
    expect(result.valid).toBe(false);
  });

  it("accepts a well-formed advertising configuration", () => {
    const result = validateAdvertisingEnv(
      asEnv({
        MONETIZATION_ENABLED: "true",
        AD_PROVIDER: "house",
        AD_CONSENT_REQUIRED: "false",
      }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.settings.enabled).toBe(true);
      expect(result.settings.providerQuery).toBe("house");
      expect(result.settings.consentRequired).toBe(false);
      expect(result.settings.placements).toEqual(
        AD_PLACEMENTS.map((p) => p.id),
      );
    }
  });

  it("rejects malformed booleans", () => {
    const result = validateAdvertisingEnv(
      asEnv({ MONETIZATION_ENABLED: "yes" }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects non-boolean consent switches", () => {
    const result = validateAdvertisingEnv(
      asEnv({ AD_CONSENT_REQUIRED: "1" }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects oversized provider ids", () => {
    const result = validateAdvertisingEnv(
      asEnv({ MONETIZATION_ENABLED: "true", AD_PROVIDER: "x".repeat(80) }),
    );
    expect(result.valid).toBe(false);
  });
});

describe("readAdvertisingSettings (lenient runtime path)", () => {
  it("returns disabled defaults when nothing is configured", () => {
    const settings = readAdvertisingSettings(asEnv({}));
    expect(settings.enabled).toBe(false);
    expect(settings.providerQuery).toBeNull();
    expect(settings.consentRequired).toBe(false);
    expect(settings.placements).toEqual(AD_PLACEMENTS.map((p) => p.id));
  });

  it("reads the opt-in switch exactly", () => {
    expect(readAdvertisingSettings(asEnv({ MONETIZATION_ENABLED: "true" })).enabled).toBe(true);
    expect(readAdvertisingSettings(asEnv({ MONETIZATION_ENABLED: "1" })).enabled).toBe(false);
    expect(readAdvertisingSettings(asEnv({ MONETIZATION_ENABLED: "false" })).enabled).toBe(false);
  });

  it("normalizes the provider query", () => {
    expect(readAdvertisingSettings(asEnv({ AD_PROVIDER: " house " })).providerQuery).toBe("house");
    expect(readAdvertisingSettings(asEnv({ AD_PROVIDER: "" })).providerQuery).toBeNull();
  });

  it("reads the consent declaration", () => {
    expect(readAdvertisingSettings(asEnv({ AD_CONSENT_REQUIRED: "true" })).consentRequired).toBe(true);
    expect(readAdvertisingSettings(asEnv({ AD_CONSENT_REQUIRED: "false" })).consentRequired).toBe(false);
  });

  it("reads from process.env by default", () => {
    vi.stubEnv("MONETIZATION_ENABLED", "true");
    expect(readAdvertisingSettings().enabled).toBe(true);
  });
});
