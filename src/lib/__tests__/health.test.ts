import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 with { status: \"ok\" } when DB is reachable", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("calls db.execute with a SELECT 1 query", async () => {
    await GET();

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 503 with { status: \"error\" } when DB query fails", async () => {
    mockExecute.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "error" });
  });

  it("does not leak error details on DB failure", async () => {
    mockExecute.mockRejectedValue(
      new Error("SECRET_DB_PASSWORD=xyz connection refused at db.internal:5432"),
    );

    const res = await GET();
    const text = await res.text();

    expect(text).not.toContain("SECRET_DB_PASSWORD");
    expect(text).not.toContain("xyz");
    expect(text).not.toContain("db.internal");
    expect(text).not.toContain("5432");
    expect(text).not.toContain("connection refused");
    expect(text).not.toContain("stack");
  });

  it("returns application/json content type", async () => {
    const res = await GET();

    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
