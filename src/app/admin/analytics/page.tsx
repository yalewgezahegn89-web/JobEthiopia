import { redirect } from "next/navigation";
import { requireStaffAdmin } from "@/lib/auth/context";
import { getAnalyticsSummary } from "@/lib/admin/analytics";
import { getI18n } from "@/lib/i18n/server";
import AdminNav from "../nav";
import AnalyticsDashboard from "./analytics-dashboard";

export const metadata = {
  title: "Analytics | JobEthiopia Admin",
};

export default async function AdminAnalyticsPage() {
  const guard = await requireStaffAdmin();
  if (!guard.ok) {
    redirect(guard.status === 401 ? "/login" : "/admin");
  }

  const t = await getI18n();

  let summary;
  let loadError = false;
  try {
    summary = await getAnalyticsSummary();
  } catch {
    loadError = true;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.adminAnalytics.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.adminAnalytics.subtitle}</p>
        {loadError ? (
          <p className="mt-4 text-sm text-destructive">
            {t.adminAnalytics.loadError}
          </p>
        ) : (
          <AnalyticsDashboard summary={summary!} t={t} />
        )}
      </main>
    </div>
  );
}