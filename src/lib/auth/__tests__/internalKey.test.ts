import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkInternalRouteKey,
  INTERNAL_AUTH_HEADER,
  INTERNAL_AUTH_FALLBACK_ENV,
} from "../internalKey";

const SHARED_KEY = "shared-maintenance-key-abc";
const ROUTE = "/api/internal/ingestion/run";

function makeRequest(key?: string): Request {
  const headers: Record<string, string> = {};
  if (key !== undefined) headers[INTERNAL_AUTH_HEADER] = key;
  return new Request(`https://jobs.example.com${ROUTE}`, {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.stubEnv(INTERNAL_AUTH_FALLBACK_ENV, SHARED_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("checkInternalRouteKey", () => {
  it("accepts the correct fallback key", async () => {
    const result = await checkInternalRouteKey(makeRequest(SHARED_KEY), {
      route: ROUTE,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a missing header with 401 Unauthorized", async () => {
    const result = await checkInternalRouteKey(makeRequest(undefined), {
      route: ROUTE,
    });
    expect(result).toEqual({ ok: false, status: 401, message: "Unauthorized" });
  });

  it("rejects a wrong key with 401 Unauthorized (non-enumerating)", async () => {
    const result = await checkInternalRouteKey(makeRequest("wrong-key"), {
      route: ROUTE,
    });
    expect(result).toEqual({ ok: false, status: 401, message: "Unauthorized" });
  });

  it("rejects keys of different lengths with 401", async () => {
    const result = await checkInternalRouteKey(makeRequest("a"), {
      route: ROUTE,
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 401 });
  });

  it("returns 500 Server configuration error when no key is configured", async () => {
    vi.stubEnv(INTERNAL_AUTH_FALLBACK_ENV, "");
    const result = await checkInternalRouteKey(makeRequest("any-key"), {
      route: ROUTE,
    });
    expect(result).toEqual({
      ok: false,
      status: 500,
      message: "Server configuration error",
    });
  });

  it("uses a route-dedicated key when set", async () => {
    vi.stubEnv("INTERNAL_INGESTION_API_KEY", "dedicated-ingestion-key");
    const good = await checkInternalRouteKey(makeRequest("dedicated-ingestion-key"), {
      route: ROUTE,
      keyEnvVar: "INTERNAL_INGESTION_API_KEY",
    });
    expect(good.ok).toBe(true);

    const bad = await checkInternalRouteKey(makeRequest(SHARED_KEY), {
      route: ROUTE,
      keyEnvVar: "INTERNAL_INGESTION_API_KEY",
    });
    expect(bad.ok).toBe(false);
  });

  it("falls back to the shared key when a dedicated key is unset", async () => {
    const result = await checkInternalRouteKey(makeRequest(SHARED_KEY), {
      route: ROUTE,
      keyEnvVar: "INTERNAL_INGESTION_API_KEY",
    });
    expect(result.ok).toBe(true);
  });

  it("never returns or logs the key material", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = await checkInternalRouteKey(makeRequest("wrong-key"), {
        route: ROUTE,
      });
      expect(result.ok).toBe(false);

      const records = warnSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
      expect(records).toHaveLength(1);
      expect(records[0].event).toBe("internal_route_auth_rejected");
      expect(records[0].route).toBe(ROUTE);
      expect(records[0].status).toBe(401);
      expect(records[0].errorCode).toBe("AUTH_FAILED");
      const raw = JSON.stringify(records);
      expect(raw).not.toContain("wrong-key");
      expect(raw).not.toContain(SHARED_KEY);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("logs AUTH_CONFIG_MISSING when no key is configured", async () => {
    vi.stubEnv(INTERNAL_AUTH_FALLBACK_ENV, "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await checkInternalRouteKey(makeRequest("any-key"), { route: ROUTE });
      const records = warnSpy.mock.calls.map(([arg]) => JSON.parse(arg as string));
      expect(records[0].errorCode).toBe("AUTH_CONFIG_MISSING");
    } finally {
      vi.restoreAllMocks();
    }
  });
});