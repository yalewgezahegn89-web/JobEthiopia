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
import { UserIcon, ArrowRightIcon } from "@/components/public/icons";
import ChangePasswordForm from "./change-password/change-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Profile | JobEthiopia",
  description: "Your candidate profile on JobEthiopia.",
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

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
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Candidate workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          My Profile
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
          Keep your details up to date so employers can learn more about you.
          Only employers reviewing an application you submit can see this
          information.
        </p>
      </header>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">
            {user.name}
          </p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted">
            <UserIcon className="h-4 w-4 text-subtle" />
            {user.email ?? "No email on file"}
          </p>
        </div>
      </div>

      <nav
        aria-label="Candidate shortcuts"
        className="mt-4 flex flex-wrap items-center gap-2 text-sm"
      >
        <Link
          href="/applications"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-semibold text-primary hover:bg-primary-light/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          My Applications
        </Link>
        <Link
          href="/jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Browse Jobs
        </Link>
        <Link
          href="/saved-jobs"
          className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 font-semibold text-muted hover:bg-surface-raised/70 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Saved Jobs
        </Link>
        <form action="/logout" method="POST">
          <button
            type="submit"
            className="focus-visible:outline-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-semibold text-muted hover:bg-surface-raised focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign out
          </button>
        </form>
      </nav>

      <section
        aria-labelledby="profile-heading"
        className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="h-1.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6">
          <h2 id="profile-heading" className="text-xl font-bold tracking-tight text-foreground">
            Profile
          </h2>
          <p className="mt-1 text-sm text-muted">
            Basic and professional details shown to employers you apply to.
          </p>

          {loadError || locationLoadError ? (
            <div
              role="status"
              className="mt-6 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center"
            >
              <p className="text-muted">
                We could not load your profile right now. Please try again
                shortly.
              </p>
              <Link
                href="/profile"
                className="focus-visible:outline-2 mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Retry
              </Link>
            </div>
          ) : (
            <div className="mt-6">
              <ProfileForm
                name={user.name}
                email={user.email ?? ""}
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
      </section>

      <section
        aria-labelledby="security-heading"
        className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="h-1.5 w-full bg-accent" aria-hidden="true" />
        <div className="p-6">
          <h2 id="security-heading" className="text-xl font-bold tracking-tight text-foreground">
            Security
          </h2>
          <h3 className="mt-3 text-base font-semibold tracking-tight text-foreground">
            Change password
          </h3>
          <p className="mt-1 text-sm text-muted">
            Update your password to keep your account secure.
          </p>
          <div className="mt-4">
            <ChangePasswordForm />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="account-heading"
        className="mt-6 rounded-xl border border-border-subtle bg-surface px-6 py-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="account-heading" className="text-base font-semibold tracking-tight text-foreground">
              Leaving so soon?
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Sign out to end this session securely.
            </p>
          </div>
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="focus-visible:outline-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Sign out
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}