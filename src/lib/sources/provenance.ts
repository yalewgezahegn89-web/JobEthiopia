/**
 * Server-controlled source records for jobs created outside the ingestion
 * pipeline.
 *
 * These names are the stable provisioning identifiers. The seed script
 * creates the corresponding `sources` rows (idempotently) using these exact
 * names, and the direct creation paths resolve their source record
 * server-side by name. Clients never supply or override these values.
 */

export const EMPLOYER_SOURCE_NAME = "Employer Portal";

export const API_KEY_SOURCE_NAME = "API Key";

export const MANUAL_SOURCE_NAME = "Manual Entry";

/** Internal, non-external provenance URL for created jobs with no external id. */
export function internalProvenanceUrl(sourceId: string): string {
  return `jobethiopia://source/${sourceId}/external/none`;
}