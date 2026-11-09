import { describe, it, expect, afterEach, vi } from "vitest";
import {
  FACEBOOK_DEFAULT_GRAPH_API_BASE_URL,
  FACEBOOK_DEFAULT_GRAPH_API_VERSION,
  getExternalPageAccessToken,
  getFacebookGraphConfig,
  getOwnedPageAccessToken,
  isFacebookIngestionEnabled,
  redactFacebookSecrets,
} from "../config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("Facebook config", () => {
  it("is disabled unless the flag is exactly true", () => {
    delete process.env.ENABLE_FACEBOOK_INGESTION;
    expect(isFacebookIngestionEnabled()).toBe(false);
    process.env.ENABLE_FACEBOOK_INGESTION = "1";
    expect(isFacebookIngestionEnabled()).toBe(false);
    process.env.ENABLE_FACEBOOK_INGESTION = "true";
    expect(isFacebookIngestionEnabled()).toBe(true);
  });

  it("defaults the Graph API version and base URL", () => {
    delete process.env.FACEBOOK_GRAPH_API_VERSION;
    delete process.env.FACEBOOK_GRAPH_API_BASE_URL;
    expect(getFacebookGraphConfig()).toEqual({
      apiVersion: FACEBOOK_DEFAULT_GRAPH_API_VERSION,
      apiBaseUrl: FACEBOOK_DEFAULT_GRAPH_API_BASE_URL,
    });
  });

  it("ignores an invalid Graph API version", () => {
    process.env.FACEBOOK_GRAPH_API_VERSION = "latest";
    expect(getFacebookGraphConfig().apiVersion).toBe(
      FACEBOOK_DEFAULT_GRAPH_API_VERSION,
    );
  });

  it("reads the owned Page token from the environment only", () => {
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    expect(getOwnedPageAccessToken().ok).toBe(false);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "page-token";
    expect(getOwnedPageAccessToken()).toEqual({
      ok: true,
      accessToken: "page-token",
    });
  });

  it("prefers an explicit app token and otherwise derives app|secret", () => {
    process.env.FACEBOOK_APP_ACCESS_TOKEN = "app-token";
    expect(getExternalPageAccessToken()).toEqual({
      ok: true,
      accessToken: "app-token",
    });

    delete process.env.FACEBOOK_APP_ACCESS_TOKEN;
    process.env.FACEBOOK_APP_ID = "app-id";
    process.env.FACEBOOK_APP_SECRET = "app-secret";
    expect(getExternalPageAccessToken()).toEqual({
      ok: true,
      accessToken: "app-id|app-secret",
    });
  });

  it.each([
    ["plaintext HTTP", "http://graph.facebook.com"],
    ["an alternate port", "https://graph.facebook.com:8443"],
    ["credentials in the URL", "https://user:pass@graph.facebook.com"],
    ["a lookalike host", "https://graph.facebook.com.evil.example"],
    ["a query string", "https://graph.facebook.com?x=1"],
    ["a fragment", "https://graph.facebook.com#fragment"],
    ["a non-root path", "https://graph.facebook.com/graphql"],
  ])("ignores an untrusted Graph base URL (%s)", (_label, raw) => {
    process.env.FACEBOOK_GRAPH_API_BASE_URL = raw;
    expect(getFacebookGraphConfig().apiBaseUrl).toBe(
      FACEBOOK_DEFAULT_GRAPH_API_BASE_URL,
    );
  });

  it("accepts the official Graph origin with an explicit 443 port", () => {
    process.env.FACEBOOK_GRAPH_API_BASE_URL =
      "https://graph.facebook.com:443/";
    expect(getFacebookGraphConfig().apiBaseUrl).toBe(
      FACEBOOK_DEFAULT_GRAPH_API_BASE_URL,
    );
  });

  it("redacts access tokens and bearer headers", () => {
    expect(
      redactFacebookSecrets(
        "GET /posts?access_token=secret-value Authorization: Bearer abc123",
      ),
    ).not.toContain("secret-value");
    expect(
      redactFacebookSecrets("Authorization: Bearer abc123"),
    ).not.toContain("abc123");
  });
});
