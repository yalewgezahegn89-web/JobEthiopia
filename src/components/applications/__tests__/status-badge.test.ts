import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationStatusBadge } from "../status-badge";
import { ApplicationStatusProgress } from "../status-progress";

describe("ApplicationStatusBadge", () => {
  it.each([
    ["SUBMITTED", "Submitted"],
    ["REVIEWING", "Reviewing"],
    ["SHORTLISTED", "Shortlisted"],
    ["REJECTED", "Rejected"],
    ["WITHDRAWN", "Withdrawn"],
  ] as const)("renders the %s label", (status, label) => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusBadge, { status }),
    );
    expect(html).toContain(label);
  });

  it("renders a meaningful status label by text, not colour alone", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusBadge, { status: "SHORTLISTED" }),
    );
    expect(html).toContain("Shortlisted");
  });
});

describe("ApplicationStatusProgress", () => {
  it("renders a three-step progress list for active statuses", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusProgress, { status: "REVIEWING" }),
    );
    expect(html).toContain('aria-label="Application progress"');
    expect(html).toContain("Submitted");
    expect(html).toContain("Reviewing");
    expect(html).toContain("Shortlisted");
  });

  it("marks the current step", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusProgress, { status: "SHORTLISTED" }),
    );
    expect(html).toContain("Shortlisted");
    expect(html).toContain("Current step");
  });

  it("renders a terminal state instead of a progress list for REJECTED", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusProgress, { status: "REJECTED" }),
    );
    expect(html).toContain("Rejected");
    expect(html).not.toContain("Application progress");
    expect(html).toContain('role="status"');
  });

  it("renders a terminal state instead of a progress list for WITHDRAWN", () => {
    const html = renderToStaticMarkup(
      createElement(ApplicationStatusProgress, { status: "WITHDRAWN" }),
    );
    expect(html).toContain("Withdrawn");
    expect(html).not.toContain("Application progress");
  });
});