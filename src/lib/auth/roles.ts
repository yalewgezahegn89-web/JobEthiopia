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

export interface AuthUser {
  id: string;
  email: string;
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