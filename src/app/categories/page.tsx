import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchCategories,
  type PublicCategoryList,
} from "@/lib/categories/public";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { PageHeader } from "@/components/public/page-header";
import { EmptyState } from "@/components/public/empty-state";
import { Pagination } from "@/components/public/pagination";
import { TagIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories | JobEthiopia",
  description: "Browse job categories across Ethiopia.",
};

type SearchParamsValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamsValue>;

function firstValue(value: SearchParamsValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = toPositiveInteger(firstValue(params.page), 1);

  let result: PublicCategoryList | null = null;
  let loadError = false;

  try {
    result = await fetchCategories({ page, limit: 20 });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="mt-4 text-muted">
          We could not load categories right now. Please try again shortly.
        </p>
        <Link
          href="/categories"
          className="focus-visible:outline-2 mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Retry
        </Link>
      </div>
    );
  }

  const items = result?.items ?? [];
  const pagination = result?.pagination ?? {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;

  function hrefWithPage(targetPage: number): string {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Categories" }]} />

      <div className="mt-4">
        <PageHeader
          eyebrow="Browse by field"
          title="Categories"
          description="Explore job categories to find roles that match your field and interests."
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-7 w-7" />}
          heading="No categories found"
          body="There are no active categories to show right now. Check back soon."
        />
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((category, index) => (
              <li key={category.id} className="h-full">
                <CategoryCard category={category} index={index} />
              </li>
            ))}
          </ul>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hrefForPage={hrefWithPage}
          />
        </>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  index,
}: {
  category: { id: string; name: string; description: string | null; parentId: string | null };
  index: number;
}) {
  const amber = index % 2 === 1;
  return (
    <Link
      href={`/categories/${category.id}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-lg ${
          amber ? "bg-accent-light text-warning" : "bg-primary-light text-primary"
        }`}
      >
        <TagIcon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
        {category.name}
      </h2>
      {category.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted">
          {category.description}
        </p>
      )}
      <span className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {category.parentId && (
          <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted">
            Subcategory
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Explore jobs
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}