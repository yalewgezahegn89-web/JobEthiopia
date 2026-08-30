import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/context";
import { OrganizationNav } from "./nav";

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <OrganizationNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
