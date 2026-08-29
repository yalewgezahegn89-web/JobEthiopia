import { describe, it, expect } from "vitest";
import { escapeLikePattern, checkBodySize, DEFAULT_MAX_BODY_BYTES, INGESTION_MAX_BODY_BYTES } from "../apiUtils";

describe("escapeLikePattern", () => {
  it("returns plain text unchanged", () => {
    expect(escapeLikePattern("hello")).toBe("hello");
  });

  it("escapes percent wildcard", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes underscore wildcard", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes backslash first to avoid double-escaping", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("escapes all three special characters in one string", () => {
    expect(escapeLikePattern("%_\\test")).toBe("\\%\\_\\\\test");
  });

  it("handles empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(escapeLikePattern("%_\\")).toBe("\\%\\_\\\\");
  });

  it("preserves normal characters around specials", () => {
    expect(escapeLikePattern("foo%bar_baz\\qux")).toBe("foo\\%bar\\_baz\\\\qux");
  });
});

describe("checkBodySize", () => {
  function makeRequest(contentLength?: number): Request {
    const headers: Record<string, string> = {};
    if (contentLength !== undefined) {
      headers["content-length"] = String(contentLength);
    }
    return new Request("http://localhost/api/test", {
      method: "POST",
      headers,
    });
  }

  it("returns null when content-length is within limit", () => {
    expect(checkBodySize(makeRequest(100))).toBeNull();
  });

  it("returns null when content-length equals the limit", () => {
    expect(checkBodySize(makeRequest(DEFAULT_MAX_BODY_BYTES))).toBeNull();
  });

  it("returns 413 when content-length exceeds default limit", () => {
    const result = checkBodySize(makeRequest(DEFAULT_MAX_BODY_BYTES + 1));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
  });

  it("returns null when content-length header is absent", () => {
    expect(checkBodySize(makeRequest())).toBeNull();
  });

  it("returns null for non-numeric content-length", () => {
    const headers = new Headers({ "content-length": "not-a-number" });
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers,
    });
    expect(checkBodySize(req)).toBeNull();
  });

  it("respects custom maxBytes parameter", () => {
    const smallLimit = 50;
    expect(checkBodySize(makeRequest(49), smallLimit)).toBeNull();
    expect(checkBodySize(makeRequest(51), smallLimit)).not.toBeNull();
  });

  it("uses ingestion limit for batch payloads", () => {
    expect(checkBodySize(makeRequest(INGESTION_MAX_BODY_BYTES), INGESTION_MAX_BODY_BYTES)).toBeNull();
    expect(checkBodySize(makeRequest(INGESTION_MAX_BODY_BYTES + 1), INGESTION_MAX_BODY_BYTES)).not.toBeNull();
  });
});
