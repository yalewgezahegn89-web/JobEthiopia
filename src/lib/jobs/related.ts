import type { PublicJobSummary } from "./public";

type MatchOptions = {
  category?: string | null;
  profession?: string | null;
};

export function selectRelatedJobs(
  items: PublicJobSummary[],
  currentId: string,
  options: MatchOptions = {},
  count = 3,
): PublicJobSummary[] {
  if (!Array.isArray(items) || count <= 0) {
    return [];
  }

  const category = options.category?.trim() || null;
  const profession = options.profession?.trim() || null;

  if (category === null && profession === null) {
    return [];
  }

  const both: PublicJobSummary[] = [];
  const either: PublicJobSummary[] = [];

  for (const job of items) {
    if (job.id === currentId) {
      continue;
    }
    const jobCategory = job.categoryName?.trim() || null;
    const jobProfession = job.professionName?.trim() || null;
    const categoryMatch =
      category !== null && jobCategory === category;
    const professionMatch =
      profession !== null && jobProfession === profession;

    if (categoryMatch && professionMatch) {
      both.push(job);
    } else if (categoryMatch || professionMatch) {
      either.push(job);
    }
  }

  return [...both, ...either].slice(0, count);
}
