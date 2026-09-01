import { getAppBaseUrl } from "@/lib/appBaseUrl";

export type PublicProfessionQuery = {
  page?: number;
  limit?: number;
  categoryId?: string;
  isActive?: boolean;
};

export type PublicProfessionPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicProfessionSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean;
};

export type PublicProfessionDetail = PublicProfessionSummary & {
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicProfessionList = {
  items: PublicProfessionSummary[];
  pagination: PublicProfessionPagination;
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

export function toPublicProfessionSummary(
  raw: Record<string, unknown>,
): PublicProfessionSummary {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    slug: String(raw.slug ?? ""),
    description:
      typeof raw.description === "string"
        ? raw.description
        : raw.description != null
          ? String(raw.description)
          : null,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : null,
    isActive: raw.isActive === true,
  };
}

export function toPublicProfessionDetail(
  raw: Record<string, unknown>,
): PublicProfessionDetail {
  return {
    ...toPublicProfessionSummary(raw),
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicProfessionPagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchProfessions(
  query: PublicProfessionQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicProfessionList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("isActive", String(query.isActive ?? true));
  if (query.categoryId) {
    params.set("categoryId", query.categoryId);
  }

  const url = new URL("/api/professions", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicProfessionSummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchProfessionById(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicProfessionDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(`/api/professions/${encodeURIComponent(id)}`, baseUrl);

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

  return toPublicProfessionDetail(data.item as Record<string, unknown>);
}
