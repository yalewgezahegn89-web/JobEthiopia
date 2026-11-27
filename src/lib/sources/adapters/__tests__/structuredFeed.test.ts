import { describe, it, expect } from "vitest";
import { parseStructuredFeedBody } from "../structuredFeed";

const CONTEXT = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceName: "Ethiopian Airlines",
  baseUrl: "https://www.ethiopianairlines.com/careers",
};

const JSON_ITEM = {
  title: "First Officer",
  description: "Operate our fleet.",
  organizationName: "Ethiopian Airlines",
  applicationUrl: "https://www.ethiopianairlines.com/jobs/1",
  externalId: "job-1",
};

const JOB_POSTING = {
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Cabin Crew",
  description: "Deliver exceptional service.",
  hiringOrganization: { name: "Ethiopian Airlines" },
  url: "https://www.ethiopianairlines.com/jobs/2",
};

describe("parseStructuredFeedBody", () => {
  it("detects the documented JSON feed array", () => {
    const result = parseStructuredFeedBody(
      JSON.stringify([JSON_ITEM]),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("JSON_FEED");
    expect(result.jobs[0].title).toBe("First Officer");
  });

  it("detects a JSON JobPosting object", () => {
    const result = parseStructuredFeedBody(
      JSON.stringify(JOB_POSTING),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("JSON_LD");
    expect(result.jobs[0].title).toBe("Cabin Crew");
  });

  it("detects an XML feed", () => {
    const xml = `<rss><channel><item>
      <title>Dispatcher</title>
      <description>Coordinate flights.</description>
    </item></channel></rss>`;

    const result = parseStructuredFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("XML_FEED");
    expect(result.jobs[0].title).toBe("Dispatcher");
  });

  it("detects JSON-LD embedded in HTML", () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify(JOB_POSTING)}</script>
    </head><body></body></html>`;

    const result = parseStructuredFeedBody(html, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("JSON_LD");
    expect(result.jobs).toHaveLength(1);
  });

  it("rejects empty, malformed and unsupported bodies", () => {
    expect(parseStructuredFeedBody("", CONTEXT)).toEqual({
      ok: false,
      error: "Empty response",
    });
    expect(parseStructuredFeedBody("[not json", CONTEXT)).toEqual({
      ok: false,
      error: "Invalid JSON response",
    });
    expect(parseStructuredFeedBody("plain text", CONTEXT)).toEqual({
      ok: false,
      error: "Unsupported feed content type",
    });
    expect(
      parseStructuredFeedBody("<html><body>No data</body></html>", CONTEXT),
    ).toEqual({
      ok: false,
      error: "Unsupported structured feed format",
    });
  });

  it("honours the item cap", () => {
    const result = parseStructuredFeedBody(
      JSON.stringify([JSON_ITEM, { ...JSON_ITEM, title: "Second" }]),
      CONTEXT,
      1,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(1);
  });
});
