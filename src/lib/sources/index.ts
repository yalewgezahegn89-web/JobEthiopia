export type { FetchResult, SourceAdapter } from "./adapter";

export {
  recordSuccessfulCheck,
  recordFailedCheck,
  isSourceDueForCheck,
  getSourceHealth,
  autoDeactivateIfUnhealthy,
  AUTO_DEACTIVATE_THRESHOLD,
} from "./health";

export type { SourceHealthStatus } from "./types";
