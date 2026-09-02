import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";
import AdminNav from "./nav";
import {
  BriefcaseIcon,
  BuildingIcon,
  UserIcon,
  GlobeIcon,
  TagIcon,
  FileIcon,
  SaveIcon,
  ArrowRightIcon,
} from "@/components/public/icons";

export const metadata: Metadata = {
  title: "Admin",
};

const areas = [
  {
    href: "/admin/jobs",
    title: "Job Moderation",
    description: "Review and moderate incoming job listings.",
    icon: BriefcaseIcon,
  },
  {
    href: "/admin/organizations",
    title: "Organizations",
    description: "Verify and manage employer organizations.",
    icon: BuildingIcon,
  },
  {
    href: "/admin/employer-requests",
    title: "Employer Requests",
    description: "Review employer onboarding requests.",
    icon: UserIcon,
  },
  {
    href: "/admin/sources",
    title: "Sources",
    description: "Manage ingestion sources and reliability.",
    icon: GlobeIcon,
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Manage accounts, roles, and sessions.",
    icon: UserIcon,
  },
  {
    href: "/admin/taxonomy",
    title: "Taxonomy",
    description: "Manage categories, professions, and locations.",
    icon: TagIcon,
  },
  {
    href: "/admin/audit",
    title: "Audit Log",
    description: "Review the security and moderation trail.",
    icon: FileIcon,
  },
  {
    href: "/admin/operations",
    title: "Operations",
    description: "Monitor maintenance and ingestion health.",
    icon: SaveIcon,
  },
];

export default async function AdminPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Recruitment operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Admin
          </h1>
          <p className="mt-2 text-base leading-7 text-muted">
            Signed in as {user?.name ?? "Administrator"} (
            {user?.role ?? "STAFF"}). Pick an operational area to begin.
          </p>
        </header>

        <section className="mt-8" aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="text-lg font-semibold text-foreground">
            Workspaces
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your moderation, verification, and management areas.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((area) => {
              const Icon = area.icon;
              return (
                <Link
                  key={area.href}
                  href={area.href}
                  className="group rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {area.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {area.description}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                        Open
                        <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
