import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUsersFindFirst: vi.fn(),
  mockInsert: vi.fn(),
}));

const capturedUserWrites: Record<string, unknown>[] = [];

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        users: {
          findFirst: (...args: unknown[]) => mocks.mockUsersFindFirst(...args),
        },
        sessions: { findFirst: vi.fn() },
      },
      insert: mocks.mockInsert,
      update: vi.fn(),
      delete: vi.fn(),
      select: vi.fn(),
    },
  };
});

const mockUsersFindFirst = mocks.mockUsersFindFirst;
const mockInsert = mocks.mockInsert;

import {
  bootstrapAdmin,
  bootstrapAdminFromEnv,
} from "@/db/bootstrapAdmin";

beforeEach(() => {
  vi.clearAllMocks();
  capturedUserWrites.length = 0;
  mockUsersFindFirst.mockResolvedValue(undefined);

  mockInsert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => {
      capturedUserWrites.push(values);
      return {
        returning: async () => [
          { id: "new-user-id", email: values.email as string },
        ],
      };
    },
  }));
});

describe("bootstrap admin", () => {
  it("creates exactly one SUPER_ADMIN and hashes the password", async () => {
    const result = await bootstrapAdmin("admin@example.com", "bootstrap-pass-123");
    expect(result.created).toBe(true);
    expect(result.email).toBe("admin@example.com");

    expect(capturedUserWrites.length).toBeGreaterThanOrEqual(1);
    const stored = capturedUserWrites[0];
    expect(stored.email).toBe("admin@example.com");
    expect(stored.role).toBe("SUPER_ADMIN");
    expect(stored.name).toBe("Administrator");
    expect(stored.passwordHash).not.toBe("bootstrap-pass-123");
    expect(String(stored.passwordHash)).not.toContain("bootstrap-pass-123");
    expect(String(stored.passwordHash)).toMatch(/^scrypt\$/);
  });

  it("normalizes the email to lowercase", async () => {
    await bootstrapAdmin("  ADMIN@Example.com ", "bootstrap-pass-123");
    expect(capturedUserWrites[0].email).toBe("admin@example.com");
  });

  it("is idempotent and never creates a duplicate for an existing email", async () => {
    mockUsersFindFirst.mockResolvedValue({ id: "existing", email: "x" });

    const first = await bootstrapAdmin("admin@example.com", "bootstrap-pass-123");
    const second = await bootstrapAdmin("admin@example.com", "other-pass-123");

    expect(first.created).toBe(false);
    expect(second.created).toBe(false);
    expect(capturedUserWrites).toHaveLength(0);
  });

  it("records a BOOTSTRAP_ADMIN audit event after creation", async () => {
    await bootstrapAdmin("admin@example.com", "bootstrap-pass-123");
    const auditWrite = capturedUserWrites.find(
      (w) => (w as { action?: string }).action === "BOOTSTRAP_ADMIN",
    );
    expect(auditWrite).toBeTruthy();
  });

  it("rejects missing credentials", async () => {
    await expect(bootstrapAdmin("", "password-xyz")).rejects.toThrow();
    await expect(bootstrapAdmin("a@b.com", "")).rejects.toThrow();
  });

  it("rejects a too-short bootstrap password", async () => {
    await expect(bootstrapAdmin("a@b.com", "short")).rejects.toThrow();
  });

  it("reports a missing configuration from env safely", async () => {
    vi.stubEnv("ADMIN_BOOTSTRAP_EMAIL", "");
    vi.stubEnv("ADMIN_BOOTSTRAP_PASSWORD", "");
    const originalExitCode = process.exitCode;

    await bootstrapAdminFromEnv();

    expect(process.exitCode).toBe(1);
    expect(mockUsersFindFirst).not.toHaveBeenCalled();
    process.exitCode = originalExitCode;
    vi.unstubAllEnvs();
  });
});