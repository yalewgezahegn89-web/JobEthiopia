import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getAdConsentRequirement,
  isAdRenderingPermitted,
  isConsentRequiredFor,
  readConsentConfig,
} from "../consent";

afterEach(() => {
  vi.unstubAllEnvs();
});

const NON_TRACKING = { tracking: false };
const TRACKING = { tracking: true };

describe("readConsentConfig", () => {
  it("defaults to consent not required", () => {
    delete process.env.AD_CONSENT_REQUIRED;
    expect(readConsentConfig()).toEqual({ required: false });
  });

  it("reads the opt-in declaration", () => {
    vi.stubEnv("AD_CONSENT_REQUIRED", "true");
    expect(readConsentConfig()).toEqual({ required: true });
    vi.stubEnv("AD_CONSENT_REQUIRED", "false");
    expect(readConsentConfig()).toEqual({ required: false });
  });
});

describe("isConsentRequiredFor", () => {
  it("never requires consent for non-tracking providers", () => {
    vi.stubEnv("AD_CONSENT_REQUIRED", "true");
    expect(isConsentRequiredFor(NON_TRACKING)).toBe(false);
  });

  it("requires consent for tracking providers only when declared", () => {
    delete process.env.AD_CONSENT_REQUIRED;
    expect(isConsentRequiredFor(TRACKING)).toBe(false);

    vi.stubEnv("AD_CONSENT_REQUIRED", "true");
    expect(isConsentRequiredFor(TRACKING)).toBe(true);
  });
});

describe("getAdConsentRequirement / isAdRenderingPermitted", () => {
  it("permits non-tracking providers unconditionally", () => {
    expect(getAdConsentRequirement(NON_TRACKING)).toEqual({
      required: false,
      satisfied: true,
    });
    expect(isAdRenderingPermitted(NON_TRACKING)).toBe(true);
  });

  it("permits tracking providers when consent is not declared required", () => {
    delete process.env.AD_CONSENT_REQUIRED;
    expect(getAdConsentRequirement(TRACKING)).toEqual({
      required: false,
      satisfied: true,
    });
    expect(isAdRenderingPermitted(TRACKING)).toBe(true);
  });

  it("fails closed for tracking providers when consent IS required but no consent source exists", () => {
    vi.stubEnv("AD_CONSENT_REQUIRED", "true");
    expect(getAdConsentRequirement(TRACKING)).toEqual({
      required: true,
      satisfied: false,
    });
    expect(isAdRenderingPermitted(TRACKING)).toBe(false);
  });
});
