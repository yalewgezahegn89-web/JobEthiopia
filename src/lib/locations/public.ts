import { getAppBaseUrl } from "@/lib/appBaseUrl";

export type PublicLocationType =
  | "COUNTRY"
  | "REGION"
  | "CITY"
  | "DISTRICT"
  | "OTHER";

export type PublicLocationQuery = {
  page?: number;
  limit?: number;
  type?: PublicLocationType;
  parentId?: string;
  isActive?: boolean;
};

export type PublicLocationPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicLocationSummary = {
  id: string;
  name: string;
  slug: string;
  type: PublicLocationType;
  parentId: string | null;
  isActive: boolean;
};

export type PublicLocationDetail = PublicLocationSummary & {
  latitude: string | null;
  longitude: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicLocationList = {
  items: PublicLocationSummary[];
  pagination: PublicLocationPagination;
};

export class PublicApiError extends Error {
  constructor(message = "Unable to load data") {
    super(message);
    this.name = "PublicApiError";
  }
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type FetchLayerOptions = {
  baseUrl?: string;
  fetcher?: Fetcher;
};

function getBaseUrl(baseUrl?: string): string {
  return baseUrl || getAppBaseUrl();
}

function getFetcher(fetcher?: Fetcher): Fetcher {
  return fetcher ?? ((input, init) => fetch(input, init));
}

function safeParse(res: Response): Promise<unknown> {
  return res.json().catch(() => {
    throw new PublicApiError();
  });
}

function nullableString(raw: unknown): string | null {
  return raw != null ? String(raw) : null;
}

function toType(raw: unknown): PublicLocationType {
  if (
    raw === "COUNTRY" ||
    raw === "REGION" ||
    raw === "CITY" ||
    raw === "DISTRICT" ||
    raw === "OTHER"
  ) {
    return raw;
  }
  return "OTHER";
}

export function toPublicLocationSummary(
  raw: Record<string, unknown>,
): PublicLocationSummary {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    type: toType(raw.type),
    parentId: typeof raw.parentId === "string" ? raw.parentId : null,
    isActive: raw.isActive === true,
  };
}

export function toPublicLocationDetail(
  raw: Record<string, unknown>,
): PublicLocationDetail {
  return {
    ...toPublicLocationSummary(raw),
    latitude: nullableString(raw.latitude),
    longitude: nullableString(raw.longitude),
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicLocationPagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchLocations(
  query: PublicLocationQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicLocationList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("isActive", String(query.isActive ?? true));
  if (query.type) {
    params.set("type", query.type);
  }
  if (query.parentId) {
    params.set("parentId", query.parentId);
  }

  const url = new URL("/api/locations", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicLocationSummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchLocationById(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicLocationDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(`/api/locations/${encodeURIComponent(id)}`, baseUrl);

  const res = await fetcher(url, { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  if (!data?.item) {
    return null;
  }

  return toPublicLocationDetail(data.item as Record<string, unknown>);
}
