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
    <div className="min-h-screen bg-surface-raised">
      <OrganizationNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
