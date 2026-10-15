/**
 * Canonical employment-type options (Phase 8 Batch 2).
 *
 * Single source of truth shared by API validation, the public jobs page and
 * any filter UI so the dropdown is not derived from the first page of results.
 * Kept in sync with `employmentTypeEnum` in the DB schema via a parity test.
 */
import { employmentTypeEnum } from "@/db/schema/enums";

export const EMPLOYMENT_TYPE_OPTIONS = employmentTypeEnum.enumValues;

export type EmploymentType = (typeof EMPLOYMENT_TYPE_OPTIONS)[number];

export function formatEmploymentType(value: string): string {
  return value.replace("_", " ");
}