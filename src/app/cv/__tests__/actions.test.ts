import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockAssertCsrf: vi.fn(),
  mockSaveCv: vi.fn(),
  mockDeleteCv: vi.fn(),
  mockGetOwnedCv: vi.fn(),
  mockTrackCvEvent: vi.fn(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockGetRequestId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertTrustedCsrfFromRequest: (...args: unknown[]) =>
    mocks.mockAssertCsrf(...args),
  CsrfError: class CsrfError extends Error {},
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/cv/dal", () => ({
  saveCv: (...args: unknown[]) => mocks.mockSaveCv(...args),
  deleteCv: (...args: unknown[]) => mocks.mockDeleteCv(...args),
  getOwnedCv: (...args: unknown[]) => mocks.mockGetOwnedCv(...args),
}));

vi.mock("@/lib/analytics/cvEvents", () => ({
  trackCvEvent: (...args: unknown[]) => mocks.mockTrackCvEvent(...args),
}));

vi.mock("@/lib/observability/logger", () => ({
  logInfo: (...args: unknown[]) => mocks.mockLogInfo(...args),
  logWarn: (...args: unknown[]) => mocks.mockLogWarn(...args),
}));

vi.mock("@/lib/observability/requestId", () => ({
  getRequestId: (...args: unknown[]) => mocks.mockGetRequestId(...args),
}));

import {
  saveCvAction,
  deleteCvAction,
  recordCvDownloadAction,
  recordCvPreviewAction,
} from "@/app/cv/actions";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const EMPLOYER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "employer@example.com",
  name: "Employer",
  role: "EMPLOYER",
};

const VALID_CV_DATA = {
  header: { title: "Engineer" },
  experiences: [],
  educations: [],
  skills: [],
  certifications: [],
};

function makeFormData(data: unknown = VALID_CV_DATA): FormData {
  const fd = new FormData();
  fd.set("data", JSON.stringify(data));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockAssertCsrf.mockResolvedValue(undefined);
  mocks.mockGetRequestId.mockResolvedValue("test-req-id");
  mocks.mockSaveCv.mockResolvedValue({
    ok: true,
    created: true,
    cv: {
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
    },
  });
  mocks.mockDeleteCv.mockResolvedValue({ ok: true, deleted: true });
  mocks.mockGetOwnedCv.mockResolvedValue({ id: "cv-1" });
  mocks.mockTrackCvEvent.mockResolvedValue(undefined);
});

describe("saveCvAction", () => {
  it("redirects to /login for unauthenticated user", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);

    await expect(
      saveCvAction({ ok: false }, makeFormData()),
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /jobs for non-candidate role", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(EMPLOYER);

    await expect(
      saveCvAction({ ok: false }, makeFormData()),
    ).rejects.toThrow("REDIRECT:/jobs");
  });

  it("returns { ok: false } on CSRF failure (CsrfError)", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockAssertCsrf.mockRejectedValue(new CsrfError());

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("returns { ok: false } on non-CsrfError CSRF failure", async () => {
    mocks.mockAssertCsrf.mockRejectedValue(new Error("boom"));

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_save_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });

  it("returns { ok: false } on invalid JSON", async () => {
    const fd = new FormData();
    fd.set("data", "not-json");

    const result = await saveCvAction({ ok: false }, fd);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_save_failed",
      expect.objectContaining({ errorCode: "INVALID_BODY" }),
    );
  });

  it("returns { ok: false } on validation failure", async () => {
    const fd = makeFormData({
      header: {},
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
    });

    const result = await saveCvAction({ ok: false }, fd);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_save_failed",
      expect.objectContaining({ errorCode: "VALIDATION_FAILED" }),
    );
  });

  it("returns { ok: true, created: true } on successful new CV", async () => {
    mocks.mockSaveCv.mockResolvedValue({
      ok: true,
      created: true,
      cv: { experiences: [], educations: [], skills: [], certifications: [] },
    });

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: true, created: true });
    expect(mocks.mockSaveCv).toHaveBeenCalledWith(CANDIDATE.id, expect.anything());
    expect(mocks.mockTrackCvEvent).toHaveBeenCalledWith({ event: "cv_created" });
  });

  it("returns { ok: true, created: false } on successful CV update", async () => {
    mocks.mockSaveCv.mockResolvedValue({
      ok: true,
      created: false,
      cv: { experiences: [], educations: [], skills: [], certifications: [] },
    });

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: true, created: false });
    expect(mocks.mockTrackCvEvent).toHaveBeenCalledWith({ event: "cv_updated" });
  });

  it("returns { ok: false } when saveCv returns ok: false", async () => {
    mocks.mockSaveCv.mockResolvedValue({ ok: false });

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockTrackCvEvent).not.toHaveBeenCalled();
  });

  it("returns { ok: false } when saveCv throws", async () => {
    mocks.mockSaveCv.mockRejectedValue(new Error("db error"));

    const result = await saveCvAction({ ok: false }, makeFormData());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_save_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });
});

describe("deleteCvAction", () => {
  it("redirects to /login for unauthenticated user", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);

    await expect(deleteCvAction()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /jobs for non-candidate role", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(EMPLOYER);

    await expect(deleteCvAction()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("returns { ok: false } on CSRF failure (CsrfError)", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockAssertCsrf.mockRejectedValue(new CsrfError());

    const result = await deleteCvAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).not.toHaveBeenCalled();
  });

  it("returns { ok: false } on non-CsrfError CSRF failure", async () => {
    mocks.mockAssertCsrf.mockRejectedValue(new Error("boom"));

    const result = await deleteCvAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_delete_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });

  it("returns { ok: true } on successful delete", async () => {
    const result = await deleteCvAction();

    expect(result).toEqual({ ok: true });
    expect(mocks.mockDeleteCv).toHaveBeenCalledWith(CANDIDATE.id);
    expect(mocks.mockTrackCvEvent).toHaveBeenCalledWith({ event: "cv_deleted" });
  });

  it("returns { ok: false } when deleteCv throws", async () => {
    mocks.mockDeleteCv.mockRejectedValue(new Error("db error"));

    const result = await deleteCvAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_delete_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });
});

describe("recordCvDownloadAction", () => {
  it("redirects to /login for unauthenticated user", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);

    await expect(recordCvDownloadAction()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /jobs for non-candidate role", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(EMPLOYER);

    await expect(recordCvDownloadAction()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("returns { ok: false } on CSRF failure (CsrfError)", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockAssertCsrf.mockRejectedValue(new CsrfError());

    const result = await recordCvDownloadAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("returns { ok: false } with NOT_FOUND when no CV exists", async () => {
    mocks.mockGetOwnedCv.mockResolvedValue(null);

    const result = await recordCvDownloadAction();

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(mocks.mockTrackCvEvent).not.toHaveBeenCalled();
  });

  it("returns { ok: true } when CV exists", async () => {
    const result = await recordCvDownloadAction();

    expect(result).toEqual({ ok: true });
    expect(mocks.mockTrackCvEvent).toHaveBeenCalledWith({
      event: "cv_downloaded",
    });
  });

  it("returns { ok: false } when getOwnedCv throws", async () => {
    mocks.mockGetOwnedCv.mockRejectedValue(new Error("db error"));

    const result = await recordCvDownloadAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_download_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });
});

describe("recordCvPreviewAction", () => {
  it("redirects to /login for unauthenticated user", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);

    await expect(recordCvPreviewAction()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects to /jobs for non-candidate role", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(EMPLOYER);

    await expect(recordCvPreviewAction()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("returns { ok: false } on CSRF failure (CsrfError)", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockAssertCsrf.mockRejectedValue(new CsrfError());

    const result = await recordCvPreviewAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("returns { ok: false } with NOT_FOUND when no CV exists", async () => {
    mocks.mockGetOwnedCv.mockResolvedValue(null);

    const result = await recordCvPreviewAction();

    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(mocks.mockTrackCvEvent).not.toHaveBeenCalled();
  });

  it("returns { ok: true } when CV exists", async () => {
    const result = await recordCvPreviewAction();

    expect(result).toEqual({ ok: true });
    expect(mocks.mockTrackCvEvent).toHaveBeenCalledWith({
      event: "cv_previewed",
    });
  });

  it("returns { ok: false } when getOwnedCv throws", async () => {
    mocks.mockGetOwnedCv.mockRejectedValue(new Error("db error"));

    const result = await recordCvPreviewAction();

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mocks.mockLogWarn).toHaveBeenCalledWith(
      "cv_preview_failed",
      expect.objectContaining({ errorCode: "INTERNAL_ERROR" }),
    );
  });
});
