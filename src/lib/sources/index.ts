export type { FetchResult, SourceAdapter } from "./adapter";

export {
  recordSuccessfulCheck,
  recordFailedCheck,
  isSourceDueForCheck,
  getSourceHealth,
} from "./health";

export type { SourceHealthStatus } from "./types";
