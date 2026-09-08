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

/**
 * Canonical names of the WEBSITE-type source records used by the verified
 * vacancy catalogue. These exact strings must match the `sources.name` rows
 * (e.g. in the staging environment the rows were originally seeded with the
 * short "UNICEF Careers" / "UNFPA" names and have been corrected to these).
 */
export const UNICEF_CAREERS_SOURCE_NAME = "UNICEF Careers Website";

export const UNFPA_CAREERS_SOURCE_NAME = "UNFPA Careers Website";

/** Internal, non-external provenance URL for created jobs with no external id. */
export function internalProvenanceUrl(sourceId: string): string {
  return `jobethiopia://source/${sourceId}/external/none`;
}