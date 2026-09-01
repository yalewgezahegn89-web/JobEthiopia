import { getAppBaseUrl } from "@/lib/appBaseUrl";

export type PublicArticleQuery = {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
};

export type PublicArticlePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicArticleSummary = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  publishedAt: string | null;
};

export type PublicArticleDetail = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  content: string | null;
  status: string | null;
  publishedAt: string | null;
};

export type PublicArticleList = {
  items: PublicArticleSummary[];
  pagination: PublicArticlePagination;
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

export function formatDate(
  value?: string | number | Date | null,
): string | null {
  if (value == null) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function toPublicArticleSummary(
  raw: Record<string, unknown>,
): PublicArticleSummary {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    category: typeof raw.category === "string" ? raw.category : null,
    excerpt: raw.excerpt != null ? String(raw.excerpt) : null,
    publishedAt: formatDate(raw.publishedAt as string | null | undefined),
  };
}

export function toPublicArticleDetail(
  raw: Record<string, unknown>,
): PublicArticleDetail {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    category: typeof raw.category === "string" ? raw.category : null,
    excerpt: raw.excerpt != null ? String(raw.excerpt) : null,
    content: raw.content != null ? String(raw.content) : null,
    status: typeof raw.status === "string" ? raw.status : null,
    publishedAt: formatDate(raw.publishedAt as string | null | undefined),
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicArticlePagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchCareerArticles(
  query: PublicArticleQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicArticleList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("status", query.status ?? "PUBLISHED");
  if (query.category) {
    params.set("category", query.category);
  }

  const url = new URL("/api/career-articles", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicArticleSummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchCareerArticle(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicArticleDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(`/api/career-articles/${encodeURIComponent(id)}`, baseUrl);

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

  return toPublicArticleDetail(data.item as Record<string, unknown>);
}