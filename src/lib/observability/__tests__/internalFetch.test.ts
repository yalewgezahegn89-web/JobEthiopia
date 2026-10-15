import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  internalTargetOf,
  timedFetch,
} from "@/lib/observability/internalFetch";
import {
  getInternalFetchMetrics,
  resetOperationalMetrics,
} from "@/lib/observability/metrics";

const mockHeaders = vi.hoisted(() => vi.fn((): Headers | undefined => undefined));

vi.mock("next/headers", () => ({
  headers: async () => mockHeaders(),
}));

beforeEach(() => {
  resetOperationalMetrics();
  mockHeaders.mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  resetOperationalMetrics();
});

describe("internalTargetOf", () => {
  it("keeps only the pathname of an absolute URL", () => {
    expect(internalTargetOf("https://example.test/api/jobs?q=secret")).toBe(
      "/api/jobs",
    );
    expect(internalTargetOf("https://example.test/api/jobs#frag")).toBe(
      "/api/jobs",
    );
  });

  it("strips the query from a relative path", () => {
    expect(internalTargetOf("/api/categories?limit=50")).toBe("/api/categories");
  });

  it("accepts URL and Request-like inputs", () => {
    expect(internalTargetOf(new URL("https://example.test/a/b?c=d"))).toBe(
      "/a/b",
    );
    expect(internalTargetOf({ url: "https://example.test/x/y?z=1" } as Request)).toBe(
      "/x/y",
    );
  });

  it("returns a safe fallback for unusable input", () => {
    expect(internalTargetOf("")).toBe("/");
    expect(internalTargetOf(null as unknown as string)).toBe("/");
  });

  it("bounds very long targets", () => {
    const target = internalTargetOf("/" + "a".repeat(1_000));
    expect(target.length).toBeLessThanOrEqual(200);
  });
});

describe("timedFetch", () => {
  it("calls the underlying fetcher with the exact input and init", async () => {
    const fetcher = vi.fn(async () => new Response("ok", { status: 200 }));
    const init = { cache: "no-store" } as RequestInit;

    const result = await timedFetch(fetcher, "/api/jobs", init);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/jobs", init);
    expect(await result.text()).toBe("ok");
  });

  it("records duration and success against the pathname only", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));

    await timedFetch(fetcher, "https://example.test/api/jobs?q=private-term");

    const snapshot = getInternalFetchMetrics();
    expect(snapshot.calls).toBe(1);
    expect(snapshot.failures).toBe(0);
    expect(snapshot.targets[0]?.target).toBe("/api/jobs");
    expect(JSON.stringify(snapshot)).not.toContain("private-term");
    expect(JSON.stringify(snapshot)).not.toContain("example.test");
  });

  it("records a non-2xx response as a completed but unsuccessful call", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }));

    await timedFetch(fetcher, "/api/jobs");

    const snapshot = getInternalFetchMetrics();
    expect(snapshot.calls).toBe(1);
    expect(snapshot.failures).toBe(1);
  });

  it("records a thrown fetcher error and rethrows it unchanged", async () => {
    const failure = new Error("upstream exploded");
    const fetcher = vi.fn(async () => {
      throw failure;
    });

    await expect(timedFetch(fetcher, "/api/jobs")).rejects.toBe(failure);

    const snapshot = getInternalFetchMetrics();
    expect(snapshot.calls).toBe(1);
    expect(snapshot.failures).toBe(1);
  });

  it("attributes fan-out to a single request when a correlation id exists", async () => {
    mockHeaders.mockReturnValue(new Headers({ "x-request-id": "req-9" }));
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));

    await timedFetch(fetcher, "/api/jobs");
    await timedFetch(fetcher, "/api/categories");

    const snapshot = getInternalFetchMetrics();
    expect(snapshot.calls).toBe(2);
    expect(snapshot.attributedRequests).toBe(1);
    expect(snapshot.maxCallsInOneRequest).toBe(2);
  });

  it("never throws when the correlation id cannot be read", async () => {
    mockHeaders.mockImplementation(() => {
      throw new Error("no scope");
    });
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(timedFetch(fetcher, "/api/jobs")).resolves.toBeTruthy();
    expect(getInternalFetchMetrics().calls).toBe(1);
  });
});
