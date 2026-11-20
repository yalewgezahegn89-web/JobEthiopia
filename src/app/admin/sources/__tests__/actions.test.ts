import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockCreateSource: vi.fn(),
  mockUpdateSource: vi.fn(),
  mockDeleteSource: vi.fn(),
  mockToggleSourceActive: vi.fn(),
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

vi.mock("@/lib/admin/sources", () => ({
  createSource: (...args: unknown[]) => mocks.mockCreateSource(...args),
  updateSource: (...args: unknown[]) => mocks.mockUpdateSource(...args),
  deleteSource: (...args: unknown[]) => mocks.mockDeleteSource(...args),
  toggleSourceActive: (...args: unknown[]) => mocks.mockToggleSourceActive(...args),
}));

import {
  createSourceAction,
  updateSourceAction,
  deleteSourceAction,
  toggleSourceActiveAction,
} from "@/app/admin/sources/actions";

const INITIAL: { ok: boolean } = { ok: false };
const VALID_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role: "SUPER_ADMIN" },
  });
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockCreateSource.mockResolvedValue({ ok: true, id: VALID_ID });
  mocks.mockUpdateSource.mockResolvedValue({ ok: true });
  mocks.mockDeleteSource.mockResolvedValue({ ok: true });
  mocks.mockToggleSourceActive.mockResolvedValue({ ok: true, isActive: false });
});

function createForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", overrides.name ?? "Test Source");
  fd.set("sourceType", overrides.sourceType ?? "WEBSITE");
  if (overrides.baseUrl !== undefined) fd.set("baseUrl", overrides.baseUrl);
  if (overrides.trustLevel !== undefined) fd.set("trustLevel", overrides.trustLevel);
  if (overrides.autoPublish !== undefined) fd.set("autoPublish", overrides.autoPublish);
  return fd;
}

function updateForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("sourceId", overrides.sourceId ?? VALID_ID);
  if (overrides.name !== undefined) fd.set("name", overrides.name);
  else fd.set("name", "Updated Source");
  if (overrides.sourceType !== undefined) fd.set("sourceType", overrides.sourceType);
  else fd.set("sourceType", "WEBSITE");
  if (overrides.baseUrl !== undefined) fd.set("baseUrl", overrides.baseUrl);
  if (overrides.trustLevel !== undefined) fd.set("trustLevel", overrides.trustLevel);
  if (overrides.autoPublish !== undefined) fd.set("autoPublish", overrides.autoPublish);
  if (overrides.checkFrequencyMinutes !== undefined) {
    fd.set("checkFrequencyMinutes", overrides.checkFrequencyMinutes);
  }
  return fd;
}

function privilegedEditForm(
  overrides: Record<string, string> = {},
): FormData {
  const fd = new FormData();
  fd.set("sourceId", overrides.sourceId ?? VALID_ID);
  fd.set("name", overrides.name ?? "Renamed privileged source");
  if (overrides.checkFrequencyMinutes !== undefined) {
    fd.set("checkFrequencyMinutes", overrides.checkFrequencyMinutes);
  }
  return fd;
}

function setRole(role: string): void {
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "admin@example.com", name: "Admin", role },
  });
}

function deleteForm(sourceId: string = VALID_ID): FormData {
  const fd = new FormData();
  fd.set("sourceId", sourceId);
  return fd;
}

describe("createSourceAction", () => {
  it("creates a source with correct fields", async () => {
    const result = await createSourceAction(INITIAL, createForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockCreateSource).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Source", sourceType: "WEBSITE" }),
      expect.objectContaining({ id: "actor-1" }),
    );
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(createSourceAction(INITIAL, createForm())).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects non-staff with redirect (403 semantics)", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });
    await expect(createSourceAction(INITIAL, createForm())).rejects.toThrow("REDIRECT:/admin/sources");
  });

  it("returns error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await createSourceAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
  });

  it("returns error on missing fields", async () => {
    const fd = new FormData();
    fd.set("name", "");
    fd.set("sourceType", "");
    const result = await createSourceAction(INITIAL, fd);
    expect(result.ok).toBe(false);
  });

  it("lets a moderator create a MEDIUM trust source", async () => {
    setRole("MODERATOR");
    const result = await createSourceAction(
      INITIAL,
      createForm({ trustLevel: "MEDIUM" }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.mockCreateSource).toHaveBeenCalled();
  });

  it("lets a moderator create a LOW trust source", async () => {
    setRole("MODERATOR");
    const result = await createSourceAction(
      INITIAL,
      createForm({ trustLevel: "LOW" }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.mockCreateSource).toHaveBeenCalled();
  });

  it("denies a moderator creating a HIGH trust source", async () => {
    setRole("MODERATOR");
    const result = await createSourceAction(
      INITIAL,
      createForm({ trustLevel: "HIGH" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockCreateSource).not.toHaveBeenCalled();
  });

  it("denies a moderator creating an auto-publishing source", async () => {
    setRole("MODERATOR");
    const result = await createSourceAction(
      INITIAL,
      createForm({ trustLevel: "MEDIUM", autoPublish: "true" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockCreateSource).not.toHaveBeenCalled();
  });

  it("denies a moderator creating a Facebook source", async () => {
    setRole("MODERATOR");
    const result = await createSourceAction(
      INITIAL,
      createForm({ sourceType: "FACEBOOK", trustLevel: "MEDIUM" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockCreateSource).not.toHaveBeenCalled();
  });

  it("denies a moderator self-asserting Facebook approval", async () => {
    setRole("MODERATOR");
    const fd = createForm({ sourceType: "WEBSITE", trustLevel: "MEDIUM" });
    fd.set("facebookApprovalState", "APPROVED");
    const result = await createSourceAction(INITIAL, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockCreateSource).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "SUPER_ADMIN"])(
    "lets %s create a HIGH trust auto-publishing source",
    async (role) => {
      setRole(role);
      const result = await createSourceAction(
        INITIAL,
        createForm({ trustLevel: "HIGH", autoPublish: "true" }),
      );
      expect(result.ok).toBe(true);
      expect(mocks.mockCreateSource).toHaveBeenCalled();
    },
  );

  it("returns error on DB failure", async () => {
    mocks.mockCreateSource.mockRejectedValue(new Error("connection refused"));
    const result = await createSourceAction(INITIAL, createForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("connection");
  });
});

describe("updateSourceAction", () => {
  it("updates a source with correct fields", async () => {
    const result = await updateSourceAction(INITIAL, updateForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockUpdateSource).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({ name: "Updated Source" }),
      expect.objectContaining({ id: "actor-1" }),
    );
  });

  it("returns error for invalid source id", async () => {
    const result = await updateSourceAction(INITIAL, updateForm({ sourceId: "not-a-uuid" }));
    expect(result.ok).toBe(false);
    expect(mocks.mockUpdateSource).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(updateSourceAction(INITIAL, updateForm())).rejects.toThrow("REDIRECT:/login");
  });

  it("returns error on CSRF failure", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());
    const result = await updateSourceAction(INITIAL, updateForm());
    expect(result.ok).toBe(false);
  });

  it("clears baseUrl when empty string provided", async () => {
    const fd = updateForm({ baseUrl: "" });
    await updateSourceAction(INITIAL, fd);
    expect(mocks.mockUpdateSource).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({ baseUrl: null }),
      expect.objectContaining({ id: "actor-1" }),
    );
  });

  it("denies a moderator downgrading trust even when the service would reject it", async () => {
    setRole("MODERATOR");
    mocks.mockUpdateSource.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
    });
    const result = await updateSourceAction(
      INITIAL,
      updateForm({ trustLevel: "MEDIUM", autoPublish: "false" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("denies moderator Facebook approval changes before the service call", async () => {
    setRole("MODERATOR");
    const fd = updateForm({ sourceType: "WEBSITE" });
    fd.set("facebookApprovalState", "APPROVED");
    fd.set("facebookContentUseState", "AUTHORIZED");
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockUpdateSource).not.toHaveBeenCalled();
  });

  it("lets a moderator edit without changing privileged fields", async () => {
    setRole("MODERATOR");
    const result = await updateSourceAction(
      INITIAL,
      updateForm({ autoPublish: "" }),
    );
    expect(result.ok).toBe(true);
    expect(mocks.mockUpdateSource).toHaveBeenCalledWith(
      VALID_ID,
      expect.not.objectContaining({ autoPublish: true }),
      expect.objectContaining({ id: "actor-1" }),
    );
  });

  it("lets a moderator rename an ordinary source without submitting hidden Facebook metadata", async () => {
    setRole("MODERATOR");
    const fd = updateForm({ name: "Renamed ordinary source" });
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(true);
    const patch = mocks.mockUpdateSource.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).toMatchObject({ name: "Renamed ordinary source" });
    expect(patch).not.toHaveProperty("facebookPageId");
    expect(patch).not.toHaveProperty("facebookPageKind");
    expect(patch).not.toHaveProperty("facebookApprovalState");
    expect(patch).not.toHaveProperty("facebookContentUseState");
    expect(patch).not.toHaveProperty("facebookAuthorizationNote");
  });

  it("lets a moderator change check frequency on an ordinary source without submitting hidden Facebook metadata", async () => {
    setRole("MODERATOR");
    const fd = updateForm({ checkFrequencyMinutes: "30" });
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(true);
    const patch = mocks.mockUpdateSource.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).toMatchObject({ checkFrequencyMinutes: 30 });
    expect(patch).not.toHaveProperty("facebookPageId");
    expect(patch).not.toHaveProperty("facebookPageKind");
    expect(patch).not.toHaveProperty("facebookApprovalState");
    expect(patch).not.toHaveProperty("facebookContentUseState");
    expect(patch).not.toHaveProperty("facebookAuthorizationNote");
  });

  it("denies a moderator explicitly attempting to alter Facebook metadata", async () => {
    setRole("MODERATOR");
    const fd = updateForm({ sourceType: "WEBSITE" });
    fd.set("facebookPageId", "page-1");
    fd.set("facebookApprovalState", "APPROVED");
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockUpdateSource).not.toHaveBeenCalled();
  });

  it("lets a moderator make an allowed ordinary-field change on a privileged source without submitting hidden privileged fields", async () => {
    setRole("MODERATOR");
    const fd = privilegedEditForm({ checkFrequencyMinutes: "120" });
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(true);
    const patch = mocks.mockUpdateSource.mock.calls[0][1] as Record<string, unknown>;
    expect(patch).toMatchObject({
      name: "Renamed privileged source",
      checkFrequencyMinutes: 120,
    });
    expect(patch).not.toHaveProperty("sourceType");
    expect(patch).not.toHaveProperty("baseUrl");
    expect(patch).not.toHaveProperty("trustLevel");
    expect(patch).not.toHaveProperty("autoPublish");
    expect(patch).not.toHaveProperty("facebookPageId");
    expect(patch).not.toHaveProperty("facebookPageKind");
    expect(patch).not.toHaveProperty("facebookApprovalState");
    expect(patch).not.toHaveProperty("facebookContentUseState");
    expect(patch).not.toHaveProperty("facebookAuthorizationNote");
  });

  it("lets an administrator update Facebook metadata", async () => {
    setRole("ADMIN");
    const fd = updateForm({
      sourceType: "FACEBOOK",
      baseUrl: "https://www.facebook.com/example",
    });
    fd.set("facebookPageId", "page-1");
    fd.set("facebookPageKind", "EXTERNAL_PAGE");
    fd.set("facebookApprovalState", "APPROVED");
    fd.set("facebookContentUseState", "AUTHORIZED");
    fd.set("facebookAuthorizationNote", "Approved for use");
    const result = await updateSourceAction(INITIAL, fd);
    expect(result.ok).toBe(true);
    expect(mocks.mockUpdateSource).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({
        sourceType: "FACEBOOK",
        facebookPageId: "page-1",
        facebookPageKind: "EXTERNAL_PAGE",
        facebookApprovalState: "APPROVED",
        facebookContentUseState: "AUTHORIZED",
        facebookAuthorizationNote: "Approved for use",
      }),
      expect.objectContaining({ role: "ADMIN" }),
    );
  });

  it("denies a moderator granting HIGH trust", async () => {
    setRole("MODERATOR");
    const result = await updateSourceAction(
      INITIAL,
      updateForm({ trustLevel: "HIGH" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockUpdateSource).not.toHaveBeenCalled();
  });

  it("denies a moderator enabling auto-publish", async () => {
    setRole("MODERATOR");
    const result = await updateSourceAction(
      INITIAL,
      updateForm({ trustLevel: "MEDIUM", autoPublish: "true" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
    expect(mocks.mockUpdateSource).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "SUPER_ADMIN"])(
    "lets %s update HIGH trust and auto-publish",
    async (role) => {
      setRole(role);
      const result = await updateSourceAction(
        INITIAL,
        updateForm({ trustLevel: "HIGH", autoPublish: "true" }),
      );
      expect(result.ok).toBe(true);
      expect(mocks.mockUpdateSource).toHaveBeenCalledWith(
        VALID_ID,
        expect.objectContaining({ trustLevel: "HIGH", autoPublish: true }),
        expect.objectContaining({ id: "actor-1" }),
      );
    },
  );
});

describe("deleteSourceAction", () => {
  it("deletes a source", async () => {
    const result = await deleteSourceAction(INITIAL, deleteForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockDeleteSource).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({ kind: "staff", id: "actor-1" }),
    );
  });

  it("returns error for invalid source id", async () => {
    const result = await deleteSourceAction(INITIAL, deleteForm("not-a-uuid"));
    expect(result.ok).toBe(false);
    expect(mocks.mockDeleteSource).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(deleteSourceAction(INITIAL, deleteForm())).rejects.toThrow("REDIRECT:/login");
  });

  it("returns FK_VIOLATION error message", async () => {
    mocks.mockDeleteSource.mockResolvedValue({ ok: false, code: "FK_VIOLATION" });
    const result = await deleteSourceAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("linked to existing jobs");
  });

  it("returns permission error when deleting a privileged source is denied", async () => {
    setRole("MODERATOR");
    mocks.mockDeleteSource.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
    });
    const result = await deleteSourceAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("returns error on DB failure", async () => {
    mocks.mockDeleteSource.mockRejectedValue(new Error("db error"));
    const result = await deleteSourceAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("db error");
  });
});

describe("toggleSourceActiveAction", () => {
  it("toggles source active state", async () => {
    const result = await toggleSourceActiveAction(INITIAL, deleteForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockToggleSourceActive).toHaveBeenCalledWith(
      VALID_ID,
      expect.objectContaining({ kind: "staff", id: "actor-1" }),
    );
  });

  it("returns permission error when toggling a privileged source is denied", async () => {
    setRole("MODERATOR");
    mocks.mockToggleSourceActive.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
    });
    const result = await toggleSourceActiveAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("permission");
  });

  it("returns error for invalid source id", async () => {
    const result = await toggleSourceActiveAction(INITIAL, deleteForm("not-a-uuid"));
    expect(result.ok).toBe(false);
    expect(mocks.mockToggleSourceActive).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });
    await expect(toggleSourceActiveAction(INITIAL, deleteForm())).rejects.toThrow("REDIRECT:/login");
  });

  it("returns error on toggle failure", async () => {
    mocks.mockToggleSourceActive.mockResolvedValue({ ok: false, code: "NOT_FOUND" });
    const result = await toggleSourceActiveAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
  });

  it("returns error on DB failure", async () => {
    mocks.mockToggleSourceActive.mockRejectedValue(new Error("db error"));
    const result = await toggleSourceActiveAction(INITIAL, deleteForm());
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("db error");
  });
});
