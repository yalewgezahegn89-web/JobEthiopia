import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  REQUEST_COMPLETED_EVENT,
  statusFromResult,
  withRouteMetrics,
} from "@/lib/observability/routeMetrics";
import { getRequestMetrics, resetOperationalMetrics } from "@/lib/observability/metrics";

const mockHeaders = vi.hoisted(() => vi.fn((): Headers | undefined => undefined));

vi.mock("next/headers", () => ({
  headers: async () => mockHeaders(),
}));

type SpiedCall = { event: string; level: string; payload: Record<string, unknown> };

function readCalls(spy: ReturnType<typeof vi.spyOn>, level: string): SpiedCall[] {
  return spy.mock.calls.map(([line]) => {
    const payload = JSON.parse(String(line)) as Record<string, unknown>;
    return { event: String(payload.event), level, payload };
  });
}

let infoSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetOperationalMetrics();
  mockHeaders.mockReturnValue(undefined);
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  resetOperationalMetrics();
});

function response(status: number): Response {
  return new Response(null, { status });
}

describe("statusFromResult", () => {
  it("reads the status of a Response-like value", () => {
    expect(statusFromResult(response(201))).toBe(201);
    expect(statusFromResult({ status: 404 })).toBe(404);
    expect(statusFromResult({ status: "odd" })).toBe(200);
    expect(statusFromResult(null)).toBe(200);
    expect(statusFromResult(undefined)).toBe(200);
    expect(statusFromResult("plain")).toBe(200);
  });
});

describe("withRouteMetrics", () => {
  it("passes arguments through and returns the handler result unchanged", async () => {
    const handler = vi.fn(async (id: string) => ({ id, status: 200 }));
    const wrapped = withRouteMetrics("/api/things/[id]", "GET", handler);

    const result = await wrapped("abc");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("abc");
    expect(result).toEqual({ id: "abc", status: 200 });
  });

  it("emits one request_completed log and one metric for a success", async () => {
    const wrapped = withRouteMetrics("/api/jobs", "GET", async () => response(200));
    await wrapped();

    const calls = readCalls(infoSpy, "info").filter(
      (c) => c.event === REQUEST_COMPLETED_EVENT,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].payload.route).toBe("/api/jobs");
    expect(calls[0].payload.method).toBe("GET");
    expect(calls[0].payload.status).toBe(200);
    expect(typeof calls[0].payload.durationMs).toBe("number");

    const snapshot = getRequestMetrics();
    expect(snapshot.total).toBe(1);
    expect(snapshot.statusClasses["2xx"]).toBe(1);
    expect(snapshot.routes[0]?.route).toBe("/api/jobs");
  });

  it("logs 4xx at warn and 5xx at error", async () => {
    const notFound = withRouteMetrics("/api/jobs/[id]", "GET", async () => response(404));
    await notFound();
    const boom = withRouteMetrics("/api/jobs", "POST", async () => response(503));
    await boom();

    const warns = readCalls(warnSpy, "warn").filter((c) => c.event === REQUEST_COMPLETED_EVENT);
    const errors = readCalls(errorSpy, "error").filter((c) => c.event === REQUEST_COMPLETED_EVENT);
    expect(warns).toHaveLength(1);
    expect(warns[0].payload.status).toBe(404);
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.status).toBe(503);

    const snapshot = getRequestMetrics();
    expect(snapshot.statusClasses["4xx"]).toBe(1);
    expect(snapshot.statusClasses["5xx"]).toBe(1);
  });

  it("rethrows the original error and reports a stable errorCode only", async () => {
    const original = new Error("SECRET_MESSAGE_DO_NOT_LEAK");
    const wrapped = withRouteMetrics("/api/jobs", "POST", async () => {
      throw original;
    });

    await expect(wrapped()).rejects.toBe(original);

    const errors = readCalls(errorSpy, "error").filter((c) => c.event === REQUEST_COMPLETED_EVENT);
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.status).toBe(500);
    expect(errors[0].payload.errorCode).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(errors[0].payload)).not.toContain("SECRET_MESSAGE_DO_NOT_LEAK");
    expect(JSON.stringify(errors[0].payload)).not.toContain("stack");

    expect(getRequestMetrics().statusClasses["5xx"]).toBe(1);
  });

  it("records only the route template — never raw URLs or query strings", async () => {
    mockHeaders.mockReturnValue(
      new Headers({ "x-request-id": "req-123" }),
    );
    const wrapped = withRouteMetrics("/api/jobs/[id]", "GET", async () => response(200));
    await wrapped();

    const raw = JSON.stringify(readCalls(infoSpy, "info"));
    expect(raw).toContain("/api/jobs/[id]");
    expect(raw).not.toContain("?");
    expect(raw).toContain("req-123");
    expect(raw).not.toContain("email");
    expect(raw).not.toContain("password");
  });

  it("still returns the response when the correlation id cannot be read", async () => {
    mockHeaders.mockImplementation(() => {
      throw new Error("no request scope");
    });
    const wrapped = withRouteMetrics("/api/health", "GET", async () => response(200));

    await expect(wrapped()).resolves.toBeTruthy();
    const raw = JSON.stringify(readCalls(infoSpy, "info"));
    expect(raw).toContain(REQUEST_COMPLETED_EVENT);
  });

  it("handles a handler that returns a non-Response value", async () => {
    const wrapped = withRouteMetrics("/api/things", "GET", async () => ({ ok: true }));
    await expect(wrapped()).resolves.toEqual({ ok: true });
    expect(getRequestMetrics().statusClasses["2xx"]).toBe(1);
  });

  it("normalizes the exported method name", async () => {
    const wrapped = withRouteMetrics("/api/things", "post", async () => response(201));
    await wrapped();
    const snapshot = getRequestMetrics();
    expect(snapshot.routes[0]?.method).toBe("POST");
    expect(snapshot.statusClasses["2xx"]).toBe(1);
  });
});
