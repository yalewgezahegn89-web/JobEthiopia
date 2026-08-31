import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { employerOnboardingRequests } from "@/db/schema/employerOnboardingRequests";
import { getCurrentUser } from "@/lib/auth/context";

export const metadata: Metadata = {
  title: "Employer request status",
};

export default async function EmployerStatusPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let request;
  let loadError = false;
  try {
    request = await db.query.employerOnboardingRequests.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: [desc(employerOnboardingRequests.createdAt)],
    });
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Request status</h1>
        <p className="max-w-md text-center text-neutral-600">
          We could not load your request status right now. Please try again
          shortly.
        </p>
        <Link href="/" className="text-sm text-neutral-600 underline">
          Back to JobEthiopia
        </Link>
      </section>
    );
  }

  if (!request) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">No employer request yet</h1>
        <p className="max-w-md text-center text-neutral-600">
          It looks like you have not submitted an employer onboarding request.
        </p>
        <Link
          href="/employer/register"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Request an employer account
        </Link>
      </section>
    );
  }

  if (request.status === "APPROVED") {
    redirect("/organization");
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Employer request status</h1>
      {request.status === "PENDING" ? (
        <>
          <p className="max-w-md text-center text-neutral-600">
            Your request for{" "}
            <strong>{request.organizationName}</strong> is under review. Our
            team will activate your employer account once it is approved.
          </p>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
            Pending review
          </span>
        </>
      ) : (
        <>
          <p className="max-w-md text-center text-neutral-600">
            Your request to set up an employer account was not approved.
          </p>
          <Link
            href="/employer/register"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Submit a new request
          </Link>
        </>
      )}
    </section>
  );
}
