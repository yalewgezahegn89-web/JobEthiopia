import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/context";
import { getUserOrganizationIds } from "@/lib/auth/organizationMembership";
import { getOrganizationForSettings } from "@/lib/employer/organization";
import { OrganizationSettingsForm } from "./organization-settings-form";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Organization Settings | JobEthiopia",
  description: "Manage your organization profile.",
  robots: { index: false, follow: false },
};

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") redirect("/login");

  const t = await getI18n();
  const orgIds = await getUserOrganizationIds(user.id);
  if (orgIds.length === 0) {
    redirect("/organization");
  }

  const organization = await getOrganizationForSettings(orgIds[0]);
  if (!organization) {
    redirect("/organization");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            {t.nav.organization}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
            Manage your organization profile and information.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <OrganizationSettingsForm
          organization={organization}
          t={{
            nameLabel: "Organization name",
            descriptionLabel: "Description",
            industryLabel: "Industry",
            websiteLabel: "Website URL",
            save: "Save changes",
            saving: "Saving...",
            success: "Profile updated successfully.",
            error: "Failed to update profile. Please try again.",
          }}
        />
      </div>
    </div>
  );
}
