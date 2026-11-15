import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockModerateJob: vi.fn(),
  mockAssignJobCategory: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.mockRevalidatePath(...args),
}));

vi.mock("@/lib/auth/context", () => ({
  requireStaffAdmin: () => mocks.mockGuard(),
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: () => mocks.mockCsrf(),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/admin/jobs", () => ({
  moderateJob: (...args: unknown[]) => mocks.mockModerateJob(...args),
  assignJobCategory: (...args: unknown[]) => mocks.mockAssignJobCategory(...args),
}));

import {
  moderateJobAction,
  assignJobCategoryAction,
} from "@/app/admin/jobs/actions";

const INITIAL: { ok: boolean } = { ok: false };

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("jobId", overrides.jobId ?? "11111111-1111-4111-8111-111111111111");
  fd.set("action", overrides.action ?? "PUBLISH");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockModerateJob.mockResolvedValue({ ok: true, state: { toStatus: "PUBLISHED" } });
  mocks.mockAssignJobCategory.mockResolvedValue({
    ok: true,
    categoryId: "22222222-2222-4222-8222-222222222222",
  });
});

describe("moderateJobAction", () => {
  it("performs moderation with the actor id from session", async () => {
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(true);
    expect(mocks.mockModerateJob).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "PUBLISH",
      "actor-1",
    );
  });

  it("rejects a non-staff user with a redirect (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({
      ok: false,
      status: 403,
    });
    await expect(moderateJobAction(INITIAL,form())).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(moderateJobAction(INITIAL,form())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns a safe generic error for an invalid job id", async () => {
    const result = await moderateJobAction(INITIAL,form({ jobId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("not-a-uuid");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("rejects an unknown action enum", async () => {
    const result = await moderateJobAction(INITIAL,form({ action: "HACK_DB" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns a safe generic error when CSRF origin validation fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
    expect(result.error).not.toContain("origin");
  });

  it("returns a safe generic error when moderation reports NOT_FOUND", async () => {
    mocks.mockModerateJob.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
  });

  it("returns a safe generic error when moderation reports FORBIDDEN transition", async () => {
    mocks.mockModerateJob.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const result = await moderateJobAction(INITIAL,form());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("REMOVED");
  });

  it("returns a safe generic error on an unexpected DB failure without a stack", async () => {
    mocks.mockModerateJob.mockRejectedValue(new Error("connection refused: 10.0.0.1"));
    const result = await moderateJobAction(INITIAL, form());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("connection");
  });
});

describe("moderateJobAction — REVERIFY", () => {
  it("accepts REVERIFY as a valid action", async () => {
    mocks.mockModerateJob.mockResolvedValue({
      ok: true,
      state: { toStatus: "PUBLISHED" },
    });
    const result = await moderateJobAction(INITIAL, form({ action: "REVERIFY" }));
    expect(result.ok).toBe(true);
    expect(mocks.mockModerateJob).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "REVERIFY",
      "actor-1",
    );
  });

  it("passes the actor id from session (not from form data)", async () => {
    mocks.mockModerateJob.mockResolvedValue({
      ok: true,
      state: { toStatus: "PUBLISHED" },
    });
    await moderateJobAction(INITIAL, form({ action: "REVERIFY" }));
    expect(mocks.mockModerateJob).toHaveBeenCalledWith(
      expect.any(String),
      "REVERIFY",
      "actor-1",
    );
  });

  it("rejects unauthenticated users (redirect to /login)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      moderateJobAction(INITIAL, form({ action: "REVERIFY" })),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("rejects non-staff users (redirect to /admin/jobs)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      moderateJobAction(INITIAL, form({ action: "REVERIFY" })),
    ).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns generic error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await moderateJobAction(INITIAL, form({ action: "REVERIFY" }));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
  });

  it("returns generic error for invalid job ID", async () => {
    const result = await moderateJobAction(
      INITIAL,
      form({ action: "REVERIFY", jobId: "not-a-uuid" }),
    );
    expect(result.ok).toBe(false);
    expect(mocks.mockModerateJob).not.toHaveBeenCalled();
  });

  it("returns generic error when moderation reports FORBIDDEN (non-PUBLISHED)", async () => {
    mocks.mockModerateJob.mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    const result = await moderateJobAction(INITIAL, form({ action: "REVERIFY" }));
    expect(result.ok).toBe(false);
  });

  it("returns generic error when moderation throws", async () => {
    mocks.mockModerateJob.mockRejectedValue(new Error("Moderation update failed"));
    const result = await moderateJobAction(INITIAL, form({ action: "REVERIFY" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("client cannot control timestamp (no timestamp in form data)", async () => {
    mocks.mockModerateJob.mockResolvedValue({
      ok: true,
      state: { toStatus: "PUBLISHED" },
    });
    const fd = form({ action: "REVERIFY" });
    fd.set("lastVerifiedAt", "2020-01-01T00:00:00.000Z");
    const result = await moderateJobAction(INITIAL, fd);
    expect(result.ok).toBe(true);
    // moderateJobAction only passes (jobId, action, actor.id) — no timestamp
    expect(mocks.mockModerateJob).toHaveBeenCalledWith(
      expect.any(String),
      "REVERIFY",
      "actor-1",
    );
  });
});

describe("assignJobCategoryAction", () => {
  const JOB_ID = "11111111-1111-4111-8111-111111111111";
  const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

  function assignForm(overrides: Record<string, string> = {}): FormData {
    const fd = new FormData();
    fd.set("jobId", overrides.jobId ?? JOB_ID);
    fd.set("categoryId", overrides.categoryId ?? CATEGORY_ID);
    return fd;
  }

  it("assigns the category with the session actor id and revalidates", async () => {
    const result = await assignJobCategoryAction(INITIAL, assignForm());

    expect(result.ok).toBe(true);
    expect(mocks.mockAssignJobCategory).toHaveBeenCalledWith(
      JOB_ID,
      CATEGORY_ID,
      "actor-1",
    );
    expect(mocks.mockRevalidatePath).toHaveBeenCalledWith(
      `/admin/jobs/${JOB_ID}`,
    );
    expect(mocks.mockRevalidatePath).toHaveBeenCalledWith("/admin/jobs");
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      assignJobCategoryAction(INITIAL, assignForm()),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockAssignJobCategory).not.toHaveBeenCalled();
  });

  it("redirects non-staff users to /admin/jobs", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      assignJobCategoryAction(INITIAL, assignForm()),
    ).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockAssignJobCategory).not.toHaveBeenCalled();
  });

  it("returns a safe generic error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await assignJobCategoryAction(INITIAL, assignForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("CSRF");
    expect(mocks.mockAssignJobCategory).not.toHaveBeenCalled();
  });

  it("rejects invalid job and category ids before calling the service", async () => {
    const badJob = await assignJobCategoryAction(
      INITIAL,
      assignForm({ jobId: "not-a-uuid" }),
    );
    const badCategory = await assignJobCategoryAction(
      INITIAL,
      assignForm({ categoryId: "not-a-uuid" }),
    );
    expect(badJob.ok).toBe(false);
    expect(badCategory.ok).toBe(false);
    expect(mocks.mockAssignJobCategory).not.toHaveBeenCalled();
  });

  it("maps NOT_DRAFT to a clear safe error", async () => {
    mocks.mockAssignJobCategory.mockResolvedValue({
      ok: false,
      code: "NOT_DRAFT",
    });
    const result = await assignJobCategoryAction(INITIAL, assignForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("draft");
  });

  it("maps ALREADY_ASSIGNED to a clear safe error (no overwrite)", async () => {
    mocks.mockAssignJobCategory.mockResolvedValue({
      ok: false,
      code: "ALREADY_ASSIGNED",
    });
    const result = await assignJobCategoryAction(INITIAL, assignForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already has a category");
  });

  it.each(["CATEGORY_NOT_FOUND", "CATEGORY_INACTIVE"])(
    "maps %s to a safe invalid-category error",
    async (code) => {
      mocks.mockAssignJobCategory.mockResolvedValue({ ok: false, code });
      const result = await assignJobCategoryAction(INITIAL, assignForm());
      expect(result.ok).toBe(false);
      expect(result.error).toContain("active category");
    },
  );

  it("does not leak internal details for NOT_FOUND or unexpected failures", async () => {
    mocks.mockAssignJobCategory.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
    });
    const notFound = await assignJobCategoryAction(INITIAL, assignForm());
    expect(notFound.ok).toBe(false);
    expect(notFound.error).not.toContain(JOB_ID);

    mocks.mockAssignJobCategory.mockRejectedValue(
      new Error("connection refused: 10.0.0.1"),
    );
    const failed = await assignJobCategoryAction(INITIAL, assignForm());
    expect(failed.ok).toBe(false);
    expect(failed.error).not.toContain("connection");
  });

  it("never reads or forwards client-controlled lifecycle fields", async () => {
    const fd = assignForm();
    fd.set("status", "PUBLISHED");
    fd.set("verificationStatus", "VERIFIED");
    fd.set("organizationId", "99999999-9999-4999-8999-999999999999");
    fd.set("sourceId", "88888888-8888-4888-8888-888888888888");

    const result = await assignJobCategoryAction(INITIAL, fd);

    expect(result.ok).toBe(true);
    expect(mocks.mockAssignJobCategory).toHaveBeenCalledWith(
      JOB_ID,
      CATEGORY_ID,
      "actor-1",
    );
    expect(mocks.mockAssignJobCategory).toHaveBeenCalledTimes(1);
  });
});
