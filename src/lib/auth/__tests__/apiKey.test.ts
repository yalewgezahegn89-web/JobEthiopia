import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkApiKey,
  fingerprintApiKey,
  getApiKeyFingerprint,
} from "../apiKey";

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

describe("api key fingerprint", () => {
  it("derives a deterministic, one-way fingerprint from the key", () => {
    const fp1 = fingerprintApiKey("shared-key-abc");
    const fp2 = fingerprintApiKey("shared-key-abc");
    expect(fp1).toBe(fp2);
    expect(fp1).not.toContain("shared-key-abc");
    expect(fp1).toMatch(/^apikey_/);
    expect(fp1.length).toBeGreaterThan(7);
  });

  it("produces distinct fingerprints for distinct keys", () => {
    expect(fingerprintApiKey("key-one")).not.toBe(
      fingerprintApiKey("key-two"),
    );
  });

  it("returns the configured key fingerprint and null when unset", () => {
    vi.stubEnv("INGESTION_API_KEY", "configured-shared-key");
    expect(getApiKeyFingerprint()).toBe(
      fingerprintApiKey("configured-shared-key"),
    );

    vi.stubEnv("INGESTION_API_KEY", "");
    expect(getApiKeyFingerprint()).toBeNull();
  });

  it("never reveals the configured key through the fingerprint", () => {
    vi.stubEnv("INGESTION_API_KEY", "super-secret-value");
    expect(getApiKeyFingerprint()).not.toContain("super-secret-value");
  });
});