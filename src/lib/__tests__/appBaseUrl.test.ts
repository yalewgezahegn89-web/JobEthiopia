import { describe, it, expect, afterEach, vi } from "vitest";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppBaseUrl production safety (B99)", () => {
  it("returns a configured APP_BASE_URL verbatim (production)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://jobs.example.com");
    expect(getAppBaseUrl()).toBe("https://jobs.example.com");
  });

  it("throws in production when APP_BASE_URL is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "");
    expect(() => getAppBaseUrl()).toThrow("APP_BASE_URL is required in production");
  });

  it("throws in production when APP_BASE_URL is blank/whitespace", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "   ");
    expect(() => getAppBaseUrl()).toThrow("APP_BASE_URL is required in production");
  });

  it("throws in production when APP_BASE_URL is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    const previous = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;
    try {
      expect(() => getAppBaseUrl()).toThrow("APP_BASE_URL is required in production");
    } finally {
      if (previous !== undefined) process.env.APP_BASE_URL = previous;
    }
  });

  it("falls back to localhost for local development when unset", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "");
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("uses the configured value in development too", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "http://localhost:4000");
    expect(getAppBaseUrl()).toBe("http://localhost:4000");
  });
});
