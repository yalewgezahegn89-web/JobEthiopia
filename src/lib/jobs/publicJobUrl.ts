export const PUBLIC_SITE_ORIGIN = "https://jobethiopia.et";

const PUBLIC_JOB_PATH_PREFIX = "/jobs/";
const PUBLIC_JOB_PATH_PATTERN = /^\/jobs\/[^/]+$/;

export function buildPublicJobUrl(jobId: string): string {
  const trimmedJobId = jobId.trim();
  if (!trimmedJobId) {
    throw new Error("A job id is required to build the public job URL.");
  }
  return `${PUBLIC_SITE_ORIGIN}${PUBLIC_JOB_PATH_PREFIX}${encodeURIComponent(trimmedJobId)}`;
}

export function isPublicJobUrl(value: string | null | undefined): boolean {
  if (!value) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port !== "" && parsed.port !== "443") return false;
  if (parsed.search || parsed.hash) return false;
  if (parsed.origin !== PUBLIC_SITE_ORIGIN) return false;

  return PUBLIC_JOB_PATH_PATTERN.test(parsed.pathname);
}
