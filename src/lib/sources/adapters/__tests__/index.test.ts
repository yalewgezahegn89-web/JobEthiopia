import { describe, it, expect } from "vitest";
import {
  getAdapterForSource,
  getAdapterForSourceRecord,
  SUPPORTED_ADAPTER_SOURCE_TYPES,
  SWEEP_SOURCE_TYPES,
} from "../index";

describe("adapter registry", () => {
  it("adapts every type listed as supported", () => {
    for (const type of SUPPORTED_ADAPTER_SOURCE_TYPES) {
      expect(getAdapterForSource(type)).toBeTruthy();
    }
  });

  it("does not adapt types outside the supported list", () => {
    expect(getAdapterForSource("X")).toBeNull();
  });

  it("keeps the supported list aligned with the due-sweep source types (API and FEED only)", () => {
    expect([...SUPPORTED_ADAPTER_SOURCE_TYPES].sort()).toEqual(["API", "FEED"]);
  });

  it("pins the non-adapted types that must flow through manual pipelines", () => {
    for (const type of [
      "MANUAL",
      "WEBSITE",
      "EMPLOYER",
      "OTHER",
      "FACEBOOK",
    ]) {
      expect(getAdapterForSource(type)).toBeNull();
    }
  });

  it("sweeps API, FEED, host-checked WEBSITE and Facebook Page sources", () => {
    expect([...SWEEP_SOURCE_TYPES].sort()).toEqual([
      "API",
      "FACEBOOK",
      "FEED",
      "WEBSITE",
    ]);
  });
});

describe("source-record adapter resolution", () => {
  it("resolves API and FEED sources by type", () => {
    for (const sourceType of ["API", "FEED"]) {
      expect(
        getAdapterForSourceRecord({ sourceType, baseUrl: null }),
      ).toBeTruthy();
    }
  });

  it("only adapts WEBSITE sources on approved airline hosts", () => {
    expect(
      getAdapterForSourceRecord({
        sourceType: "WEBSITE",
        baseUrl: "https://www.ethiopianairlines.com/corporate/careers",
      }),
    ).toBeTruthy();
    expect(
      getAdapterForSourceRecord({
        sourceType: "WEBSITE",
        baseUrl: "https://www.emiratesgroupcareers.com/",
      }),
    ).toBeNull();
    expect(
      getAdapterForSourceRecord({
        sourceType: "WEBSITE",
        baseUrl: "https://example.com/careers",
      }),
    ).toBeNull();
    expect(
      getAdapterForSourceRecord({
        sourceType: "WEBSITE",
        baseUrl: "not a url",
      }),
    ).toBeNull();
  });

  it("never adapts manual source types", () => {
    for (const sourceType of ["MANUAL", "EMPLOYER", "OTHER"]) {
      expect(
        getAdapterForSourceRecord({
          sourceType,
          baseUrl: "https://www.ethiopianairlines.com/careers",
        }),
      ).toBeNull();
    }
  });

  it("resolves FACEBOOK sources to the Facebook Page adapter", () => {
    expect(
      getAdapterForSourceRecord({
        sourceType: "FACEBOOK",
        baseUrl: "https://www.facebook.com/example",
      }),
    ).toBeTruthy();
  });
});