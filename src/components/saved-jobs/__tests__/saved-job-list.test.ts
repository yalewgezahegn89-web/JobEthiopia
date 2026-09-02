import { describe, it, expect, vi, beforeEach } from "vitest";import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

import { SavedJobList } from "../saved-job-list";
import type { SavedJobListItem } from "@/lib/savedJobs/dal";

function item(overrides: Partial<SavedJobListItem> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    jobId: "22222222-2222-4222-8222-222222222222",
    title: "Accountant",
    slug: "accountant",
    organizationName: "ACME Plc",
    locationName: "Addis Ababa",
    deadline: "2026-12-01T00:00:00.000Z",
    jobStatus: "PUBLISHED",
    savedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function render(items: SavedJobListItem[]) {
  return renderToStaticMarkup(createElement(SavedJobList, { items }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SavedJobList", () => {
  it("renders an active saved job with an Active badge and its title link", () => {
    const html = render([item()]);
    expect(html).toContain("Accountant");
    expect(html).toContain('href="/jobs/22222222-2222-4222-8222-222222222222"');
    expect(html).toContain("Active");
    expect(html).toContain("Addis Ababa");
  });

  it("marks a published job closing this week as Closing soon", () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const html = render([item({ deadline: soon })]);
    expect(html).toContain("Closing soon");
  });

  it("marks expired jobs as Expired", () => {
    const html = render([
      item({
        jobStatus: "EXPIRED",
        deadline: "2020-01-01T00:00:00.000Z",
      }),
    ]);
    expect(html).toContain("Expired");
    expect(html).not.toContain("Active");
  });

  it("marks removed jobs as No longer available", () => {
    const html = render([item({ jobStatus: "REMOVED", deadline: null })]);
    expect(html).toContain("No longer available");
    expect(html).not.toContain("Active");
  });

  it("renders a Remove button per item", () => {
    const html = render([item()]);
    const removeCount = (html.match(/Remove/g) ?? []).length;
    expect(removeCount).toBeGreaterThanOrEqual(1);
  });

  it("shows an empty state when there are no saved jobs", () => {
    const html = render([]);
    expect(html).toContain("Your saved jobs will appear here");
    expect(html).toContain("Browse jobs");
  });
});