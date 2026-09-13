"use client";

import type { AnalyticsSummary, DailyCount } from "@/lib/admin/analytics";
import type { Messages } from "@/lib/i18n/dictionary";
import { LOCALE_METADATA, type Locale } from "@/lib/i18n/locale";

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function MiniBarChart({ series }: { series: DailyCount[] }) {
  const max = Math.max(1, ...series.map((point) => point.count));
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[560px] items-end gap-1">
        {series.map((point) => {
          const height = Math.max(4, Math.round((point.count / max) * 72));
          return (
            <div
              key={point.day}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${formatDay(point.day)}: ${point.count}`}
            >
              <span className="text-xs font-medium tabular-nums text-muted">
                {point.count}
              </span>
              <div
                className="w-full rounded-sm bg-primary-light"
                style={{ height }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeriesCard({
  title,
  total,
  series,
}: {
  title: string;
  total: number;
  series: DailyCount[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-muted">{title}</p>
        <p className="text-lg font-bold tabular-nums text-foreground">{total}</p>
      </div>
      <div className="mt-3">
        <MiniBarChart series={series} />
      </div>
    </div>
  );
}

function localeName(locale: string): string {
  return LOCALE_METADATA[(locale as Locale) in LOCALE_METADATA ? (locale as Locale) : "en"].name;
}

export default function AnalyticsDashboard({
  summary,
  t,
}: {
  summary: AnalyticsSummary;
  t: Messages;
}) {
  const { discovery, engagement, moderation, platform, window, monetization } =
    summary;

  const hasDiscovery =
    discovery.totals.job_viewed > 0 ||
    discovery.totals.job_search > 0 ||
    discovery.totals.job_list_viewed > 0;

  return (
    <div className="mt-6 space-y-8">
      <section aria-labelledby="analytics-discovery-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="analytics-discovery-heading"
            className="text-lg font-semibold text-foreground"
          >
            {t.adminAnalytics.discoveryTitle}
          </h2>
          <span className="text-sm text-muted">
            {t.adminAnalytics.lastDays(window.totalDays)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SeriesCard
            title={t.adminAnalytics.listViews}
            total={discovery.totals.job_list_viewed}
            series={discovery.daily.job_list_viewed}
          />
          <SeriesCard
            title={t.adminAnalytics.jobSearches}
            total={discovery.totals.job_search}
            series={discovery.daily.job_search}
          />
          <SeriesCard
            title={t.adminAnalytics.jobViews}
            total={discovery.totals.job_viewed}
            series={discovery.daily.job_viewed}
          />
        </div>

        {!hasDiscovery ? (
          <p className="mt-3 text-sm text-muted">
            {t.adminAnalytics.noDiscovery}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted">{t.adminAnalytics.byLanguage}</p>
              <ul className="mt-2 space-y-2">
                {discovery.byLocale.map((row) => (
                  <li
                    key={row.locale}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {localeName(row.locale)}
                    </span>
                    <span className="tabular-nums text-muted">{row.count}</span>
                  </li>
                ))}
                {discovery.byLocale.length === 0 && (
                  <li className="text-sm text-muted">-</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted">
                {t.adminAnalytics.topViewedJobs}
              </p>
              <ul className="mt-2 space-y-2">
                {discovery.topViewedJobs.map((job, index) => (
                  <li
                    key={job.jobId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">
                      <span className="mr-2 text-muted">{index + 1}.</span>
                      {job.title ?? job.jobId}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {job.views} {t.adminAnalytics.views}
                    </span>
                  </li>
                ))}
                {discovery.topViewedJobs.length === 0 && (
                  <li className="text-sm text-muted">-</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="analytics-engagement-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="analytics-engagement-heading"
            className="text-lg font-semibold text-foreground"
          >
            {t.adminAnalytics.engagementTitle}
          </h2>
          <span className="text-sm text-muted">
            {t.adminAnalytics.lastDays(window.dailyDays)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SeriesCard
            title={t.adminAnalytics.applications}
            total={engagement.applications.total}
            series={engagement.applications.daily}
          />
          <SeriesCard
            title={t.adminAnalytics.savedJobs}
            total={engagement.savedJobs.total}
            series={engagement.savedJobs.daily}
          />
          <SeriesCard
            title={t.adminAnalytics.alertsDelivered}
            total={engagement.alertDeliveries.total}
            series={engagement.alertDeliveries.daily}
          />
          <SeriesCard
            title={t.adminAnalytics.registrations}
            total={engagement.registrations.total}
            series={engagement.registrations.daily}
          />
        </div>
      </section>

      <section aria-labelledby="analytics-monetization-heading">
        <h2
          id="analytics-monetization-heading"
          className="text-lg font-semibold text-foreground"
        >
          {t.adminAds.monetizationTitle}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label={t.adminAds.impressions}
            value={monetization.impressions}
          />
          <StatCard label={t.adminAds.clicks} value={monetization.clicks} />
        </div>
      </section>

      <section aria-labelledby="analytics-moderation-heading">
        <h2
          id="analytics-moderation-heading"
          className="text-lg font-semibold text-foreground"
        >
          {t.adminAnalytics.moderationTitle}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label={t.adminAnalytics.published}
            value={moderation.jobPublished}
          />
          <StatCard
            label={t.adminAnalytics.rejected}
            value={moderation.jobRejected}
          />
          <StatCard
            label={t.adminAnalytics.reverified}
            value={moderation.jobReverified}
          />
        </div>
      </section>

      <section aria-labelledby="analytics-platform-heading">
        <h2
          id="analytics-platform-heading"
          className="text-lg font-semibold text-foreground"
        >
          {t.adminAnalytics.platformTitle}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <StatCard
            label={t.adminAnalytics.publishedJobs}
            value={platform.publishedJobs}
            tone="success"
          />
          <StatCard
            label={t.adminAnalytics.pendingReview}
            value={platform.pendingReviewJobs}
          />
          <StatCard
            label={t.adminAnalytics.activeSessions}
            value={platform.activeSessions}
          />
          <StatCard
            label={t.adminAnalytics.totalSources}
            value={platform.totalSources}
          />
          <StatCard
            label={t.adminAnalytics.failingSources}
            value={platform.failingSources}
            tone={platform.failingSources > 0 ? "danger" : "success"}
          />
        </div>
        <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">{t.adminAnalytics.latestIngestion}</p>
          {platform.latestIngestion ? (
            <p className="mt-1 text-sm text-foreground">
              {new Date(platform.latestIngestion.timestamp).toLocaleString()}{" "}
              <span className="text-muted">
                · {platform.latestIngestion.total ?? 0} total ·{" "}
                {platform.latestIngestion.created} created ·{" "}
                {platform.latestIngestion.failed} failed
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {t.adminAnalytics.never}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}