import {
  closingState,
  type PublicJobSummary,
} from "@/lib/jobs/public";

export type SelectClosingJobsOptions = {
  count?: number;
  now?: Date;
};

export function selectClosingJobs(
  items: PublicJobSummary[],
  options: SelectClosingJobsOptions = {},
): PublicJobSummary[] {
  const count = options.count ?? 5;

  if (count <= 0 || items.length === 0) {
    return [];
  }

  const closing = items
    .filter(
      (item) =>
        closingState(item.deadline, item.status, options.now) === "CLOSING",
    )
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })
    .slice(0, count);

  return closing;
}
