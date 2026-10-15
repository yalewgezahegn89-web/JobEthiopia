import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getLocation } from "@/lib/admin/taxonomy";
import AdminNav from "../../../nav";
import LocationDetail from "./location-detail";

export const metadata = {
  title: "Location Detail | JobEthiopia Admin",
};

export default async function AdminLocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const { id } = await params;

  let location;
  let loadError = false;
  try {
    location = await getLocation(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div>
        <AdminNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <p className="text-sm text-destructive">
            We could not load this location right now. Please try again shortly.
          </p>
        </main>
      </div>
    );
  }

  if (!location) {
    notFound();
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Link href="/admin/taxonomy/locations" className="text-sm font-medium text-muted hover:text-primary">
          &larr; Back to locations
        </Link>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{location.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            Slug: <strong className="font-mono text-foreground">{location.slug}</strong>
          </span>
          <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted">
            {location.type}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              location.isActive ? "bg-success-light text-success" : "bg-destructive-light text-destructive"
            }`}
          >
            {location.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="mt-4">
          <LocationDetail location={location} />
        </div>

        <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Parent</dt>
              <dd className="text-sm font-medium text-foreground">{location.parentName ?? "None (root)"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Children</dt>
              <dd className="text-sm font-medium text-foreground">{location.childCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Jobs</dt>
              <dd className="text-sm font-medium text-foreground">{location.jobCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Latitude</dt>
              <dd className="text-sm font-medium text-foreground">{location.latitude ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Longitude</dt>
              <dd className="text-sm font-medium text-foreground">{location.longitude ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Created</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(location.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Updated</dt>
              <dd className="text-sm font-medium text-foreground">{new Date(location.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        {location.children.length > 0 && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Children</h2>
            <ul className="mt-4 space-y-2">
              {location.children.map((child) => (
                <li key={child.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <Link
                    href={`/admin/taxonomy/locations/${child.id}`}
                    className="font-semibold text-foreground hover:text-primary"
                  >
                    {child.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-subtle">{child.slug}</span>
                  <span className="ml-2 text-xs text-muted">({child.type})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
