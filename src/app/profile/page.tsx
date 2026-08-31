import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema/locations";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";
import { getCandidateProfile } from "@/lib/candidateProfile/dal";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Profile | JobEthiopia",
  description: "Your candidate profile on JobEthiopia.",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CANDIDATE" || isStaffRole(user.role)) {
    redirect("/jobs");
  }

  let profile;
  let loadError = false;
  try {
    profile = await getCandidateProfile(user.id);
  } catch {
    loadError = true;
  }

  let locationOptions: { id: string; name: string }[] = [];
  let locationLoadError = false;
  try {
    const rows = await db.query.locations.findMany({
      where: eq(locations.isActive, true),
      columns: { id: true, name: true },
      orderBy: (loc, { asc }) => [asc(loc.name)],
    });
    locationOptions = rows.map((r) => ({ id: r.id, name: r.name }));

    if (profile?.locationId) {
      const selected = locationOptions.some((l) => l.id === profile.locationId);
      if (!selected) {
        const current = await db.query.locations.findFirst({
          where: eq(locations.id, profile.locationId),
          columns: { id: true, name: true },
        });
        if (current) locationOptions.push({ id: current.id, name: current.name });
      }
    }
  } catch {
    locationLoadError = true;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Keep your details up to date so employers can learn more about you.
        Only employers reviewing an application you submit can see this
        information.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/applications"
          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          My Applications
        </Link>
        <Link
          href="/jobs"
          className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          Browse Jobs
        </Link>
        <form action="/logout" method="POST">
          <button
            type="submit"
            className="font-semibold text-gray-600 hover:underline dark:text-gray-300"
          >
            Sign out
          </button>
        </form>
      </div>

      {loadError || locationLoadError ? (
        <div className="mt-6 rounded-lg border border-gray-200 p-8 text-center dark:border-gray-800">
          <p className="text-gray-600 dark:text-gray-300">
            We could not load your profile right now. Please try again shortly.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <ProfileForm
            name={user.name}
            email={user.email}
            phone={profile?.phone ?? null}
            locationId={profile?.locationId ?? null}
            professionalSummary={profile?.professionalSummary ?? null}
            totalExperienceYears={profile?.totalExperienceYears ?? null}
            education={profile?.education ?? null}
            locations={locationOptions}
          />
        </div>
      )}
    </div>
  );
}
