import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkApiKey } from "../apiKey";

function makeRequest(apiKey?: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: apiKey ? { "x-api-key": apiKey } : {},
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("apiKey bridge", () => {
  it("accepts a valid key", () => {
    vi.stubEnv("INGESTION_API_KEY", "correct-key");
    expect(checkApiKey(makeRequest("correct-key"))).toEqual({ ok: true });
  });

  it("rejects a wrong key", () => {
    vi.stubEnv("INGESTION_API_KEY", "correct-key");
    const result = checkApiKey(makeRequest("wrong-key"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("rejects a missing key header", () => {
    vi.stubEnv("INGESTION_API_KEY", "correct-key");
    const result = checkApiKey(makeRequest(undefined));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("returns a configuration error when the env key is absent", () => {
    vi.stubEnv("INGESTION_API_KEY", "");
    const result = checkApiKey(makeRequest("anything"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
    }
  });

  it("never leaks the configured secret in error messages", () => {
    vi.stubEnv("INGESTION_API_KEY", "super-secret-value");
    const result = checkApiKey(makeRequest("wrong-key"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).not.toContain("super-secret-value");
    }
  });
});