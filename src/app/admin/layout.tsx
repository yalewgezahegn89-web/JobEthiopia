import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/context";
import { isStaffRole } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isStaffRole(user.role)) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Forbidden</h1>
        <p className="text-muted">
          Your account does not have access to the admin workspace.
        </p>
        <Link href="/" className="text-sm text-muted underline">
          Back to JobEthiopia
        </Link>
      </section>
    );
  }

  return <div className="min-h-screen bg-surface-raised">{children}</div>;
}