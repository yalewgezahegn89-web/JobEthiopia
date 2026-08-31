import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { OrganizationNav } from "../nav";
import {
  listEmployerTeam,
  getEmployerTeamOrganizations,
} from "@/lib/employer/team";
import { AddMemberForm } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";

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
    <>
      <OrganizationNav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Team
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage organization administrators for your organizations.
        </p>

        {organizations.length > 0 ? (
          <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Add existing organization admin
            </h2>
            <div className="mt-3">
              <AddMemberForm organizations={organizations} />
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            No active organizations to manage.
          </p>
        )}

        {byOrg.size === 0 ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            No team members yet.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {Array.from(byOrg.entries()).map(([orgId, group]) => (
              <section key={orgId} className="rounded-lg border border-gray-200 dark:border-gray-800">
                <header className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                  <h2 className="font-medium text-gray-900 dark:text-gray-100">
                    {group.name}
                  </h2>
                </header>
                <ul className="divide-y divide-gray-200 dark:divide-gray-800">
                  {group.members.map((member) => (
                    <li
                      key={member.membershipId}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {member.name}
                          </span>
                          {!member.isActive && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                          {member.email}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <RemoveMemberButton membershipId={member.membershipId} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
