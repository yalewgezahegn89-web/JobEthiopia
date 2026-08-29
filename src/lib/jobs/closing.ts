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

  const closing: PublicJobSummary[] = [];
  for (const item of items) {
    if (closingState(item.deadline, item.status, options.now) === "CLOSING") {
      closing.push(item);
      if (closing.length >= count) {
        break;
      }
    }
  }
  return closing;
}
