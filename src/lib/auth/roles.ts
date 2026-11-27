export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "ORGANIZATION_ADMIN",
  "CANDIDATE",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Roles that may access the staff admin area. Future batches may refine this. */
export const STAFF_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
];

/** Roles allowed to grant HIGH source trust or enable auto-publication. */
export const PRIVILEGED_SOURCE_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
];

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
}

export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return userRole === required;
}

export function hasAnyRole(
  userRole: UserRole,
  requiredRoles: readonly UserRole[],
): boolean {
  return requiredRoles.includes(userRole);
}

export function isStaffRole(userRole: UserRole): boolean {
  return STAFF_ROLES.includes(userRole);
}

export function canManagePrivilegedSourceFields(userRole: UserRole): boolean {
  return hasAnyRole(userRole, PRIVILEGED_SOURCE_ROLES);
}

/** True when a source mutation would grant HIGH trust or enable auto-publish. */
export function requestsPrivilegedSourceFields(input: {
  trustLevel?: string | null;
  autoPublish?: boolean | null;
  sourceType?: string | null;
}): boolean {
  return (
    input.trustLevel === "HIGH" ||
    input.autoPublish === true ||
    input.sourceType === "FACEBOOK"
  );
}

/**
 * The actor that is performing a source mutation.
 *
 * `staff` carries an authenticated session user. `api_key` is a machine
 * credential and deliberately carries no role: it can never be promoted to
 * ADMIN or SUPER_ADMIN by caller input.
 */
export type SourceMutationActor =
  | { kind: "staff"; id: string; role: UserRole }
  | { kind: "api_key" };

/** The ingestion API-key actor. There is intentionally no role attached. */
export const API_KEY_SOURCE_ACTOR: SourceMutationActor = { kind: "api_key" };

export function toStaffSourceActor(
  user: Pick<AuthUser, "id" | "role">,
): SourceMutationActor {
  return { kind: "staff", id: user.id, role: user.role };
}

export function canActorManagePrivilegedSourceFields(
  actor: SourceMutationActor,
): boolean {
  return (
    actor.kind === "staff" && canManagePrivilegedSourceFields(actor.role)
  );
}

export type SourceMutationOperation =
  | "create"
  | "update"
  | "activate"
  | "deactivate"
  | "delete"
  | "sync";

export interface SourceAuthorizationSnapshot {
  name?: string | null;
  sourceType?: string | null;
  baseUrl?: string | null;
  isActive?: boolean | null;
  trustLevel?: string | null;
  autoPublish?: boolean | null;
  checkFrequencyMinutes?: number | null;
  facebookPageId?: string | null;
  facebookPageKind?: string | null;
  facebookApprovalState?: string | null;
  facebookContentUseState?: string | null;
  facebookAuthorizationNote?: string | null;
}

export interface SourceMutationInput extends SourceAuthorizationSnapshot {
  existing?: SourceAuthorizationSnapshot | null;
  operation?: SourceMutationOperation;
}

export const SOURCE_PRIVILEGE_FIELDS = [
  "trustLevel",
  "autoPublish",
] as const;

export const SOURCE_INGESTION_FIELDS = ["sourceType", "baseUrl"] as const;

export const SOURCE_FACEBOOK_FIELDS = [
  "facebookPageId",
  "facebookPageKind",
  "facebookApprovalState",
  "facebookContentUseState",
  "facebookAuthorizationNote",
] as const;

export const SOURCE_LIFECYCLE_FIELDS = ["isActive"] as const;

export const SOURCE_MUTATION_FIELDS = [
  "name",
  "sourceType",
  "baseUrl",
  "isActive",
  "trustLevel",
  "autoPublish",
  "checkFrequencyMinutes",
  ...SOURCE_FACEBOOK_FIELDS,
] as const;

export type SourceMutationField = (typeof SOURCE_MUTATION_FIELDS)[number];

const API_KEY_UPDATE_ALLOWED_FIELDS: readonly SourceMutationField[] = [
  "name",
  "sourceType",
  "baseUrl",
  "isActive",
  "checkFrequencyMinutes",
];

export function isPrivilegedSource(
  source: SourceAuthorizationSnapshot,
): boolean {
  return (
    source.trustLevel === "HIGH" ||
    source.autoPublish === true ||
    source.sourceType === "FACEBOOK"
  );
}

function normalizeSourceValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

function sourceValuesEqual(left: unknown, right: unknown): boolean {
  return normalizeSourceValue(left) === normalizeSourceValue(right);
}

function effectiveSource(
  input: SourceMutationInput,
  existing: SourceAuthorizationSnapshot | null,
): SourceAuthorizationSnapshot {
  const merged: SourceAuthorizationSnapshot = { ...(existing ?? {}) };
  for (const field of SOURCE_MUTATION_FIELDS) {
    if (input[field] !== undefined) {
      (merged as Record<string, unknown>)[field] = input[field];
    }
  }
  return merged;
}

export function changedSourceFields(
  input: SourceMutationInput,
): SourceMutationField[] {
  const operation =
    input.operation ?? (input.existing ? "update" : "create");
  if (operation !== "create" && operation !== "update") {
    return [];
  }

  const existing = operation === "update" ? input.existing ?? null : null;
  const changed: SourceMutationField[] = [];
  for (const field of SOURCE_MUTATION_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (!existing || !sourceValuesEqual(existing[field], value)) {
      changed.push(field);
    }
  }
  return changed;
}

function authorizeSourceCreation(
  input: SourceMutationInput,
): SourceMutationAuthorization {
  if (requestsPrivilegedSourceFields(input)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  for (const field of SOURCE_FACEBOOK_FIELDS) {
    if (input[field] !== undefined && input[field] !== null && input[field] !== "") {
      return { ok: false, code: "FORBIDDEN" };
    }
  }

  return { ok: true };
}

export type SourceMutationAuthorization =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" };

/**
 * Single shared source-mutation policy.
 *
 * Authorization is based on the actor, the persisted source, the effective
 * merged source, and the exact fields that would actually change. This prevents
 * a caller from leaving privileged fields untouched while redirecting an
 * already-privileged source to attacker-controlled content.
 */
export function authorizeSourceMutation(
  actor: SourceMutationActor,
  input: SourceMutationInput,
): SourceMutationAuthorization {
  if (actor.kind === "staff" && !isStaffRole(actor.role)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (canActorManagePrivilegedSourceFields(actor)) {
    return { ok: true };
  }

  const operation =
    input.operation ?? (input.existing ? "update" : "create");

  if (operation === "create") {
    return authorizeSourceCreation(input);
  }

  if (
    operation === "activate" ||
    operation === "deactivate" ||
    operation === "delete" ||
    operation === "sync"
  ) {
    if (input.existing && isPrivilegedSource(input.existing)) {
      return { ok: false, code: "FORBIDDEN" };
    }
    return { ok: true };
  }

  const existing = input.existing ?? null;
  if (!existing) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const changed = changedSourceFields(input);
  if (changed.length === 0) {
    return { ok: true };
  }

  const before = existing;
  const after = effectiveSource(input, existing);
  const privilegedBefore = isPrivilegedSource(before);
  const privilegedAfter = isPrivilegedSource(after);

  for (const field of changed) {
    if (
      (SOURCE_PRIVILEGE_FIELDS as readonly SourceMutationField[]).includes(
        field,
      ) ||
      (SOURCE_FACEBOOK_FIELDS as readonly SourceMutationField[]).includes(
        field,
      )
    ) {
      return { ok: false, code: "FORBIDDEN" };
    }
  }

  const changesIngestion =
    changed.includes("sourceType") || changed.includes("baseUrl");
  if (changesIngestion && (privilegedBefore || privilegedAfter)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (
    changed.includes("isActive") &&
    (privilegedBefore || privilegedAfter)
  ) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (actor.kind === "api_key") {
    const allowed = new Set<SourceMutationField>(API_KEY_UPDATE_ALLOWED_FIELDS);
    if (changed.some((field) => !allowed.has(field))) {
      return { ok: false, code: "FORBIDDEN" };
    }
  }

  return { ok: true };
}
