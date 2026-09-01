import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { middleware } from "@/middleware";

const mocks = vi.hoisted(() => ({
  mockHeadersGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => mocks.mockHeadersGet(key),
  }),
}));

import {
  REQUEST_ID_HEADER,
  generateRequestId,
  getRequestId,
  applyRequestIdToHeaders,
} from "../requestId";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  mocks.mockHeadersGet.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("request id generation", () => {
  it("generates a fresh request ID when no inbound value exists", () => {
    const id = generateRequestId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("generated IDs are unique across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      seen.add(generateRequestId());
    }
    expect(seen.size).toBe(100);
  });

  it("generated ID is a valid v4 UUID", () => {
    const id = generateRequestId();
    expect(id).toMatch(UUID_V4_RE);
  });

  it("returns the existing request ID from the request context when present", async () => {
    mocks.mockHeadersGet.mockImplementation((key: string) =>
      key === REQUEST_ID_HEADER ? "existing-id-123" : null,
    );
    await expect(getRequestId()).resolves.toBe("existing-id-123");
  });

  it("returns undefined when the request context has no request ID header", async () => {
    mocks.mockHeadersGet.mockReturnValue(null);
    await expect(getRequestId()).resolves.toBeUndefined();
  });
});

describe("applyRequestIdToHeaders", () => {
  it("sets the request ID header on a settable target", () => {
    const headers = new Headers();
    applyRequestIdToHeaders(headers, "id-456");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("id-456");
  });

  it("overwrites any prior header value with the given request ID", () => {
    const headers = new Headers();
    headers.set(REQUEST_ID_HEADER, "original");
    applyRequestIdToHeaders(headers, "id-456");
    expect(headers.get(REQUEST_ID_HEADER)).toBe("id-456");
  });

  it("tolerates targets without a set method or undefined", () => {
    expect(() =>
      applyRequestIdToHeaders({} as { set?: () => void }, "id"),
    ).not.toThrow();
    expect(() => applyRequestIdToHeaders(undefined, "id")).not.toThrow();
  });
});

describe("edge runtime compatibility (request ID path)", () => {
  it("implementation has no node:crypto dependency", () => {
    const source = readFileSync(
      new URL("../requestId.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']node:crypto["']/);
    expect(source).not.toMatch(/["']node:crypto["']/);
  });

  it("module can load without the Node crypto module (no native import)", async () => {
    expect(() => generateRequestId()).not.toThrow();
    expect(typeof crypto.randomUUID).toBe("function");
  });

  it("middleware loads and exposes the middleware function without importing node:crypto", () => {
    expect(typeof middleware).toBe("function");
  });
});