import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/db", () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

import { GET } from "@/app/api/health/route";
import { GET as GET_LIVE } from "@/app/api/health/live/route";
import { GET as GET_READY } from "@/app/api/health/ready/route";
import { READINESS_TIMEOUT_MS } from "@/lib/observability/health";

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

describe("GET /api/health/live (liveness)", () => {
  it("returns 200 with { status: \"ok\" } without touching the database", async () => {
    const res = await GET_LIVE();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe("GET /api/health/ready (readiness)", () => {
  it("returns 200 with { status: \"ok\" } when the DB is reachable", async () => {
    const res = await GET_READY();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("returns 503 with { status: \"error\" } when the DB query fails", async () => {
    mockExecute.mockRejectedValue(new Error("connection refused"));

    const res = await GET_READY();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "error" });
  });

  it("does not leak error details when the DB is down", async () => {
    mockExecute.mockRejectedValue(
      new Error("SECRET_DB_PASSWORD=xyz connection refused at db.internal:5432"),
    );

    const res = await GET_READY();
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(text).not.toContain("SECRET_DB_PASSWORD");
    expect(text).not.toContain("xyz");
    expect(text).not.toContain("db.internal");
    expect(text).not.toContain("5432");
    expect(text).not.toContain("connection refused");
  });

  it("returns 503 when the readiness probe times out (hung DB)", async () => {
    vi.useFakeTimers();
    try {
      mockExecute.mockReturnValue(new Promise(() => {}));
      const promise = GET_READY();
      await vi.advanceTimersByTimeAsync(READINESS_TIMEOUT_MS + 500);
      const res = await promise;
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ status: "error" });
    } finally {
      vi.useRealTimers();
    }
  });
});
