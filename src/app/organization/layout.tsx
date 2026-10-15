import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { getUnreadCount } from "@/lib/notifications/dal";
import { getI18n } from "@/lib/i18n/server";
import { OrganizationNav } from "./nav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ORGANIZATION_ADMIN") {
    redirect("/login");
  }

  const unreadCount = await getUnreadCount(user.id);
  const t = await getI18n();

  return (
    <div className="min-h-screen bg-surface-raised">
      <OrganizationNav
        unreadNotificationCount={unreadCount}
        t={t.employerNav}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
