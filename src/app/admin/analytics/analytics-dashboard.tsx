"use client";

import type {
  AnalyticsSummary,
  DailyCount,
} from "@/lib/admin/analytics";
import type { Messages } from "@/lib/i18n/dictionary";
import {
  ANALYTICS_WINDOW_IDS,
  ANALYTICS_WINDOWS,
  DEFAULT_ANALYTICS_WINDOW_ID,
  type AnalyticsWindowId,
} from "@/lib/analytics/timeWindows";
import { LOCALE_METADATA, type Locale } from "@/lib/i18n/locale";

const HOURLY_POINT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}$/;

function formatDay(day: string): string {
  if (HOURLY_POINT_PATTERN.test(day)) {
    const [datePart, hour] = day.split("T");
    const date = new Date(`${datePart}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return day;
    return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${hour}:00`;
  }
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
        {series.length === 0 && <span className="text-sm text-muted">-</span>}
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

function CountList({
  rows,
  emptyLabel,
}: {
  rows: { label: string; value: string | number }[];
  emptyLabel?: string;
}) {
  return (
    <ul className="mt-2 space-y-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="min-w-0 truncate font-medium text-foreground">
            {row.label}
          </span>
          <span className="shrink-0 tabular-nums text-muted">{row.value}</span>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="text-sm text-muted">{emptyLabel ?? "-"}</li>
      )}
    </ul>
  );
}

function SectionHeading({
  id,
  title,
  caption,
}: {
  id: string;
  title: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {title}
      </h2>
      {caption && <span className="text-sm text-muted">{caption}</span>}
    </div>
  );
}

function localeName(locale: string): string {
  return LOCALE_METADATA[(locale as Locale) in LOCALE_METADATA ? (locale as Locale) : "en"].name;
}

function windowLabel(id: AnalyticsWindowId, t: Messages): string {
  return id === "1d"
    ? t.adminAnalytics.last24Hours
    : t.adminAnalytics.lastDays(ANALYTICS_WINDOWS[id].days);
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

  // Payload sections added in Phase 15 are read defensively so a partial or
  // cached payload renders instead of crashing the staff dashboard.
  const searchQuality = summary.searchQuality;
  const publicPages = summary.publicPages;
  const funnel = summary.funnel;
  const recommendations = summary.recommendations;
  const careerTools = summary.careerTools;
  const notificationMetrics = summary.notifications;
  const employer = summary.employer;
  const ingestion = summary.ingestion;
  const trends = summary.trends ?? {
    pageViews: [],
    recommendationViews: [],
    feedback: [],
    adImpressions: [],
    adClicks: [],
  };
  const topAppliedJobs = discovery.topAppliedJobs ?? [];
  const activeWindowId = window?.id ?? DEFAULT_ANALYTICS_WINDOW_ID;

  const statusLabels: Record<string, string> = {
    SUBMITTED: t.adminAnalytics.statusSubmitted,
    REVIEWING: t.adminAnalytics.statusReviewing,
    SHORTLISTED: t.adminAnalytics.statusShortlisted,
    REJECTED: t.adminAnalytics.statusRejected,
    WITHDRAWN: t.adminAnalytics.statusWithdrawn,
  };

  const hasDiscovery =
    discovery.totals.job_viewed > 0 ||
    discovery.totals.job_search > 0 ||
    discovery.totals.job_list_viewed > 0;

  return (
    <div className="mt-6 space-y-8">
      <nav
        aria-label={t.adminAnalytics.windowTitle}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-sm text-muted">{t.adminAnalytics.windowTitle}</span>
        {ANALYTICS_WINDOW_IDS.map((id) => {
          const isActive = id === activeWindowId;
          return (
            <a
              key={id}
              href={`/admin/analytics?window=${id}`}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                isActive
                  ? "border-primary bg-primary-light font-semibold text-foreground"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {windowLabel(id, t)}
            </a>
          );
        })}
      </nav>

      <section aria-labelledby="analytics-discovery-heading">
        <SectionHeading
          id="analytics-discovery-heading"
          title={t.adminAnalytics.discoveryTitle}
          caption={windowLabel(activeWindowId, t)}
        />
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.searchQualityTitle}
            </p>
            {!searchQuality || searchQuality.searches === 0 ? (
              <p className="mt-3 text-sm text-muted">
                {t.adminAnalytics.noSearchQuality}
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <StatCard
                    label={t.adminAnalytics.searches}
                    value={searchQuality.searches}
                  />
                  <StatCard
                    label={t.adminAnalytics.zeroResultSearches}
                    value={searchQuality.zeroResultSearches}
                    tone={
                      searchQuality.zeroResultSearches > 0 ? "danger" : "default"
                    }
                  />
                  <StatCard
                    label={t.adminAnalytics.zeroResultRate}
                    value={`${searchQuality.zeroResultRate}%`}
                  />
                  <StatCard
                    label={t.adminAnalytics.avgResults}
                    value={searchQuality.avgResults}
                  />
                </div>
                <p className="mt-4 text-sm text-muted">
                  {t.adminAnalytics.filterUsage}
                </p>
                <CountList
                  rows={[
                    {
                      label: t.adminAnalytics.filterQuery,
                      value: searchQuality.filters.query,
                    },
                    {
                      label: t.adminAnalytics.filterCategory,
                      value: searchQuality.filters.category,
                    },
                    {
                      label: t.adminAnalytics.filterProfession,
                      value: searchQuality.filters.profession,
                    },
                    {
                      label: t.adminAnalytics.filterLocation,
                      value: searchQuality.filters.location,
                    },
                    {
                      label: t.adminAnalytics.filterEmploymentType,
                      value: searchQuality.filters.employmentType,
                    },
                    {
                      label: t.adminAnalytics.filterOrganization,
                      value: searchQuality.filters.organization,
                    },
                  ]}
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-muted">
                {t.adminAnalytics.publicPagesTitle}
              </p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {publicPages?.total ?? 0}
              </p>
            </div>
            <p className="mt-3 text-sm text-muted">
              {t.adminAnalytics.topPages}
            </p>
            <CountList
              emptyLabel={t.adminAnalytics.noPublicPages}
              rows={(publicPages?.topPaths ?? []).map((row) => ({
                label: row.path,
                value: row.count,
              }))}
            />
            <div className="mt-4">
              <MiniBarChart series={trends.pageViews} />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="analytics-engagement-heading">
        <SectionHeading
          id="analytics-engagement-heading"
          title={t.adminAnalytics.engagementTitle}
          caption={windowLabel(activeWindowId, t)}
        />
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">{t.adminAnalytics.funnelTitle}</p>
            <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
              {funnel?.total ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t.adminAnalytics.statusNote}
            </p>
            <CountList
              emptyLabel={t.adminAnalytics.noFunnel}
              rows={(funnel?.byStatus ?? []).map((row) => ({
                label: statusLabels[row.status] ?? row.status,
                value: row.count,
              }))}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.topAppliedJobs}
            </p>
            <CountList
              emptyLabel={t.adminAnalytics.noAppliedJobs}
              rows={topAppliedJobs.map((job, index) => ({
                label: `${index + 1}. ${job.title ?? job.jobId}`,
                value: `${job.applications} ${t.adminAnalytics.applicationsUnit}`,
              }))}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.careerToolsTitle}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <StatCard
                label={t.adminAnalytics.cvActions}
                value={careerTools?.cvActions ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.coverLetterActions}
                value={careerTools?.coverLetterActions ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.toolPageViews}
                value={careerTools?.toolPageViews ?? 0}
              />
            </div>
            <div className="mt-4">
              <CountList
                emptyLabel={t.adminAnalytics.noCareerTools}
                rows={(careerTools?.byEvent ?? []).map((row) => ({
                  label: row.event,
                  value: row.count,
                }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.recommendationsTitle}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard
                label={t.adminAnalytics.recViews}
                value={recommendations?.views ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.recAvgResults}
                value={recommendations?.avgResults ?? 0}
              />
            </div>
            <div className="mt-4">
              <MiniBarChart series={trends.recommendationViews} />
            </div>
            <p className="mt-4 text-sm text-muted">
              {t.adminAnalytics.feedbackTitle}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <StatCard
                label={t.adminAnalytics.feedbackRelevant}
                value={recommendations?.feedback.relevant ?? 0}
                tone="success"
              />
              <StatCard
                label={t.adminAnalytics.feedbackNotRelevant}
                value={recommendations?.feedback.notRelevant ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.feedbackHidden}
                value={recommendations?.feedback.hidden ?? 0}
              />
            </div>
            <div className="mt-4">
              <MiniBarChart series={trends.feedback} />
            </div>
            {(recommendations?.views ?? 0) === 0 && (
              <p className="mt-2 text-sm text-muted">
                {t.adminAnalytics.noRecommendations}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.notificationsTitle}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard
                label={t.adminAnalytics.notificationsCreated}
                value={notificationMetrics?.created ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.notificationsRead}
                value={notificationMetrics?.read ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.notificationsUnread}
                value={notificationMetrics?.unread ?? 0}
                tone={(notificationMetrics?.unread ?? 0) > 0 ? "danger" : "default"}
              />
              <StatCard
                label={t.adminAnalytics.notificationsReadRate}
                value={`${notificationMetrics?.readRate ?? 0}%`}
              />
            </div>
            <p className="mt-4 text-sm text-muted">
              {t.adminAnalytics.notificationsByType}
            </p>
            <CountList
              emptyLabel={t.adminAnalytics.noNotifications}
              rows={(notificationMetrics?.byType ?? []).map((row) => ({
                label: row.type,
                value: row.count,
              }))}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="analytics-monetization-heading">
        <SectionHeading
          id="analytics-monetization-heading"
          title={t.adminAds.monetizationTitle}
          caption={windowLabel(activeWindowId, t)}
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label={t.adminAds.impressions}
            value={monetization.impressions}
          />
          <StatCard label={t.adminAds.clicks} value={monetization.clicks} />
          <StatCard
            label={t.adminAnalytics.ctr}
            value={`${monetization.ctr ?? 0}%`}
          />
        </div>
        <div className="mt-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">
            {t.adminAnalytics.adPlacementsTitle}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t.adminAds.impressions} / {t.adminAds.clicks}
          </p>
          <CountList
            emptyLabel={t.adminAnalytics.noPlacements}
            rows={(monetization.byPlacement ?? []).map((row) => ({
              label: row.placementId,
              value: `${row.impressions} / ${row.clicks}`,
            }))}
          />
          <div className="mt-4">
            <MiniBarChart series={trends.adImpressions} />
          </div>
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.ingestionTitle}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <StatCard
                label={t.adminAnalytics.ingestionRuns}
                value={ingestion?.runs ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.jobsIngested}
                value={ingestion?.jobsIngested ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.activeSources}
                value={ingestion?.activeSources ?? 0}
              />
            </div>
            {(ingestion?.runs ?? 0) === 0 && (
              <p className="mt-3 text-sm text-muted">
                {t.adminAnalytics.noIngestion}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">
              {t.adminAnalytics.employerTitle}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard
                label={t.adminAnalytics.employerAccounts}
                value={employer?.employerAccounts ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.totalOrganizations}
                value={employer?.totalOrganizations ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.newOrganizations}
                value={employer?.newOrganizations ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.jobsCreated}
                value={employer?.jobsCreated ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.applications}
                value={employer?.applicationsReceived ?? 0}
              />
              <StatCard
                label={t.adminAnalytics.applicationReviews}
                value={employer?.applicationReviews ?? 0}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
