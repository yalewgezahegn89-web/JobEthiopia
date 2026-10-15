import { describe, expect, it } from "vitest";

import {
  isPgForeignKeyViolation,
  isPgUniqueViolation,
  matchPgViolation,
} from "@/lib/pgErrors";

function wrappedUniqueError(opts: {
  constraint?: string;
  code?: string;
  message?: string;
}): Error {
  const { constraint = "jobs_slug_unique", code = "23505", message = "job INSERT failed" } = opts;
  const cause = Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code,
    constraint,
    severity: "ERROR",
  });
  const wrapped = new Error(message, { cause });
  return wrapped;
}

describe("pgErrors", () => {
  describe("matchPgViolation", () => {
    it("finds a unique violation wrapped on the cause chain (real PG shape)", () => {
      const error = wrappedUniqueError({});
      expect(matchPgViolation(error)).toEqual({ kind: "unique", constraint: "jobs_slug_unique" });
      expect(isPgUniqueViolation(error)).toBe(true);
      expect(isPgUniqueViolation(error, "jobs_slug_unique")).toBe(true);
      expect(isPgUniqueViolation(error, "categories_slug_unique")).toBe(false);
    });

    it("finds a foreign-key violation wrapped on the cause chain", () => {
      const error = wrappedUniqueError({
        code: "23503",
        constraint: "jobs_organization_id_fkey",
        message: "organization INSERT failed",
      });
      expect(matchPgViolation(error)).toEqual({
        kind: "foreign_key",
        constraint: "jobs_organization_id_fkey",
      });
      expect(isPgForeignKeyViolation(error)).toBe(true);
      expect(isPgForeignKeyViolation(error, "jobs_organization_id_fkey")).toBe(true);
      expect(isPgForeignKeyViolation(error, "jobs_organization_id_fkey_other")).toBe(false);
    });

    it("matches a bare Postgres error (no wrapper)", () => {
      const error = Object.assign(new Error("duplicate key value violates unique constraint \"users_email_unique\""), {
        code: "23505",
        constraint: "users_email_unique",
      });
      expect(matchPgViolation(error)).toEqual({ kind: "unique", constraint: "users_email_unique" });
    });

    it("falls back to the legacy message pattern for plain errors without a PG code", () => {
      const error = new Error('duplicate key value violates unique constraint "sources_name_unique"');
      expect(isPgUniqueViolation(error, "sources_name_unique")).toBe(true);
      expect(isPgUniqueViolation(error, "other_name_unique")).toBe(false);
      expect(matchPgViolation(error)).toEqual({ kind: "unique", constraint: null });
    });

    it("matches a foreign-key message text without a constraint name", () => {
      const error = new Error('update or delete on table "organizations" violates foreign key constraint');
      expect(isPgForeignKeyViolation(error)).toBe(true);
    });

    it("does not match unrelated errors", () => {
      expect(matchPgViolation(new Error("boom"))).toBeNull();
      expect(isPgUniqueViolation("not an error")).toBe(false);
      expect(isPgForeignKeyViolation(null)).toBe(false);
      expect(isPgUniqueViolation(undefined)).toBe(false);
    });

    it("constraint filter applies to the legacy message fallback", () => {
      const error = new Error('duplicate key value violates unique constraint "professions_slug_unique"');
      expect(isPgUniqueViolation(error, "professions_slug_unique")).toBe(true);
      expect(isPgUniqueViolation(error, "jobs_slug_unique")).toBe(false);
    });

    it("accepts the legacy message form used by the jobs tests", () => {
      const error = new Error("duplicate key value violates unique constraint: jobs_slug_unique");
      expect(isPgUniqueViolation(error, "jobs_slug_unique")).toBe(true);
      expect(isPgUniqueViolation(error)).toBe(true);
    });

    it("does not confuse a unique violation for a foreign-key violation", () => {
      const error = wrappedUniqueError({});
      expect(isPgForeignKeyViolation(error)).toBe(false);
    });
  });
});