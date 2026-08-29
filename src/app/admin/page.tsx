import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const user = await getCurrentUser();

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">JobEthiopia Admin</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as {user?.name ?? "Administrator"} (
        {user?.role ?? "STAFF"}).
      </p>
      <p className="mt-6 text-neutral-600">
        Job moderation, organization verification, and source management are
        available above.
      </p>
      <Link href="/logout" className="mt-8 inline-block text-sm underline">
        Sign out
      </Link>
    </section>
  );
}