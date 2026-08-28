import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../canonicalUrl";

describe("canonicalizeUrl", () => {
  it("returns null for null input", () => {
    expect(canonicalizeUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(canonicalizeUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(canonicalizeUrl("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(canonicalizeUrl("   ")).toBeNull();
  });

  it("lowercases scheme", () => {
    expect(canonicalizeUrl("HTTP://example.com")).toBe("http://example.com/");
    expect(canonicalizeUrl("HTTPS://example.com")).toBe(
      "https://example.com/",
    );
  });

  it("lowercases hostname", () => {
    expect(canonicalizeUrl("https://EXAMPLE.COM")).toBe(
      "https://example.com/",
    );
  });

  it("removes default port 80 for http", () => {
    expect(canonicalizeUrl("http://example.com:80")).toBe(
      "http://example.com/",
    );
  });

  it("removes default port 443 for https", () => {
    expect(canonicalizeUrl("https://example.com:443")).toBe(
      "https://example.com/",
    );
  });

  it("keeps non-default ports", () => {
    expect(canonicalizeUrl("https://example.com:8080")).toBe(
      "https://example.com:8080/",
    );
  });

  it("removes trailing slash from pathname", () => {
    expect(canonicalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path",
    );
  });

  it("keeps root slash", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe(
      "https://example.com/",
    );
  });

  it("sorts query parameters alphabetically", () => {
    expect(canonicalizeUrl("https://example.com?b=2&a=1")).toBe(
      "https://example.com/?a=1&b=2",
    );
  });

  it("strips URL fragments", () => {
    expect(canonicalizeUrl("https://example.com/path#section")).toBe(
      "https://example.com/path",
    );
  });

  it("handles complex URL", () => {
    const result = canonicalizeUrl(
      "HTTPS://EXAMPLE.COM:443/job/123?sort=date&page=2#top",
    );
    expect(result).toBe("https://example.com/job/123?page=2&sort=date");
  });

  it("returns lowercased string for invalid URLs", () => {
    expect(canonicalizeUrl("not-a-url")).toBe("not-a-url");
  });

  it("handles URL with multiple query params", () => {
    const result = canonicalizeUrl(
      "https://example.com?z=1&a=2&m=3",
    );
    expect(result).toBe("https://example.com/?a=2&m=3&z=1");
  });

  it("handles URL with encoded characters", () => {
    const result = canonicalizeUrl("https://example.com/path%20name");
    expect(result).toBe("https://example.com/path%20name");
  });
});
