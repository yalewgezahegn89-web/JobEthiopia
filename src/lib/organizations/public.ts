export type PublicOrganizationQuery = {
  page?: number;
  limit?: number;
  status?: string;
  locationId?: string;
  isVerified?: boolean;
};

export type PublicOrganizationPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicOrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  isVerified: boolean;
  status: string | null;
};

export type PublicOrganizationDetail = PublicOrganizationSummary & {
  description: string | null;
  locationId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicOrganizationList = {
  items: PublicOrganizationSummary[];
  pagination: PublicOrganizationPagination;
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
  return baseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
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

export function toPublicOrganizationSummary(
  raw: Record<string, unknown>,
): PublicOrganizationSummary {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    industry: typeof raw.industry === "string" ? raw.industry : null,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : null,
    websiteUrl: typeof raw.websiteUrl === "string" ? raw.websiteUrl : null,
    isVerified: raw.isVerified === true,
    status: typeof raw.status === "string" ? raw.status : null,
  };
}

export function toPublicOrganizationDetail(
  raw: Record<string, unknown>,
): PublicOrganizationDetail {
  return {
    ...toPublicOrganizationSummary(raw),
    description:
      typeof raw.description === "string"
        ? raw.description
        : raw.description != null
          ? String(raw.description)
          : null,
    locationId: typeof raw.locationId === "string" ? raw.locationId : null,
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicOrganizationPagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchOrganizations(
  query: PublicOrganizationQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicOrganizationList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("status", query.status ?? "ACTIVE");
  if (query.locationId) {
    params.set("locationId", query.locationId);
  }
  if (query.isVerified !== undefined) {
    params.set("isVerified", String(query.isVerified));
  }

  const url = new URL("/api/organizations", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicOrganizationSummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchOrganizationById(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicOrganizationDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(
    `/api/organizations/${encodeURIComponent(id)}`,
    baseUrl,
  );

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

  return toPublicOrganizationDetail(data.item as Record<string, unknown>);
}
