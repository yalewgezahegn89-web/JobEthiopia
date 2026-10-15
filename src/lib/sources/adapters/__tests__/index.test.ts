import { describe, it, expect } from "vitest";
import {
  getAdapterForSource,
  SUPPORTED_ADAPTER_SOURCE_TYPES,
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
    for (const type of ["MANUAL", "WEBSITE", "EMPLOYER", "OTHER"]) {
      expect(getAdapterForSource(type)).toBeNull();
    }
  });
});