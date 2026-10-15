import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/jobAlerts/delivery", () => ({
  unsubscribeAlertWithToken: (...a: unknown[]) => mocks.mockUnsubscribe(...a),
}));

import { GET } from "@/app/api/job-alerts/unsubscribe/route";

function makeRequest(token: string, locale?: string) {
  const params = new URLSearchParams({ token });
  if (locale) params.set("locale", locale);
  return new Request(`http://localhost:3000/api/job-alerts/unsubscribe?${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/job-alerts/unsubscribe", () => {
  it("returns 200 with confirmation when token is valid", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(true);
    const response = await GET(makeRequest("valid-token", "en"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Unsubscribed");
    expect(mocks.mockUnsubscribe).toHaveBeenCalledWith("valid-token");
  });

  it("returns 200 with expired message when token is invalid", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(false);
    const response = await GET(makeRequest("expired-token", "en"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Link expired");
    expect(body).toContain("invalid or has expired");
  });

  it("defaults to English locale for invalid locale values", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(true);
    const response = await GET(makeRequest("tok", "invalid"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('lang="en"');
  });

  it("renders Amharic locale when locale=am", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(true);
    const response = await GET(makeRequest("tok", "am"));
    const body = await response.text();
    expect(body).toContain('lang="am"');
  });

  it("renders Afaan Oromoo locale when locale=om", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(true);
    const response = await GET(makeRequest("tok", "om"));
    const body = await response.text();
    expect(body).toContain('lang="om"');
  });

  it("includes a back-to-home link", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(true);
    const response = await GET(makeRequest("tok", "en"));
    const body = await response.text();
    expect(body).toContain('href="/"');
  });

  it("handles empty token gracefully", async () => {
    mocks.mockUnsubscribe.mockResolvedValue(false);
    const response = await GET(makeRequest("", "en"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Link expired");
  });
});
