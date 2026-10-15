import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import AdminNav from "../nav";

export const metadata = {
  title: "Taxonomy | JobEthiopia Admin",
};

export default async function AdminTaxonomyPage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">Taxonomy Management</h1>
        <p className="mt-2 text-muted">
          Manage categories, professions, and locations used across the platform.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/admin/taxonomy/categories"
            className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
            </span>
            <span className="mt-3 block font-semibold text-foreground">Categories</span>
            <p className="mt-1 text-sm text-muted">
              Job categories and their hierarchy.
            </p>
          </Link>
          <Link
            href="/admin/taxonomy/professions"
            className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="20" height="14" x="2" y="6" rx="2" />
                <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </span>
            <span className="mt-3 block font-semibold text-foreground">Professions</span>
            <p className="mt-1 text-sm text-muted">
              Professional titles and their category assignments.
            </p>
          </Link>
          <Link
            href="/admin/taxonomy/locations"
            className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="mt-3 block font-semibold text-foreground">Locations</span>
            <p className="mt-1 text-sm text-muted">
              Geographic locations and their hierarchy.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}