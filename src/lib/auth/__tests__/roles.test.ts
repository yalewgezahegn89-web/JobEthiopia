import { describe, it, expect } from "vitest";
import {
  USER_ROLES,
  STAFF_ROLES,
  hasRole,
  hasAnyRole,
  isStaffRole,
} from "../roles";

describe("roles", () => {
  it("defines the full role model", () => {
    expect(USER_ROLES).toEqual([
      "SUPER_ADMIN",
      "ADMIN",
      "MODERATOR",
      "ORGANIZATION_ADMIN",
      "CANDIDATE",
    ]);
  });

  it("treats SUPER_ADMIN, ADMIN, MODERATOR as staff roles", () => {
    expect(STAFF_ROLES).toContain("SUPER_ADMIN");
    expect(STAFF_ROLES).toContain("ADMIN");
    expect(STAFF_ROLES).toContain("MODERATOR");
    expect(STAFF_ROLES).not.toContain("ORGANIZATION_ADMIN");
    expect(STAFF_ROLES).not.toContain("CANDIDATE");
    for (const role of STAFF_ROLES) {
      expect(isStaffRole(role)).toBe(true);
    }
  });

  it("excludes organization admin and candidate from staff access", () => {
    expect(isStaffRole("ORGANIZATION_ADMIN")).toBe(false);
    expect(isStaffRole("CANDIDATE")).toBe(false);
  });

  it("hasRole matches exact roles", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "ADMIN")).toBe(false);
  });

  it("hasAnyRole allows any listed role", () => {
    expect(hasAnyRole("MODERATOR", ["ADMIN", "MODERATOR"])).toBe(true);
    expect(hasAnyRole("ADMIN", ["SUPER_ADMIN", "MODERATOR"])).toBe(false);
  });

  it("enforces least privilege: admin is not super admin", () => {
    expect(hasRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });
});