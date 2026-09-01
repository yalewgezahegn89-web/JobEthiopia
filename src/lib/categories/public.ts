import { getAppBaseUrl } from "@/lib/appBaseUrl";

export type PublicCategoryQuery = {
  page?: number;
  limit?: number;
  parentId?: string;
  isActive?: boolean;
};

export type PublicCategoryPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicCategorySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number | null;
};

export type PublicCategoryDetail = PublicCategorySummary & {
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicCategoryList = {
  items: PublicCategorySummary[];
  pagination: PublicCategoryPagination;
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

export function toPublicCategorySummary(
  raw: Record<string, unknown>,
): PublicCategorySummary {
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
    parentId: typeof raw.parentId === "string" ? raw.parentId : null,
    isActive: raw.isActive === true,
    sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : null,
  };
}

export function toPublicCategoryDetail(
  raw: Record<string, unknown>,
): PublicCategoryDetail {
  return {
    ...toPublicCategorySummary(raw),
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicCategoryPagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchCategories(
  query: PublicCategoryQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicCategoryList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("isActive", String(query.isActive ?? true));
  if (query.parentId) {
    params.set("parentId", query.parentId);
  }

  const url = new URL("/api/categories", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicCategorySummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchCategoryById(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicCategoryDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(`/api/categories/${encodeURIComponent(id)}`, baseUrl);

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

  return toPublicCategoryDetail(data.item as Record<string, unknown>);
}
