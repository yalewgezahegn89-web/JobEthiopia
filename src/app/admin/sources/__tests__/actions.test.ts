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
  return fd;
}

function updateForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("sourceId", overrides.sourceId ?? VALID_ID);
  fd.set("name", overrides.name ?? "Updated Source");
  fd.set("sourceType", overrides.sourceType ?? "WEBSITE");
  if (overrides.baseUrl !== undefined) fd.set("baseUrl", overrides.baseUrl);
  if (overrides.trustLevel !== undefined) fd.set("trustLevel", overrides.trustLevel);
  return fd;
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
      "actor-1",
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
      "actor-1",
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
      "actor-1",
    );
  });
});

describe("deleteSourceAction", () => {
  it("deletes a source", async () => {
    const result = await deleteSourceAction(INITIAL, deleteForm());
    expect(result.ok).toBe(true);
    expect(mocks.mockDeleteSource).toHaveBeenCalledWith(VALID_ID, "actor-1");
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
    expect(mocks.mockToggleSourceActive).toHaveBeenCalledWith(VALID_ID, "actor-1");
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
