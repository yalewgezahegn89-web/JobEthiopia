import { XMLParser } from "fast-xml-parser";
import { ssrfFetch } from "@/lib/ssrf";
import { jsonFeedItemSchema } from "./feedSchema";
import {
  MAX_FEED_BYTES,
  MAX_FEED_ITEMS,
  loadFeedSource,
  errorMessage,
  resolveSafeHttpUrl,
  type FeedParseContext,
} from "./feedSource";
import { classifyApplicantEligibility } from "@/lib/jobs/applicantEligibility";
import type { SourceAdapter, FetchResult } from "../adapter";
import type { RawJobInput } from "@/lib/ingestion/types";

type XmlRecord = Record<string, unknown>;

/**
 * Hardened XML parser settings:
 * - namespaces are stripped so `dc:creator` / `content:encoded` are usable,
 * - text and attribute values are never coerced to numbers/booleans,
 * - entity expansion is disabled; external entities are never resolved.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  removeNSPrefix: true,
});

function isRecord(value: unknown): value is XmlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textOf(item);
      if (text) return text;
    }
    return null;
  }
  if (isRecord(value)) {
    if ("#text" in value) return textOf(value["#text"]);
  }
  return null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

interface LinkInfo {
  url: string | null;
  unsafe: boolean;
}

/**
 * Resolves a feed link (string, array, or Atom link object) against the feed
 * base URL. Relative links are accepted; non-http(s) links are reported as
 * unsafe so the containing record can be dropped.
 */
function extractLink(value: unknown, baseUrl: string): LinkInfo {
  let sawValue = false;

  const candidates = asArray(value);
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      if (!candidate.trim()) continue;
      sawValue = true;
      const resolved = resolveSafeHttpUrl(candidate, baseUrl);
      if (resolved) return { url: resolved, unsafe: false };
      continue;
    }
    if (isRecord(candidate)) {
      const rel = textOf(candidate["@_rel"]);
      if (rel && rel !== "alternate" && rel !== "self") continue;
      const href = candidate["@_href"] ?? candidate["#text"];
      if (typeof href !== "string" || !href.trim()) continue;
      sawValue = true;
      const resolved = resolveSafeHttpUrl(href, baseUrl);
      if (resolved) return { url: resolved, unsafe: false };
    }
  }

  return { url: null, unsafe: sawValue };
}

function firstText(record: XmlRecord, keys: string[]): string | null {
  for (const key of keys) {
    const text = textOf(record[key]);
    if (text) return text;
  }
  return null;
}

function organizationName(record: XmlRecord, fallback: string): string {
  const author = record.author;
  if (isRecord(author)) {
    const name = textOf(author.name);
    if (name) return name;
  }
  return (
    firstText(record, ["creator", "author", "organization", "company"]) ??
    fallback
  );
}

function buildCandidate(
  item: unknown,
  context: FeedParseContext,
): unknown | null {
  if (!isRecord(item)) return null;

  const title = textOf(item.title);
  const description =
    firstText(item, ["content", "encoded", "summary", "description"]) ?? null;
  if (!title || !description) return null;

  const link = extractLink(item.link, context.baseUrl);
  // A record that advertises a link but only supplies an unsafe scheme is
  // rejected instead of being imported with a dangerous URL.
  if (link.unsafe) return null;

  const eligibilityText = firstText(item, [
    "applicantEligibility",
    "eligibility",
    "applicantLocationRequirements",
  ]);

  return {
    title,
    description,
    organizationName: organizationName(item, context.sourceName),
    locationName: firstText(item, [
      "location",
      "jobLocation",
      "area",
      "locationName",
    ]),
    professionName: firstText(item, ["profession", "professionName"]),
    categoryName: firstText(item, ["category", "categoryName"]),
    employmentType: firstText(item, ["employmentType", "jobType", "type"]),
    salaryRaw: firstText(item, ["salary", "salaryRaw"]),
    experienceRaw: firstText(item, ["experience", "experienceRaw"]),
    responsibilities: firstText(item, ["responsibilities"]),
    requirements: firstText(item, ["requirements"]),
    educationRequirements: firstText(item, [
      "educationRequirements",
      "education",
    ]),
    benefits: firstText(item, ["benefits"]),
    postedAt: toIsoDate(
      firstText(item, ["pubDate", "published", "updated", "date", "postedAt"]),
    ),
    deadline: toIsoDate(
      firstText(item, [
        "expirationDate",
        "deadline",
        "validThrough",
        "applicationDeadline",
      ]),
    ),
    applicantEligibility:
      classifyApplicantEligibility(eligibilityText) === "NOT_STATED"
        ? undefined
        : classifyApplicantEligibility(eligibilityText),
    applicationUrl: link.url,
    sourceUrl: link.url,
    externalId:
      firstText(item, ["guid", "id", "externalId"]) ??
      link.url ??
      `${context.sourceId}:${context.sourceName}:${title}`,
  };
}

function detectFeed(
  parsed: unknown,
): { format: "RSS" | "ATOM" | "RDF"; items: unknown[] } | null {
  if (!isRecord(parsed)) return null;

  const rss = parsed.rss;
  if (isRecord(rss)) {
    const channel = rss.channel;
    if (isRecord(channel)) return { format: "RSS", items: asArray(channel.item) };
    return { format: "RSS", items: asArray(rss.item) };
  }

  const feed = parsed.feed;
  if (isRecord(feed)) {
    return { format: "ATOM", items: asArray(feed.entry) };
  }

  const rdf = parsed.RDF;
  if (isRecord(rdf)) {
    return { format: "RDF", items: asArray(rdf.item) };
  }

  return null;
}

export type XmlFeedParseResult =
  | { ok: true; jobs: RawJobInput[]; format: "RSS" | "ATOM" | "RDF" }
  | { ok: false; error: string };

/**
 * Parses an RSS 2.0, RSS 1.0 (RDF) or Atom document into validated raw jobs.
 * Invalid records are skipped individually; malformed documents fail the
 * whole fetch with a safe error.
 */
export function parseXmlFeedBody(
  text: string,
  context: FeedParseContext,
  maxItems: number = MAX_FEED_ITEMS,
): XmlFeedParseResult {
  const trimmed = text.trim();
  if (!trimmed.startsWith("<")) {
    return { ok: false, error: "Invalid XML response" };
  }

  let parsed: unknown;
  try {
    parsed = parser.parse(trimmed);
  } catch {
    return { ok: false, error: "Invalid XML response" };
  }

  const detected = detectFeed(parsed);
  if (!detected) {
    return { ok: false, error: "Unsupported XML feed format" };
  }

  const jobs: RawJobInput[] = [];
  for (const item of detected.items.slice(0, maxItems)) {
    const candidate = buildCandidate(item, context);
    if (!candidate) continue;
    const result = jsonFeedItemSchema.safeParse(candidate);
    if (!result.success) continue;
    jobs.push({ ...result.data, sourceId: context.sourceId });
  }

  return { ok: true, jobs, format: detected.format };
}

/** Returns true when the body looks like an RSS/Atom/RDF XML document. */
export function looksLikeXmlFeed(text: string): boolean {
  const head = text.slice(0, 1024).trimStart();
  if (!head.startsWith("<")) return false;
  return /<rss[\s>]|<feed[\s>]|<rdf:RDF[\s>]/i.test(head);
}

/** Adapter for RSS/Atom feeds. */
export class XmlFeedAdapter implements SourceAdapter {
  constructor(private readonly maxItems: number = MAX_FEED_ITEMS) {}

  async fetchJobs(sourceId: string): Promise<FetchResult> {
    const loaded = await loadFeedSource(sourceId);
    if (!loaded.ok) return { success: false, error: loaded.error };

    const { source } = loaded;

    let response;
    try {
      response = await ssrfFetch(source.baseUrl!, {
        method: "GET",
        maxBytes: MAX_FEED_BYTES,
      });
    } catch (err: unknown) {
      return { success: false, error: errorMessage(err) };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const parsed = parseXmlFeedBody(
      response.text ?? "",
      {
        sourceId: source.id,
        sourceName: source.name,
        baseUrl: source.baseUrl!,
      },
      this.maxItems,
    );

    if (!parsed.ok) return { success: false, error: parsed.error };
    return { success: true, jobs: parsed.jobs };
  }
}
