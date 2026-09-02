import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import JobsList from "../jobs-list";

function row(status: string, verificationStatus: string, title = "Job") {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title,
    slug: "job",
    status,
    verificationStatus,
    postedAt: "2026-01-01T00:00:00.000Z",
    deadline: null,
    lastVerifiedAt: null,
    organizationName: "Org",
    categoryName: null,
    professionName: null,
    locationName: null,
    sourceName: null,
  };
}

function resultFor(...rows: ReturnType<typeof row>[]) {
  return { items: rows, page: 1, limit: 20, total: rows.length, totalPages: 1 };
}

describe("Admin jobs moderation status mappings (preserved)", () => {
  it("maps review states to warning, verified/published to success, invalid/removed to destructive", () => {
    const html = renderToStaticMarkup(
      createElement(JobsList, {
        result: resultFor(
          row("PENDING_REVIEW", "NEEDS_REVIEW", "Review me"),
          row("PUBLISHED", "VERIFIED", "Live"),
          row("REMOVED", "INVALID", "Gone"),
        ),
        currentStatus: undefined,
        currentVerification: undefined,
      }),
    );

    // review -> warning
    expect(html).toMatch(/Review me[\s\S]*?bg-warning-light/);
    expect(html).toMatch(/Review me[\s\S]*?bg-warning-light/);
    // verified live -> success
    expect(html).toMatch(/Live[\s\S]*?bg-success-light/);
    // removed/invalid -> destructive
    expect(html).toMatch(/Gone[\s\S]*?bg-destructive-light/);
  });

  it("keeps all moderation status values and labels renderable", () => {
    const html = renderToStaticMarkup(
      createElement(JobsList, {
        result: resultFor(
          row("PENDING_REVIEW", "PENDING"),
          row("DRAFT", "INVALID"),
          row("EXPIRED", "NEEDS_REVIEW"),
        ),
        currentStatus: undefined,
        currentVerification: undefined,
      }),
    );
    for (const s of ["PENDING_REVIEW", "DRAFT", "EXPIRED", "PENDING", "INVALID", "NEEDS_REVIEW"]) {
      expect(html).toContain(s);
    }
  });

  it("preserves the moderation filter labels and action label", () => {
    const html = renderToStaticMarkup(
      createElement(JobsList, {
        result: resultFor(row("PENDING_REVIEW", "PENDING")),
        currentStatus: "PENDING_REVIEW",
        currentVerification: "PENDING",
      }),
    );
    expect(html).toContain("Filter");
    expect(html).toContain("Status");
    expect(html).toContain("Verification");
    expect(html).toContain("selected");
  });
});
