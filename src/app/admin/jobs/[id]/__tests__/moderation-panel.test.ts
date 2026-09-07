import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/navigation", () => ({}));

vi.mock("@/lib/auth/context", () => ({}));

vi.mock("@/lib/admin/jobs", () => ({}));

vi.mock("../actions", () => ({
  moderateJobAction: vi.fn(),
}));

import ModerationPanel from "../moderation-panel";

function render(overrides: { status: string; verificationStatus?: string }) {
  return renderToStaticMarkup(
    createElement(ModerationPanel, {
      jobId: "test-job-id",
      status: overrides.status,
      verificationStatus: overrides.verificationStatus ?? "PENDING",
    }),
  );
}

describe("ModerationPanel — Re-verify button", () => {
  it("renders Re-verify when status is PUBLISHED", () => {
    const html = render({ status: "PUBLISHED" });
    expect(html).toContain("Re-verify");
    expect(html).toContain('value="REVERIFY"');
  });

  it("does NOT render Re-verify when status is DRAFT", () => {
    const html = render({ status: "DRAFT" });
    expect(html).not.toContain("Re-verify");
    expect(html).not.toContain("REVERIFY");
  });

  it("does NOT render Re-verify when status is PENDING_REVIEW", () => {
    const html = render({ status: "PENDING_REVIEW" });
    expect(html).not.toContain("Re-verify");
    expect(html).not.toContain("REVERIFY");
  });

  it("does NOT render Re-verify when status is EXPIRED", () => {
    const html = render({ status: "EXPIRED" });
    expect(html).not.toContain("Re-verify");
    expect(html).not.toContain("REVERIFY");
  });

  it("does NOT render Re-verify when status is REMOVED", () => {
    const html = render({ status: "REMOVED" });
    expect(html).not.toContain("Re-verify");
    expect(html).not.toContain("REVERIFY");
  });

  it("always renders existing Publish, Reject, Mark invalid, Request review actions", () => {
    const html = render({ status: "DRAFT" });
    expect(html).toContain('value="PUBLISH"');
    expect(html).toContain('value="REJECT"');
    expect(html).toContain('value="MARK_INVALID"');
    expect(html).toContain('value="REQUEST_REVIEW"');
    expect(html).toContain("Publish");
    expect(html).toContain("Reject");
    expect(html).toContain("Mark invalid");
    expect(html).toContain("Request review");
  });

  it("Re-verify form has hidden jobId input", () => {
    const html = render({ status: "PUBLISHED" });
    expect(html).toContain('name="jobId" value="test-job-id"');
  });

  it("Re-verify button has accessible label", () => {
    const html = render({ status: "PUBLISHED" });
    expect(html).toContain('aria-label="Re-verify job"');
  });

  it("Re-verify button is in a form with action input", () => {
    const html = render({ status: "PUBLISHED" });
    expect(html).toContain('name="action" value="REVERIFY"');
  });

  it("shows current status and verification in header", () => {
    const html = render({ status: "PUBLISHED", verificationStatus: "VERIFIED" });
    expect(html).toContain("PUBLISHED");
    expect(html).toContain("VERIFIED");
  });

  it("Re-verify button is enabled in the initial non-pending render", () => {
    const html = render({ status: "PUBLISHED" });
    const buttonTag = html.match(/<button[^>]*aria-label="Re-verify job"[^>]*>/)?.[0] ?? "";
    expect(buttonTag).toContain("aria-label=\"Re-verify job\"");
    expect(buttonTag).not.toMatch(/\bdisabled=/);
  });

  it("wires disabled pending styles for Re-verify (loading state convention)", () => {
    const html = render({ status: "PUBLISHED" });
    const buttonTag = html.match(/<button[^>]*aria-label="Re-verify job"[^>]*>/)?.[0] ?? "";
    expect(buttonTag).toContain("disabled:cursor-not-allowed");
    expect(buttonTag).toContain("disabled:opacity-50");
  });

  it("uses the shared server action wiring for the Re-verify form", () => {
    const html = render({ status: "PUBLISHED" });
    const reForm = html.match(
      /<form[^>]*>[\s\S]*?value="REVERIFY"[\s\S]*?aria-label="Re-verify job"/,
    );
    expect(reForm).not.toBeNull();
  });

  it("renders no error feedback in the happy-path initial state", () => {
    const html = render({ status: "PUBLISHED" });
    expect(html).not.toContain("role=\"alert\"");
  });
});
