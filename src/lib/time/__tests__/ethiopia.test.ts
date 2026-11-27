import { describe, it, expect } from "vitest";
import {
  formatEthiopiaDateTime,
  parseEthiopiaDateTime,
  toEthiopiaDateTimeInput,
} from "../ethiopia";

describe("formatEthiopiaDateTime", () => {
  it("renders a UTC instant in Ethiopia Time with an EAT label", () => {
    expect(formatEthiopiaDateTime("2026-11-19T20:55:00.000Z")).toBe(
      "19 Nov 2026, 23:55 EAT",
    );
  });

  it("does not depend on the server timezone", () => {
    expect(formatEthiopiaDateTime(new Date("2026-01-01T21:30:00.000Z"))).toBe(
      "02 Jan 2026, 00:30 EAT",
    );
  });

  it("returns n/a for missing or invalid values", () => {
    expect(formatEthiopiaDateTime("not-a-date")).toBe("n/a");
  });
});

describe("toEthiopiaDateTimeInput", () => {
  it("converts an instant to the EAT datetime-local value", () => {
    expect(toEthiopiaDateTimeInput("2026-11-19T20:55:00.000Z")).toBe(
      "2026-11-19T23:55",
    );
  });

  it("handles the EAT day rollover at midnight", () => {
    expect(toEthiopiaDateTimeInput("2026-01-01T21:30:00.000Z")).toBe(
      "2026-01-02T00:30",
    );
  });

  it("returns an empty string for null or invalid values", () => {
    expect(toEthiopiaDateTimeInput(null)).toBe("");
    expect(toEthiopiaDateTimeInput("nope")).toBe("");
  });
});

describe("parseEthiopiaDateTime", () => {
  it("parses a datetime-local value as fixed UTC+03:00", () => {
    expect(parseEthiopiaDateTime("2026-11-19T23:55")?.toISOString()).toBe(
      "2026-11-19T20:55:00.000Z",
    );
  });

  it("accepts an optional seconds component", () => {
    expect(parseEthiopiaDateTime("2026-11-19T23:55:30")?.toISOString()).toBe(
      "2026-11-19T20:55:30.000Z",
    );
  });

  it.each([
    "",
    "2026-11-19",
    "2026-11-19 23:55",
    "19/11/2026 23:55",
    "2026-02-31T10:00",
    "2026-11-19T24:00",
    "2026-11-19T23:60",
  ])("rejects malformed or impossible input %s", (value) => {
    expect(parseEthiopiaDateTime(value)).toBeNull();
  });

  it("round-trips with toEthiopiaDateTimeInput", () => {
    const parsed = parseEthiopiaDateTime("2026-11-19T23:55");
    expect(parsed).not.toBeNull();
    expect(toEthiopiaDateTimeInput(parsed as Date)).toBe("2026-11-19T23:55");
  });
});
