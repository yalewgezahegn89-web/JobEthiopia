import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockCreateCuratedJob: vi.fn(),
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

vi.mock("@/lib/admin/curatedJobs", () => ({
  createCuratedJob: (...args: unknown[]) => mocks.mockCreateCuratedJob(...args),
}));

import { createCuratedJobAction } from "@/app/admin/jobs/actions";

const INITIAL: { ok: boolean } = { ok: false };
const JOB_ID = "44444444-4444-4444-8444-444444444444";

function createForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("organizationId", overrides.organizationId ?? "11111111-1111-4111-8111-111111111111");
  fd.set("title", overrides.title ?? "Senior Accountant");
  fd.set("description", overrides.description ?? "A detailed accounting role.");
  if (overrides.categoryId !== undefined) fd.set("categoryId", overrides.categoryId);
  if (overrides.professionId !== undefined) fd.set("professionId", overrides.professionId);
  if (overrides.locationId !== undefined) fd.set("locationId", overrides.locationId);
  if (overrides.employmentType !== undefined) fd.set("employmentType", overrides.employmentType);
  if (overrides.experienceMin !== undefined) fd.set("experienceMin", overrides.experienceMin);
  if (overrides.experienceMax !== undefined) fd.set("experienceMax", overrides.experienceMax);
  if (overrides.salaryMin !== undefined) fd.set("salaryMin", overrides.salaryMin);
  if (overrides.salaryMax !== undefined) fd.set("salaryMax", overrides.salaryMax);
  if (overrides.salaryCurrency !== undefined) fd.set("salaryCurrency", overrides.salaryCurrency);
  if (overrides.salaryPeriod !== undefined) fd.set("salaryPeriod", overrides.salaryPeriod);
  if (overrides.deadline !== undefined) fd.set("deadline", overrides.deadline);
  if (overrides.applicationUrl !== undefined) fd.set("applicationUrl", overrides.applicationUrl);
  if (overrides.requirements !== undefined) fd.set("requirements", overrides.requirements);
  return fd;
}

function setActor(role = "SUPER_ADMIN", id = "actor-1") {
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id, email: "admin@example.com", name: "Admin", role },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setActor();
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCreateCuratedJob.mockResolvedValue({
    ok: true,
    item: { id: JOB_ID },
  });
});

describe("createCuratedJobAction — authorization", () => {
  it.each(["SUPER_ADMIN", "ADMIN", "MODERATOR"])(
    "allows %s to create a curated job",
    async (role) => {
      setActor(role);
      await expect(
        createCuratedJobAction(INITIAL, createForm()),
      ).rejects.toThrow(`REDIRECT:/admin/jobs/${JOB_ID}`);
      expect(mocks.mockCreateCuratedJob).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects a non-staff actor (403 → /admin/jobs) without calling the service", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      createCuratedJobAction(INITIAL, createForm()),
    ).rejects.toThrow("REDIRECT:/admin/jobs");
    expect(mocks.mockCreateCuratedJob).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(
      createCuratedJobAction(INITIAL, createForm()),
    ).rejects.toThrow("REDIRECT:/login");
    expect(mocks.mockCreateCuratedJob).not.toHaveBeenCalled();
  });

  it("returns a safe generic error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await createCuratedJobAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
    expect(mocks.mockCreateCuratedJob).not.toHaveBeenCalled();
  });
});

describe("createCuratedJobAction — validation", () => {
  it("surfaces field errors for a missing title", async () => {
    const result = await createCuratedJobAction(
      INITIAL,
      createForm({ title: "" }),
    );
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.fieldErrors?.title)).toBe(true);
    expect(mocks.mockCreateCuratedJob).not.toHaveBeenCalled();
  });

  it("surfaces salary range violations on the salaryMax field", async () => {
    const result = await createCuratedJobAction(
      INITIAL,
      createForm({ salaryMin: "5000", salaryMax: "1000" }),
    );
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.fieldErrors?.salaryMax)).toBe(true);
  });

  it("rejects an unknown employment type via field errors", async () => {
    const result = await createCuratedJobAction(
      INITIAL,
      createForm({ employmentType: "NOPE" }),
    );
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.fieldErrors?.employmentType)).toBe(true);
  });

  it("parses numeric fields before validation", async () => {
    await expect(
      createCuratedJobAction(INITIAL, createForm({ experienceMin: "3" })),
    ).rejects.toThrow(`REDIRECT:/admin/jobs/${JOB_ID}`);
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ experienceMin: 3 }),
    );
  });

  it("converts a datetime-local deadline to an ISO UTC string", async () => {
    const local = "2026-09-08T15:00";
    const expectedIso = new Date(local).toISOString();
    await expect(
      createCuratedJobAction(INITIAL, createForm({ deadline: local })),
    ).rejects.toThrow(`REDIRECT:/admin/jobs/${JOB_ID}`);
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deadline: expectedIso }),
    );
  });

  it("passes optional text/select values through", async () => {
    await expect(
      createCuratedJobAction(
        INITIAL,
        createForm({
          categoryId: "22222222-2222-4222-8222-222222222222",
          employmentType: "FULL_TIME",
          salaryCurrency: "ETB",
          salaryPeriod: "MONTHLY",
          applicationUrl: "https://example.com/apply",
          requirements: "CPA preferred",
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/admin/jobs/${JOB_ID}`);
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        categoryId: "22222222-2222-4222-8222-222222222222",
        employmentType: "FULL_TIME",
        salaryCurrency: "ETB",
        salaryPeriod: "MONTHLY",
        applicationUrl: "https://example.com/apply",
        requirements: "CPA preferred",
      }),
    );
  });
});

describe("createCuratedJobAction — client-controlled fields are ignored", () => {
  it("never passes sourceId from the form to the service", async () => {
    const fd = createForm();
    fd.set("sourceId", "99999999-9999-4999-8999-999999999999");
    await expect(createCuratedJobAction(INITIAL, fd)).rejects.toThrow(
      `REDIRECT:/admin/jobs/${JOB_ID}`,
    );
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ sourceId: expect.anything() }),
    );
  });

  it("never passes verificationStatus or status from the form to the service", async () => {
    const fd = createForm();
    fd.set("verificationStatus", "VERIFIED");
    fd.set("status", "PUBLISHED");
    await expect(createCuratedJobAction(INITIAL, fd)).rejects.toThrow(
      `REDIRECT:/admin/jobs/${JOB_ID}`,
    );
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ verificationStatus: expect.anything() }),
    );
    expect(mocks.mockCreateCuratedJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });
});

describe("createCuratedJobAction — service result handling", () => {
  it("maps SLUG_COLLISION to a clear error message", async () => {
    mocks.mockCreateCuratedJob.mockResolvedValue({
      ok: false,
      code: "SLUG_COLLISION",
    });
    const result = await createCuratedJobAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("similar title");
  });

  it("maps a VALIDATION failure from the service to a safe generic error", async () => {
    mocks.mockCreateCuratedJob.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
    });
    const result = await createCuratedJobAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns a safe generic error on an unexpected DB failure", async () => {
    mocks.mockCreateCuratedJob.mockRejectedValue(
      new Error("connection refused: 10.0.0.1"),
    );
    const result = await createCuratedJobAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain("connection");
  });
});

describe("createCuratedJobAction — duplicate warning passthrough", () => {
  it("returns the warning and item id without redirecting", async () => {
    mocks.mockCreateCuratedJob.mockResolvedValue({
      ok: true,
      item: { id: JOB_ID },
      warning: {
        code: "POSSIBLE_DUPLICATE",
        message: "Possible duplicate — review existing jobs before publishing.",
        matchedJobId: "66666666-6666-4666-8666-666666666666",
        matchedJobTitle: "Senior Accountant",
        matchedStatus: "PUBLISHED",
      },
    });
    const result = await createCuratedJobAction(INITIAL, createForm());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemId).toBe(JOB_ID);
      expect(result.warning?.code).toBe("POSSIBLE_DUPLICATE");
      expect(result.warning?.matchedStatus).toBe("PUBLISHED");
    }
  });

  it("still redirects to the detail page when no warning is present", async () => {
    await expect(createCuratedJobAction(INITIAL, createForm())).rejects.toThrow(
      `REDIRECT:/admin/jobs/${JOB_ID}`,
    );
  });
});