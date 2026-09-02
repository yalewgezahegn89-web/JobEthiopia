import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import {
  listEmployerTeam,
  getEmployerTeamOrganizations,
} from "@/lib/employer/team";
import { AddMemberForm } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";
import { Breadcrumb } from "@/components/public/breadcrumb";
import { EmptyState } from "@/components/public/empty-state";
import { UserIcon, PlusIcon, BuildingIcon } from "@/components/public/icons";

export const dynamic = "force-dynamic";

export default async function OrganizationTeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const [members, organizations] = await Promise.all([
    listEmployerTeam(user.id),
    getEmployerTeamOrganizations(user.id),
  ]);

  const byOrg = new Map<string, { name: string; members: typeof members }>();
  for (const member of members) {
    const group = byOrg.get(member.organizationId);
    if (group) {
      group.members.push(member);
    } else {
      byOrg.set(member.organizationId, {
        name: member.organizationName,
        members: [member],
      });
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Home", href: "/organization" }, { label: "Team" }]}
      />

      <div className="mt-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Employer workspace
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage organization administrators for your organizations.
        </p>
      </div>

      {organizations.length > 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
              <PlusIcon className="h-4 w-4" />
            </span>
            Add organization admin
          </h2>
          <p className="mt-1 text-xs text-muted">
            Invite an existing registered user to an organization you manage.
          </p>
          <div className="mt-4">
            <AddMemberForm organizations={organizations} />
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          No active organizations to manage.
        </p>
      )}

      {byOrg.size === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-7 w-7" />}
          heading="No team members yet"
          body="Add members above to start collaborating across your organizations."
        />
      ) : (
        <div className="mt-8 space-y-8">
          {Array.from(byOrg.entries()).map(([orgId, group]) => (
            <section
              key={orgId}
              className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
            >
              <header className="flex items-center gap-2 border-b border-border bg-surface-raised px-5 py-3.5">
                <BuildingIcon className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">{group.name}</h2>
                <span className="ml-auto rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                  {group.members.length}
                </span>
              </header>
              <ul className="divide-y divide-border-subtle">
                {group.members.map((member) => (
                  <li
                    key={member.membershipId}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light font-semibold text-primary">
                        {(member.name || member.email || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {member.name}
                          </span>
                          {!member.isActive && (
                            <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-warning">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {member.email}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                          Joined{" "}
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <RemoveMemberButton
                        membershipId={member.membershipId}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
