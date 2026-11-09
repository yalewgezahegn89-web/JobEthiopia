import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockSource: vi.fn(),
  mockEnabled: vi.fn(),
  mockOwnedToken: vi.fn(),
  mockExternalToken: vi.fn(),
  mockPosts: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      sources: {
        findFirst: (...args: unknown[]) => mocks.mockSource(...args),
      },
    },
  },
}));

vi.mock("@/lib/facebook/config", () => ({
  isFacebookIngestionEnabled: () => mocks.mockEnabled(),
  getOwnedPageAccessToken: () => mocks.mockOwnedToken(),
  getExternalPageAccessToken: () => mocks.mockExternalToken(),
}));

vi.mock("@/lib/facebook/graphClient", () => ({
  fetchPagePosts: (...args: unknown[]) => mocks.mockPosts(...args),
}));

import { FacebookPageAdapter } from "../facebookPage";

const SOURCE = {
  id: "source-1",
  name: "Example Page",
  sourceType: "FACEBOOK",
  facebookPageId: "page-1",
  facebookPageKind: "OWNED_PAGE",
  facebookApprovalState: "NOT_REQUESTED",
  facebookContentUseState: "NOT_RECORDED",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockSource.mockResolvedValue(SOURCE);
  mocks.mockEnabled.mockReturnValue(true);
  mocks.mockOwnedToken.mockReturnValue({
    ok: true,
    accessToken: "page-token",
  });
  mocks.mockExternalToken.mockReturnValue({
    ok: true,
    accessToken: "app-token",
  });
  mocks.mockPosts.mockResolvedValue({
    ok: true,
    data: {
      truncated: false,
      posts: [
        {
          id: "post-1",
          message: [
            "Job Title: Driver",
            "Location: Addis Ababa",
            "Deadline: 2026-03-01",
            "Apply: https://example.com/driver",
          ].join("\n"),
        },
        { id: "post-2", message: "Join our webinar!" },
      ],
    },
  });
});

describe("FacebookPageAdapter", () => {
  it("refuses to run while the feature flag is disabled", async () => {
    mocks.mockEnabled.mockReturnValue(false);

    const result = await new FacebookPageAdapter().fetchJobs("source-1");

    expect(result.success).toBe(false);
    expect(mocks.mockSource).not.toHaveBeenCalled();
  });

  it("blocks external Pages without approval and authorization", async () => {
    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      facebookPageKind: "EXTERNAL_PAGE",
    });

    const result = await new FacebookPageAdapter().fetchJobs("source-1");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("approval");
    expect(mocks.mockPosts).not.toHaveBeenCalled();
  });

  it("reads owned Pages and reports observed and review items", async () => {
    const result = await new FacebookPageAdapter().fetchJobs("source-1");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(mocks.mockPosts).toHaveBeenCalledWith("page-1", "page-token", {
      limit: 100,
    });
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].externalId).toBe("page-1:post-1");
    expect(result.metadata?.observedExternalIds).toEqual([
      "page-1:post-1",
      "page-1:post-2",
    ]);
    expect(result.metadata?.reviewItems?.[0].externalId).toBe(
      "page-1:post-1",
    );
  });

  it("allows an approved external Page with documented authorization", async () => {
    mocks.mockSource.mockResolvedValue({
      ...SOURCE,
      facebookPageKind: "EXTERNAL_PAGE",
      facebookApprovalState: "APPROVED",
      facebookContentUseState: "AUTHORIZED",
    });

    const result = await new FacebookPageAdapter().fetchJobs("source-1");

    expect(result.success).toBe(true);
    expect(mocks.mockExternalToken).toHaveBeenCalled();
  });

  it("rejects a non-Facebook source record", async () => {
    mocks.mockSource.mockResolvedValue({ ...SOURCE, sourceType: "WEBSITE" });

    const result = await new FacebookPageAdapter().fetchJobs("source-1");

    expect(result.success).toBe(false);
  });
});
