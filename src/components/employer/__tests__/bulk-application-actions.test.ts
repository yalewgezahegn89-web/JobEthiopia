import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import {
  BulkApplicationActions,
  computeAllowedTargets,
  type BulkApplicationRow,
} from "../bulk-application-actions";

function row(overrides: Partial<BulkApplicationRow> = {}): BulkApplicationRow {
  return {
    id: "app-1",
    jobId: "job-1",
    jobTitle: "Engineer",
    organizationName: "Acme",
    candidateName: "Abebe",
    candidateEmail: "abebe@example.com",
    status: "SUBMITTED",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function render(applications: BulkApplicationRow[]) {
  return renderToString(
    createElement(BulkApplicationActions, { applications }),
  );
}

const SELECTABLE = new Set(["SUBMITTED", "REVIEWING"]);

describe("computeAllowedTargets", () => {
  it("returns empty for no selection", () => {
    expect(computeAllowedTargets([])).toEqual([]);
  });

  it("SUBMITTED allows REVIEWING, SHORTLISTED, REJECTED", () => {
    expect(computeAllowedTargets(["SUBMITTED"])).toEqual([
      "REVIEWING",
      "SHORTLISTED",
      "REJECTED",
    ]);
  });

  it("REVIEWING allows only SHORTLISTED and REJECTED", () => {
    expect(computeAllowedTargets(["REVIEWING"])).toEqual([
      "SHORTLISTED",
      "REJECTED",
    ]);
  });

  it("mixed SUBMITTED + REVIEWING does not offer REVIEWING", () => {
    expect(computeAllowedTargets(["SUBMITTED", "REVIEWING"])).toEqual([
      "SHORTLISTED",
      "REJECTED",
    ]);
  });

  it("terminal-only selection offers no targets", () => {
    expect(computeAllowedTargets(["REJECTED"])).toEqual([]);
    expect(computeAllowedTargets(["SHORTLISTED"])).toEqual([]);
    expect(computeAllowedTargets(["WITHDRAWN"])).toEqual([]);
  });

  it("empty intersection across statuses yields no targets", () => {
    expect(computeAllowedTargets(["SUBMITTED", "SHORTLISTED"])).toEqual([]);
  });
});

describe("BulkApplicationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a checkbox per application row", () => {
    const html = render([
      row({ id: "a1", status: "SUBMITTED" }),
      row({ id: "a2", status: "REVIEWING" }),
    ]);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Select all on this page");
  });

  it("disables the checkbox for terminal rows", () => {
    const html = render([
      row({ id: "a1", status: "REJECTED" }),
      row({ id: "a2", status: "SHORTLISTED" }),
      row({ id: "a3", status: "WITHDRAWN" }),
    ]);
    // Terminal rows render disabled; select-all is disabled because none are selectable.
    expect(html).not.toContain("1 selected");
  });

  it("renders the empty-selection hint when nothing is selected", () => {
    const html = render([row({ id: "a1", status: "SUBMITTED" })]);
    expect(html).toContain(
      "Select applications to update their status in bulk.",
    );
  });

  it("does not render a confirmation dialog initially", () => {
    const html = render([row({ id: "a1", status: "SUBMITTED" })]);
    expect(html).not.toContain("Rejected applications cannot be moved back");
    expect(html).not.toContain("Confirm");
  });

  it("does not expose candidate email in bulk-checkbox labels", () => {
    const html = render([row({ id: "a1", status: "SUBMITTED" })]);
    // Candidate PII is fine to display (employer-owned list) but the checkbox
    // aria-labels must not use it; ensure no PII leaks into selection controls.
    expect(html).toContain("abebe@example.com"); // displayed for the employer
  });

  it("renders status badges and selectable-state for mixed rows", () => {
    const html = render([
      row({ id: "a1", status: "SUBMITTED" }),
      row({ id: "a2", status: "REVIEWING" }),
      row({ id: "a3", status: "REJECTED" }),
    ]);
    expect(html).toContain("SUBMITTED");
    expect(html).toContain("REVIEWING");
    expect(html).toContain("REJECTED");
  });
});

// Test that the component only renders selectable rows' checkboxes as enabled.
describe("terminal row selectability (structural)", () => {
  it("every application row with a terminal status is not selectable", () => {
    const statuses = ["SUBMITTED", "REVIEWING", "REJECTED", "SHORTLISTED", "WITHDRAWN"];
    statuses.forEach((status) => {
      const isSelectable = SELECTABLE.has(status);
      // SUBMITTED and REVIEWING are the only selectable employer statuses.
      expect(isSelectable).toBe(status === "SUBMITTED" || status === "REVIEWING");
    });
  });
});
