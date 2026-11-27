import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockPublish: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/facebook/publishing", () => ({
  publishJobToOwnedFacebookPage: (...args: unknown[]) =>
    mocks.mockPublish(...args),
}));

import { publishJobToFacebookAction } from "@/app/admin/jobs/actions";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR = {
  id: "actor-1",
  email: "admin@example.com",
  name: "Admin",
  role: "SUPER_ADMIN",
};
const INITIAL = { ok: true };

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("jobId", overrides.jobId ?? JOB_ID);
  if (overrides.confirmContentRights !== undefined) {
    fd.set("confirmContentRights", overrides.confirmContentRights);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({ ok: true, user: ACTOR });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockPublish.mockResolvedValue({
    published: true,
    reason: "PUBLISHED",
    postId: "999",
  });
});

describe("publishJobToFacebookAction", () => {
  it("delegates to the publishing service with the session actor", async () => {
    const result = await publishJobToFacebookAction(INITIAL, form({ confirmContentRights: "on" }));

    expect(result).toEqual({ ok: true, postId: "999", outcome: "PUBLISHED" });
    expect(mocks.mockPublish).toHaveBeenCalledWith(
      ACTOR,
      JOB_ID,
      { contentRightsConfirmed: true },
    );
  });

  it("rejects a missing rights confirmation before calling the service", async () => {
    const result = await publishJobToFacebookAction(INITIAL, form({}));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("right to redistribute");
    expect(mocks.mockPublish).not.toHaveBeenCalled();
  });

  it("returns a safe error for an invalid job id", async () => {
    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ jobId: "not-a-uuid", confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("not-a-uuid");
    expect(mocks.mockPublish).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      publishJobToFacebookAction(INITIAL, form({ confirmContentRights: "on" })),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockPublish).not.toHaveBeenCalled();
  });

  it("redirects non-staff users away from the admin area", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      publishJobToFacebookAction(INITIAL, form({ confirmContentRights: "on" })),
    ).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockPublish).not.toHaveBeenCalled();
  });

  it("returns a safe error when CSRF origin validation fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
    expect(result.error).not.toContain("origin");
    expect(mocks.mockPublish).not.toHaveBeenCalled();
  });

  it("maps a forbidden role to a clear message", async () => {
    mocks.mockPublish.mockResolvedValue({
      published: false,
      reason: "FORBIDDEN",
    });

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not allowed");
    expect(result.outcome).toBe("FAILED");
  });

  it("maps the production-only publishing guard", async () => {
    mocks.mockPublish.mockResolvedValue({
      published: false,
      reason: "LIVE_PUBLISHING_DISABLED",
    });

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("outside Production");
    expect(result.outcome).toBe("FAILED");
  });

  it("maps the disabled feature flag without exposing configuration", async () => {
    mocks.mockPublish.mockResolvedValue({
      published: false,
      reason: "FACEBOOK_PUBLISHING_DISABLED",
    });

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not enabled");
  });

  it("maps an ambiguous outcome to the UNKNOWN outcome", async () => {
    mocks.mockPublish.mockResolvedValue({
      published: false,
      reason: "UNKNOWN_OUTCOME",
      error: "Request timed out",
    });

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe("UNKNOWN");
    expect(result.error).toContain("unclear");
  });

  it("redacts credential material from surfaced graph errors", async () => {
    mocks.mockPublish.mockResolvedValue({
      published: false,
      reason: "GRAPH_REJECTED",
      error: "Graph error containing access_token=super-secret-value Bearer super-secret-value",
    });

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("super-secret-value");
    expect(result.error).toContain("[REDACTED]");
  });

  it("returns a safe generic error when the service throws", async () => {
    mocks.mockPublish.mockRejectedValue(
      new Error("connection refused: 10.0.0.1"),
    );

    const result = await publishJobToFacebookAction(
      INITIAL,
      form({ confirmContentRights: "on" }),
    );

    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("connection");
  });
});
