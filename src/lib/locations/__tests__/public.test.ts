import { describe, it, expect, vi } from "vitest";
import {
  fetchLocations,
  fetchLocationById,
  toPublicLocationSummary,
  toPublicLocationDetail,
  PublicApiError,
} from "../public";

const BASE_URL = "https://example.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFetcher(response: Response | (() => Response)) {
  return vi.fn(async () =>
    typeof response === "function" ? response() : response,
  );
}

function calledUrl(fetcher: ReturnType<typeof vi.fn>): string {
  const input = fetcher.mock.calls[0][0];
  return String(input);
}

const PARENT_ID = "110e8400-e29b-41d4-a716-446655440010";

const FULL_LOCATION_ITEM = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Addis Ababa",
  slug: "addis-ababa",
  type: "CITY",
  parentId: PARENT_ID,
  latitude: "9.0192",
  longitude: "38.7525",
  isActive: true,
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

describe("fetchLocations URL construction", () => {
  it("defaults page to 1", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("page=1");
  });

  it("defaults limit to 20", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("limit=20");
  });

  it("defaults isActive to true", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("isActive=true");
  });

  it("sends explicit isActive=false", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({ isActive: false }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("isActive=false");
  });

  it("sends type filter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({ type: "CITY" }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("type=CITY");
  });

  it("sends parentId filter", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({ parentId: PARENT_ID }, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain("parentId=110e8400-e29b-41d4-a716-446655440010");
  });

  it("orders page, limit, isActive before type, then parentId", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations(
      { type: "CITY", parentId: PARENT_ID },
      { baseUrl: BASE_URL, fetcher },
    );

    const url = calledUrl(fetcher);
    expect(url.indexOf("page=1")).toBeLessThan(url.indexOf("type=CITY"));
    expect(url.indexOf("limit=20")).toBeLessThan(url.indexOf("type=CITY"));
    expect(url.indexOf("isActive=true")).toBeLessThan(url.indexOf("type=CITY"));
    expect(url.indexOf("type=CITY")).toBeLessThan(url.indexOf("parentId="));
  });

  it("builds URL against the locations API", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/locations`);
  });
});

describe("fetchLocations base URL handling", () => {
  it("uses explicit baseUrl", async () => {
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(calledUrl(fetcher)).toContain(`${BASE_URL}/api/locations`);
  });

  it("uses APP_BASE_URL when baseUrl is not provided", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://jobs.et";
    const fetcher = makeFetcher(jsonResponse({ items: [], pagination: {} }));
    await fetchLocations({}, { fetcher });

    expect(calledUrl(fetcher)).toContain("https://jobs.et/api/locations");

    if (previous === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = previous;
    }
  });
});

describe("fetchLocations response handling", () => {
  it("maps successful API items to location summaries", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [FULL_LOCATION_ITEM],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: FULL_LOCATION_ITEM.id,
      name: "Addis Ababa",
      slug: "addis-ababa",
      type: "CITY",
      parentId: PARENT_ID,
      isActive: true,
    });
  });

  it("maps pagination", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [],
        pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
      }),
    );

    const result = await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("handles nullable parentId", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        items: [{ ...FULL_LOCATION_ITEM, id: "x", parentId: null }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );

    const result = await fetchLocations({}, { baseUrl: BASE_URL, fetcher });

    expect(result.items[0].parentId).toBeNull();
  });

  it("preserves summary fields and maps unknown type to OTHER", () => {
    const summary = toPublicLocationSummary({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Some Place",
      slug: "some-place",
      type: "UNKNOWN_TYPE",
      parentId: null,
      isActive: false,
    });

    expect(summary).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Some Place",
      slug: "some-place",
      type: "OTHER",
      parentId: null,
      isActive: false,
    });
  });

  it("does not fabricate parentName, regionName, jobCount or childCount", () => {
    const summary = toPublicLocationSummary(FULL_LOCATION_ITEM);

    expect("parentName" in summary).toBe(false);
    expect("regionName" in summary).toBe(false);
    expect("countryName" in summary).toBe(false);
    expect("jobCount" in summary).toBe(false);
    expect("childCount" in summary).toBe(false);
    expect("description" in summary).toBe(false);
  });

  it("throws generic PublicApiError on non-OK list response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchLocations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON list response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchLocations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("does not leak upstream error-message text for list responses", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "internal database failure: psql ..." }, 500),
    );

    const error = await fetchLocations({}, { baseUrl: BASE_URL, fetcher })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
    if (error instanceof Error) {
      expect(error.message).not.toContain("database");
      expect(error.message).not.toContain("psql");
      expect(error.message).not.toContain("internal database failure");
    }
  });
});

describe("toPublicLocationDetail", () => {
  it("maps all detail fields including latitude, longitude and timestamps", () => {
    const detail = toPublicLocationDetail(FULL_LOCATION_ITEM);

    expect(detail).toMatchObject({
      id: FULL_LOCATION_ITEM.id,
      name: "Addis Ababa",
      type: "CITY",
      parentId: PARENT_ID,
      isActive: true,
      latitude: "9.0192",
      longitude: "38.7525",
      createdAt: "2026-01-15T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  });

  it("maps latitude as nullable string", () => {
    const detail = toPublicLocationDetail({
      ...FULL_LOCATION_ITEM,
      id: "x",
      latitude: null,
      longitude: null,
    });

    expect(detail.latitude).toBeNull();
    expect(detail.longitude).toBeNull();
  });

  it("maps longitude as nullable string", async () => {
    const fetcher = makeFetcher(
      jsonResponse({
        item: { ...FULL_LOCATION_ITEM, id: "x", longitude: null },
      }),
    );

    const detail = await fetchLocationById("x", { baseUrl: BASE_URL, fetcher });

    expect(detail?.longitude).toBeNull();
    expect(detail?.latitude).toBe("9.0192");
  });

  it("maps the set of expected fields", () => {
    const detail = toPublicLocationDetail(FULL_LOCATION_ITEM);
    const keys = Object.keys(detail).sort();

    expect(keys).toEqual(
      [
        "id",
        "name",
        "slug",
        "type",
        "parentId",
        "isActive",
        "latitude",
        "longitude",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
  });
});

describe("fetchLocationById", () => {
  it("returns null on 404", async () => {
    const fetcher = makeFetcher(
      jsonResponse({ error: "Location not found" }, 404),
    );

    const result = await fetchLocationById("missing", {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("returns null when item is missing", async () => {
    const fetcher = makeFetcher(jsonResponse({}));

    const result = await fetchLocationById(FULL_LOCATION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result).toBeNull();
  });

  it("throws generic PublicApiError on non-OK detail response", async () => {
    const fetcher = makeFetcher(jsonResponse({ error: "boom" }, 500));

    const error = await fetchLocationById(FULL_LOCATION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("throws generic PublicApiError on invalid JSON detail response", async () => {
    const fetcher = vi.fn(async () =>
      new Response("not json", { status: 200 }),
    );

    const error = await fetchLocationById(FULL_LOCATION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    })
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PublicApiError);
  });

  it("maps a successful detail item", async () => {
    const fetcher = makeFetcher(jsonResponse({ item: FULL_LOCATION_ITEM }));

    const result = await fetchLocationById(FULL_LOCATION_ITEM.id, {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(result?.name).toBe("Addis Ababa");
    expect(result?.type).toBe("CITY");
    expect(result?.parentId).toBe(PARENT_ID);
    expect(result?.latitude).toBe("9.0192");
    expect(result?.longitude).toBe("38.7525");
  });
});
