import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGuard: vi.fn(),
  mockCsrf: vi.fn(),
  mockGetSource: vi.fn(),
  mockRunSourceIngestion: vi.fn(),
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

vi.mock("@/lib/admin/sources", () => ({
  getSource: (...args: unknown[]) => mocks.mockGetSource(...args),
}));

vi.mock("@/lib/ingestion/runSource", () => ({
  runSourceIngestion: (...args: unknown[]) => mocks.mockRunSourceIngestion(...args),
}));

import { syncSourceAction } from "@/app/admin/sources/sync-action";

const INITIAL = { ok: false };
const VALID_ID = "11111111-1111-4111-8111-111111111111";

const ORDINARY_SOURCE = {
  id: VALID_ID,
  name: "Ordinary Feed",
  sourceType: "FEED",
  baseUrl: "https://example.com/feed",
  trustLevel: "MEDIUM",
  autoPublish: false,
  isActive: true,
};

const PRIVILEGED_SOURCE = {
  ...ORDINARY_SOURCE,
  name: "Trusted Feed",
  trustLevel: "HIGH",
  autoPublish: true,
};

const SUCCESS_RESULT = {
  sourceId: VALID_ID,
  status: "SUCCEEDED",
  reason: null,
  total: 2,
  created: 1,
  updated: 1,
  duplicate: 0,
  linked: 0,
  possibleDuplicate: 0,
  failed: 0,
  durationMs: 5,
  deactivated: false,
};

function syncForm(sourceId: string = VALID_ID): FormData {
  const fd = new FormData();
  fd.set("sourceId", sourceId);
  return fd;
}

function setRole(role: string): void {
  mocks.mockGuard.mockResolvedValue({
    ok: true,
    user: { id: "actor-1", email: "user@example.com", name: "User", role },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setRole("MODERATOR");
  mocks.mockCsrf.mockResolvedValue(true);
  mocks.mockGetSource.mockResolvedValue(ORDINARY_SOURCE);
  mocks.mockRunSourceIngestion.mockResolvedValue(SUCCESS_RESULT);
});

describe("syncSourceAction", () => {
  it("allows an administrator to sync a privileged source", async () => {
    setRole("SUPER_ADMIN");
    mocks.mockGetSource.mockResolvedValue(PRIVILEGED_SOURCE);

    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(true);
    expect(mocks.mockRunSourceIngestion).toHaveBeenCalledWith(VALID_ID);
  });

  it("denies a moderator syncing a privileged source without running ingestion", async () => {
    mocks.mockGetSource.mockResolvedValue(PRIVILEGED_SOURCE);

    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("do not have permission to sync this source");
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("treats a FACEBOOK source as privileged for sync", async () => {
    mocks.mockGetSource.mockResolvedValue({
      ...ORDINARY_SOURCE,
      sourceType: "FACEBOOK",
      trustLevel: "LOW",
      autoPublish: false,
    });

    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(false);
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("allows a moderator to sync an ordinary source", async () => {
    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(true);
    expect(mocks.mockRunSourceIngestion).toHaveBeenCalledWith(VALID_ID);
  });

  it("rejects an invalid source id before authentication", async () => {
    const result = await syncSourceAction(INITIAL, syncForm("not-a-uuid"));

    expect(result.ok).toBe(false);
    expect(mocks.mockGuard).not.toHaveBeenCalled();
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 401 });

    await expect(syncSourceAction(INITIAL, syncForm())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("redirects non-staff users to /admin/sources", async () => {
    mocks.mockGuard.mockResolvedValue({ ok: false, status: 403 });

    await expect(syncSourceAction(INITIAL, syncForm())).rejects.toThrow(
      "REDIRECT:/admin/sources",
    );
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("returns an error when CSRF validation fails", async () => {
    const { CsrfError } = await import("@/lib/auth/csrf");
    mocks.mockCsrf.mockRejectedValue(new CsrfError());

    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(false);
    expect(mocks.mockGetSource).not.toHaveBeenCalled();
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });

  it("returns an error when the source does not exist", async () => {
    mocks.mockGetSource.mockResolvedValue(null);

    const result = await syncSourceAction(INITIAL, syncForm());

    expect(result.ok).toBe(false);
    expect(mocks.mockRunSourceIngestion).not.toHaveBeenCalled();
  });
});
