export type PublicJobQuery = {
  q?: string;
  categoryId?: string;
  professionId?: string;
  locationId?: string;
  organizationId?: string;
  status?: string;
  employmentType?: string;
  page?: number;
  limit?: number;
};

export type PublicJobPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PublicJobSummary = {
  id: string;
  title: string;
  slug: string;
  organizationId: string | null;
  categoryId: string | null;
  professionId: string | null;
  locationId: string | null;
  organizationName: string | null;
  locationName: string | null;
  categoryName: string | null;
  professionName: string | null;
  employmentType: string | null;
  salaryText: string | null;
  deadlineText: string | null;
  postedAt: string | null;
};

export type PublicJobDetail = {
  id: string;
  title: string;
  slug: string;
  organizationName: string | null;
  locationName: string | null;
  categoryName: string | null;
  professionName: string | null;
  employmentType: string | null;
  description: string | null;
  responsibilities: string | null;
  requirements: string | null;
  educationRequirements: string | null;
  benefits: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryText: string | null;
  deadlineText: string | null;
  deadline: string | null;
  postedAt: string | null;
  applicationUrl: string | null;
  verificationStatus: string | null;
};

export type PublicJobList = {
  items: PublicJobSummary[];
  pagination: PublicJobPagination;
};

export class PublicApiError extends Error {
  constructor(message = "Unable to load data") {
    super(message);
    this.name = "PublicApiError";
  }
}

type EntityRef = { id?: string; name?: string } | null | undefined;

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

export function formatSalary(
  salaryMin?: string | number | null,
  salaryMax?: string | number | null,
  salaryCurrency?: string | null,
  salaryPeriod?: string | null,
): string | null {
  if (salaryMin == null && salaryMax == null) {
    return null;
  }

  const pretty = (value: string | number): string =>
    Number(value).toLocaleString("en-US");

  const amount =
    salaryMin != null && salaryMax != null
      ? `${pretty(salaryMin)} - ${pretty(salaryMax)}`
      : salaryMin != null
        ? pretty(salaryMin)
        : pretty(salaryMax as string | number);

  const unit = [salaryCurrency, salaryPeriod?.toLowerCase()]
    .filter((part): part is string => Boolean(part))
    .join(" / ");

  return unit ? `${amount} ${unit}` : amount;
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

function entityName(entity: EntityRef): string | null {
  return entity?.name ?? null;
}

function entityId(entity: EntityRef): string | null {
  return typeof entity?.id === "string" ? entity.id : null;
}

export function toPublicJobSummary(raw: Record<string, unknown>): PublicJobSummary {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    organizationId:
      entityId(raw.organization as EntityRef) ??
      (typeof raw.organizationId === "string" ? raw.organizationId : null),
    categoryId:
      entityId(raw.category as EntityRef) ??
      (typeof raw.categoryId === "string" ? raw.categoryId : null),
    professionId:
      entityId(raw.profession as EntityRef) ??
      (typeof raw.professionId === "string" ? raw.professionId : null),
    locationId:
      entityId(raw.location as EntityRef) ??
      (typeof raw.locationId === "string" ? raw.locationId : null),
    organizationName: entityName(raw.organization as EntityRef),
    locationName: entityName(raw.location as EntityRef),
    categoryName: entityName(raw.category as EntityRef),
    professionName: entityName(raw.profession as EntityRef),
    employmentType:
      typeof raw.employmentType === "string" ? raw.employmentType : null,
    salaryText: formatSalary(
      raw.salaryMin as string | number | null | undefined,
      raw.salaryMax as string | number | null | undefined,
      raw.salaryCurrency as string | null | undefined,
      raw.salaryPeriod as string | null | undefined,
    ),
    deadlineText: formatDate(raw.deadline as string | null | undefined),
    postedAt: formatDate(raw.postedAt as string | null | undefined),
  };
}

export function toPublicJobDetail(raw: Record<string, unknown>): PublicJobDetail {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    slug: String(raw.slug ?? ""),
    organizationName: entityName(raw.organization as EntityRef),
    locationName: entityName(raw.location as EntityRef),
    categoryName: entityName(raw.category as EntityRef),
    professionName: entityName(raw.profession as EntityRef),
    employmentType:
      typeof raw.employmentType === "string" ? raw.employmentType : null,
    description:
      typeof raw.description === "string"
        ? raw.description
        : raw.description != null
          ? String(raw.description)
          : null,
    responsibilities:
      raw.responsibilities != null ? String(raw.responsibilities) : null,
    requirements: raw.requirements != null ? String(raw.requirements) : null,
    educationRequirements:
      raw.educationRequirements != null
        ? String(raw.educationRequirements)
        : null,
    benefits: raw.benefits != null ? String(raw.benefits) : null,
    experienceMin:
      typeof raw.experienceMin === "number" ? raw.experienceMin : null,
    experienceMax:
      typeof raw.experienceMax === "number" ? raw.experienceMax : null,
    salaryText: formatSalary(
      raw.salaryMin as string | number | null | undefined,
      raw.salaryMax as string | number | null | undefined,
      raw.salaryCurrency as string | null | undefined,
      raw.salaryPeriod as string | null | undefined,
    ),
    deadlineText: formatDate(raw.deadline as string | null | undefined),
    deadline:
      raw.deadline != null ? String(raw.deadline) : null,
    postedAt:
      raw.postedAt != null ? String(raw.postedAt) : null,
    applicationUrl:
      typeof raw.applicationUrl === "string" ? raw.applicationUrl : null,
    verificationStatus:
      typeof raw.verificationStatus === "string"
        ? raw.verificationStatus
        : null,
  };
}

function parsePagination(
  pagination: Record<string, unknown> | null | undefined,
): PublicJobPagination {
  return {
    page: typeof pagination?.page === "number" ? pagination.page : 1,
    limit: typeof pagination?.limit === "number" ? pagination.limit : 20,
    total: typeof pagination?.total === "number" ? pagination.total : 0,
    totalPages:
      typeof pagination?.totalPages === "number" ? pagination.totalPages : 0,
  };
}

export async function fetchJobs(
  query: PublicJobQuery = {},
  options: FetchLayerOptions = {},
): Promise<PublicJobList> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  params.set("status", query.status ?? "PUBLISHED");
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.categoryId) {
    params.set("categoryId", query.categoryId);
  }
  if (query.professionId) {
    params.set("professionId", query.professionId);
  }
  if (query.locationId) {
    params.set("locationId", query.locationId);
  }
  if (query.organizationId) {
    params.set("organizationId", query.organizationId);
  }
  if (query.employmentType) {
    params.set("employmentType", query.employmentType);
  }

  const url = new URL("/api/jobs", baseUrl);
  url.search = params.toString();

  const res = await fetcher(url, { cache: "no-store" });
  if (!res.ok) {
    throw new PublicApiError();
  }

  const data = (await safeParse(res)) as Record<string, unknown> | null;
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    items: items.map((item) =>
      toPublicJobSummary(item as Record<string, unknown>),
    ),
    pagination: parsePagination(
      data?.pagination as Record<string, unknown> | null | undefined,
    ),
  };
}

export async function fetchJobById(
  id: string,
  options: FetchLayerOptions = {},
): Promise<PublicJobDetail | null> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const fetcher = getFetcher(options.fetcher);

  const url = new URL(`/api/jobs/${encodeURIComponent(id)}`, baseUrl);

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

  return toPublicJobDetail(data.item as Record<string, unknown>);
}