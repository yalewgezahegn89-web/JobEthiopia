/**
 * PostgreSQL error detection that works on real Postgres through the Drizzle/
 * pg driver wrapping.
 *
 * Background: the raw pg error (code 23505 / 23503, `constraint` name) arrives
 * wrapped on the `cause` chain (e.g. inside DrizzleQueryError), so predicate
 * patterns like `error.message.includes("<constraint>")` are unreliable: the
 * wrapped message does not carry the constraint, and a failed statement inside
 * a transaction aborts the whole transaction (25P02). Prefer ON CONFLICT DO
 * NOTHING where a graceful no-op is the goal; use these helpers where a precise
 * error mapping (e.g. "duplicate" / "in use") is intended.
 */
export type PgViolationKind = "unique" | "foreign_key";

export type PgViolation = {
  kind: PgViolationKind;
  constraint: string | null;
};

function walkFor(error: unknown, field: "code" | "constraint" | "message"): unknown {
  let level: unknown = error;
  const seen = new Set<unknown>();
  while (level != null && !seen.has(level)) {
    seen.add(level);
    if (typeof level === "object") {
      const value = (level as Record<string, unknown>)[field];
      if (value !== undefined) return value;
    }
    level = (level as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Matches a unique (23505) or foreign-key (23503) violation carried anywhere on
 * the error's cause chain, falling back to the PostgreSQL message text for
 * legacy/plain errors. When `constraint` is given, only that constraint matches.
 */
export function matchPgViolation(
  error: unknown,
  constraint?: string,
): PgViolation | null {
  const code = walkFor(error, "code");
  let kind: PgViolationKind | null = null;
  if (code === "23505") kind = "unique";
  else if (code === "23503") kind = "foreign_key";

  if (kind !== null) {
    const foundConstraint = walkFor(error, "constraint");
    const named = typeof foundConstraint === "string" ? foundConstraint : null;
    if (constraint === undefined || named === constraint) {
      return { kind, constraint: named };
    }
    return null;
  }

  const message = walkFor(error, "message");
  if (typeof message !== "string") return null;

  if (constraint !== undefined) {
    if (!message.includes(constraint)) return null;
    if (/foreign key/i.test(message)) {
      return { kind: "foreign_key", constraint };
    }
    return { kind: "unique", constraint };
  }

  if (/unique constraint|duplicate key/i.test(message)) {
    return { kind: "unique", constraint: null };
  }
  if (/foreign key/i.test(message)) {
    return { kind: "foreign_key", constraint: null };
  }
  return null;
}

/** True when `error` is (or wraps) a PostgreSQL unique-violation. */
export function isPgUniqueViolation(error: unknown, constraint?: string): boolean {
  return matchPgViolation(error, constraint)?.kind === "unique";
}

/** True when `error` is (or wraps) a PostgreSQL foreign-key violation. */
export function isPgForeignKeyViolation(error: unknown, constraint?: string): boolean {
  return matchPgViolation(error, constraint)?.kind === "foreign_key";
}