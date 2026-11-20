import { describe, it, expect } from "vitest";
import {
  looksLikeXmlFeed,
  parseXmlFeedBody,
} from "../xmlFeed";

const CONTEXT = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceName: "Ethiopian Airlines",
  baseUrl: "https://www.ethiopianairlines.com/careers/feed.xml",
};

describe("looksLikeXmlFeed", () => {
  it("recognises RSS, Atom and RDF documents", () => {
    expect(looksLikeXmlFeed("<rss version=\"2.0\">")).toBe(true);
    expect(looksLikeXmlFeed("<feed xmlns=\"http://www.w3.org/2005/Atom\">")).toBe(
      true,
    );
    expect(looksLikeXmlFeed("<rdf:RDF>")).toBe(true);
  });

  it("rejects non-XML and unrelated XML documents", () => {
    expect(looksLikeXmlFeed("[]")).toBe(false);
    expect(looksLikeXmlFeed("<html><body></body></html>")).toBe(false);
  });
});

describe("parseXmlFeedBody", () => {
  it("parses an RSS 2.0 feed with explicit eligibility", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Careers</title>
          <item>
            <title>First Officer</title>
            <description>Operate our fleet.</description>
            <link>https://www.ethiopianairlines.com/jobs/1</link>
            <guid>job-1</guid>
            <pubDate>Mon, 01 Jun 2026 08:00:00 GMT</pubDate>
            <expirationDate>2026-07-01T00:00:00.000Z</expirationDate>
            <eligibility>Open to Ethiopian applicants</eligibility>
          </item>
        </channel>
      </rss>`;

    const result = parseXmlFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.format).toBe("RSS");
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      title: "First Officer",
      description: "Operate our fleet.",
      organizationName: "Ethiopian Airlines",
      sourceId: CONTEXT.sourceId,
      applicationUrl: "https://www.ethiopianairlines.com/jobs/1",
      externalId: "job-1",
      applicantEligibility: "ETHIOPIAN_APPLICANTS_CONFIRMED",
    });
  });

  it("parses an Atom feed", () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Flight Dispatcher</title>
          <summary>Coordinate operations.</summary>
          <link rel="alternate" href="https://www.ethiopianairlines.com/jobs/2" />
          <id>job-2</id>
          <updated>2026-06-02T09:00:00.000Z</updated>
        </entry>
      </feed>`;

    const result = parseXmlFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.format).toBe("ATOM");
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Flight Dispatcher");
    expect(result.jobs[0].applicationUrl).toBe(
      "https://www.ethiopianairlines.com/jobs/2",
    );
    expect(result.jobs[0].externalId).toBe("job-2");
  });

  it("parses an RSS 1.0 RDF feed", () => {
    const xml = `<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <item>
          <title>Cabin Crew</title>
          <description>Deliver exceptional service.</description>
          <link>https://www.ethiopianairlines.com/jobs/3</link>
        </item>
      </rdf:RDF>`;

    const result = parseXmlFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("RDF");
    expect(result.jobs[0].title).toBe("Cabin Crew");
  });

  it("drops a record whose only link uses an unsafe scheme", () => {
    const xml = `<rss><channel><item>
      <title>First Officer</title>
      <description>Operate our fleet.</description>
      <link>javascript:alert(1)</link>
    </item></channel></rss>`;

    const result = parseXmlFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toEqual([]);
  });

  it("skips invalid records individually", () => {
    const xml = `<rss><channel>
      <item><title>Missing description</title></item>
      <item>
        <title>First Officer</title>
        <description>Operate our fleet.</description>
      </item>
    </channel></rss>`;

    const result = parseXmlFeedBody(xml, CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("First Officer");
  });

  it("caps the number of parsed records", () => {
    const xml = `<rss><channel>
      <item>
        <title>First Officer</title>
        <description>Operate our fleet.</description>
      </item>
      <item>
        <title>Cabin Crew</title>
        <description>Deliver service.</description>
      </item>
    </channel></rss>`;

    const result = parseXmlFeedBody(xml, CONTEXT, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("First Officer");
  });

  it("fails safely for malformed or unsupported XML", () => {
    expect(parseXmlFeedBody("not xml", CONTEXT)).toEqual({
      ok: false,
      error: "Invalid XML response",
    });
    expect(parseXmlFeedBody("<html><body /></html>", CONTEXT)).toEqual({
      ok: false,
      error: "Unsupported XML feed format",
    });
  });
});
