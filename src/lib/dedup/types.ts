export type DuplicateMatchLevel =
  | "SOURCE_IDENTIFIER"
  | "SOURCE_URL"
  | "CONTENT_HASH"
  | "ORG_TITLE_LOCATION";

export type DuplicateClassification =
  | "UNIQUE"
  | "DUPLICATE"
  | "POSSIBLE_DUPLICATE";

export interface DuplicateDetectionResult {
  classification: DuplicateClassification;
  level: DuplicateMatchLevel | null;
  matchedJobId: string | null;
  matchedJobSourceId: string | null;
  confidence: number;
  reason: string | null;
}

export interface DuplicateDetectionInput {
  sourceId: string;
  externalId?: string | null;
  sourceUrl?: string | null;
  rawHash?: string | null;
  organizationId: string;
  normalizedTitle: string;
  locationId?: string | null;
}
