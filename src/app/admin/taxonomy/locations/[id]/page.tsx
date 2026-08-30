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
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="text-neutral-600">
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
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/admin/taxonomy/locations" className="text-sm text-neutral-600 underline">
          &larr; Back to locations
        </Link>

        <h1 className="mt-2 text-2xl font-semibold">{location.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Slug: <strong className="font-mono">{location.slug}</strong> · Type:{" "}
          <strong>{location.type}</strong> · Status:{" "}
          <strong className={location.isActive ? "text-green-700" : "text-red-700"}>
            {location.isActive ? "Active" : "Inactive"}
          </strong>
        </p>

        <div className="mt-4">
          <LocationDetail location={location} />
        </div>

        <section className="mt-6 space-y-2 text-sm">
          <h2 className="text-lg font-semibold">Details</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Parent</dt>
              <dd>{location.parentName ?? "None (root)"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Children</dt>
              <dd>{location.childCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Jobs</dt>
              <dd>{location.jobCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Latitude</dt>
              <dd>{location.latitude ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Longitude</dt>
              <dd>{location.longitude ?? "Not set"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Created</dt>
              <dd>{new Date(location.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Updated</dt>
              <dd>{new Date(location.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        {location.children.length > 0 && (
          <section className="mt-6 text-sm">
            <h2 className="text-lg font-semibold">Children</h2>
            <ul className="mt-2 space-y-1">
              {location.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/admin/taxonomy/locations/${child.id}`}
                    className="text-neutral-700 underline hover:text-neutral-900"
                  >
                    {child.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-neutral-500">{child.slug}</span>
                  <span className="ml-2 text-xs text-neutral-500">({child.type})</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
