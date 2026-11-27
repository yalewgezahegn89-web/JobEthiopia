import { describe, it, expect } from "vitest";
import {
  USER_ROLES,
  STAFF_ROLES,
  API_KEY_SOURCE_ACTOR,
  authorizeSourceMutation,
  canActorManagePrivilegedSourceFields,
  canManagePrivilegedSourceFields,
  changedSourceFields,
  isPrivilegedSource,
  requestsPrivilegedSourceFields,
  toStaffSourceActor,
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

  it("limits privileged source fields to admins and super admins", () => {
    expect(canManagePrivilegedSourceFields("SUPER_ADMIN")).toBe(true);
    expect(canManagePrivilegedSourceFields("ADMIN")).toBe(true);
    expect(canManagePrivilegedSourceFields("MODERATOR")).toBe(false);
    expect(canManagePrivilegedSourceFields("ORGANIZATION_ADMIN")).toBe(false);
    expect(canManagePrivilegedSourceFields("CANDIDATE")).toBe(false);
  });

  it("detects privileged source field requests", () => {
    expect(requestsPrivilegedSourceFields({ trustLevel: "HIGH" })).toBe(true);
    expect(requestsPrivilegedSourceFields({ autoPublish: true })).toBe(true);
    expect(requestsPrivilegedSourceFields({ sourceType: "FACEBOOK" })).toBe(
      true,
    );
    expect(
      requestsPrivilegedSourceFields({ trustLevel: "MEDIUM", autoPublish: false }),
    ).toBe(false);
    expect(requestsPrivilegedSourceFields({})).toBe(false);
  });
});

const MODERATOR = toStaffSourceActor({ id: "mod-1", role: "MODERATOR" });

const ORDINARY_SOURCE = {
  name: "Ordinary",
  sourceType: "WEBSITE",
  baseUrl: "https://example.com",
  isActive: true,
  trustLevel: "MEDIUM",
  autoPublish: false,
  checkFrequencyMinutes: 60,
  facebookPageId: null,
  facebookPageKind: null,
  facebookApprovalState: "NOT_REQUESTED",
  facebookContentUseState: "NOT_RECORDED",
  facebookAuthorizationNote: null,
} as const;

const PRIVILEGED_SOURCE = {
  ...ORDINARY_SOURCE,
  sourceType: "API",
  baseUrl: "https://trusted.example.com/feed",
  trustLevel: "HIGH",
  autoPublish: true,
} as const;

const FACEBOOK_SOURCE = {
  ...ORDINARY_SOURCE,
  sourceType: "FACEBOOK",
  baseUrl: "https://www.facebook.com/example",
  facebookPageId: "page-1",
  facebookPageKind: "EXTERNAL_PAGE",
  facebookApprovalState: "APPROVED",
  facebookContentUseState: "AUTHORIZED",
} as const;

describe("shared source mutation policy", () => {
  it("only treats ADMIN and SUPER_ADMIN staff as privileged", () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
      const actor = toStaffSourceActor({ id: "staff-1", role });
      expect(canActorManagePrivilegedSourceFields(actor)).toBe(true);
      expect(
        authorizeSourceMutation(actor, {
          existing: PRIVILEGED_SOURCE,
          operation: "update",
          baseUrl: "https://anywhere.example.com/feed",
          trustLevel: "HIGH",
          autoPublish: true,
        }),
      ).toEqual({ ok: true });
    }

    for (const role of ["MODERATOR", "ORGANIZATION_ADMIN", "CANDIDATE"] as const) {
      const actor = toStaffSourceActor({ id: "staff-1", role });
      expect(canActorManagePrivilegedSourceFields(actor)).toBe(false);
    }
  });

  it("identifies privileged sources", () => {
    expect(isPrivilegedSource(ORDINARY_SOURCE)).toBe(false);
    expect(isPrivilegedSource(PRIVILEGED_SOURCE)).toBe(true);
    expect(isPrivilegedSource({ ...ORDINARY_SOURCE, autoPublish: true })).toBe(
      true,
    );
    expect(isPrivilegedSource(FACEBOOK_SOURCE)).toBe(true);
  });

  it("never treats an API-key actor as an administrator", () => {
    expect(canActorManagePrivilegedSourceFields(API_KEY_SOURCE_ACTOR)).toBe(
      false,
    );
    expect(
      authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
        trustLevel: "HIGH",
        operation: "create",
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(
      authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
        autoPublish: true,
        operation: "create",
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("allows non-admins to create ordinary sources", () => {
    for (const actor of [MODERATOR, API_KEY_SOURCE_ACTOR]) {
      expect(
        authorizeSourceMutation(actor, {
          name: "New source",
          sourceType: "WEBSITE",
          baseUrl: "https://example.com",
          trustLevel: "MEDIUM",
          autoPublish: false,
          operation: "create",
        }),
      ).toEqual({ ok: true });
    }
  });

  it("denies non-admins privileged source creation and Facebook metadata", () => {
    for (const actor of [MODERATOR, API_KEY_SOURCE_ACTOR]) {
      expect(
        authorizeSourceMutation(actor, {
          name: "High",
          sourceType: "WEBSITE",
          trustLevel: "HIGH",
          operation: "create",
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(
        authorizeSourceMutation(actor, {
          name: "Auto",
          sourceType: "WEBSITE",
          autoPublish: true,
          operation: "create",
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(
        authorizeSourceMutation(actor, {
          name: "Facebook",
          sourceType: "FACEBOOK",
          facebookPageId: "page-1",
          operation: "create",
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(
        authorizeSourceMutation(actor, {
          name: "Approval",
          sourceType: "WEBSITE",
          facebookApprovalState: "APPROVED",
          operation: "create",
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
    }
  });

  it("allows moderators to edit non-privileged fields on ordinary sources", () => {
    expect(
      authorizeSourceMutation(MODERATOR, {
        existing: ORDINARY_SOURCE,
        operation: "update",
        name: "Renamed",
        sourceType: "FEED",
        baseUrl: "https://feeds.example.com/jobs",
        checkFrequencyMinutes: 120,
        isActive: false,
      }),
    ).toEqual({ ok: true });
  });

  it("denies moderators changing privileged fields on ordinary sources", () => {
    for (const change of [
      { trustLevel: "HIGH" },
      { autoPublish: true },
      { sourceType: "FACEBOOK" },
      { facebookApprovalState: "APPROVED" },
      { facebookContentUseState: "AUTHORIZED" },
      { facebookPageId: "page-2" },
      { facebookPageKind: "EXTERNAL_PAGE" },
    ]) {
      expect(
        authorizeSourceMutation(MODERATOR, {
          existing: ORDINARY_SOURCE,
          operation: "update",
          ...change,
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
    }
  });

  it("denies redirecting or reconfiguring an existing privileged source", () => {
    for (const change of [
      { baseUrl: "https://evil.example.com/feed" },
      { sourceType: "FEED" },
      { isActive: false },
      { trustLevel: "LOW" },
      { autoPublish: false },
      { facebookApprovalState: "APPROVED" },
    ]) {
      expect(
        authorizeSourceMutation(MODERATOR, {
          existing: PRIVILEGED_SOURCE,
          operation: "update",
          ...change,
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
    }
  });

  it("still allows safe edits on a privileged source", () => {
    expect(
      authorizeSourceMutation(MODERATOR, {
        existing: PRIVILEGED_SOURCE,
        operation: "update",
        name: "Renamed",
        checkFrequencyMinutes: 120,
      }),
    ).toEqual({ ok: true });
  });

  it("compares actual values rather than submitted keys", () => {
    expect(
      changedSourceFields({
        existing: ORDINARY_SOURCE,
        operation: "update",
        baseUrl: ORDINARY_SOURCE.baseUrl,
        trustLevel: "MEDIUM",
      }),
    ).toEqual([]);
    expect(
      authorizeSourceMutation(MODERATOR, {
        existing: ORDINARY_SOURCE,
        operation: "update",
        baseUrl: ORDINARY_SOURCE.baseUrl,
        trustLevel: "MEDIUM",
        autoPublish: false,
      }),
    ).toEqual({ ok: true });
  });

  it("denies non-admin lifecycle and sync actions on privileged sources", () => {
    for (const actor of [MODERATOR, API_KEY_SOURCE_ACTOR]) {
      for (const operation of ["activate", "deactivate", "delete", "sync"] as const) {
        expect(
          authorizeSourceMutation(actor, {
            existing: PRIVILEGED_SOURCE,
            operation,
          }),
        ).toEqual({ ok: false, code: "FORBIDDEN" });
      }
      expect(
        authorizeSourceMutation(actor, {
          existing: FACEBOOK_SOURCE,
          operation: "sync",
        }),
      ).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(
        authorizeSourceMutation(actor, {
          existing: ORDINARY_SOURCE,
          operation: "activate",
        }),
      ).toEqual({ ok: true });
    }
  });

  it("restricts API-key updates to non-privileged configuration", () => {
    expect(
      authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
        existing: ORDINARY_SOURCE,
        operation: "update",
        name: "Renamed",
        baseUrl: "https://feeds.example.com/jobs",
        checkFrequencyMinutes: 30,
      }),
    ).toEqual({ ok: true });
    expect(
      authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
        existing: PRIVILEGED_SOURCE,
        operation: "update",
        baseUrl: "https://evil.example.com/feed",
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(
      authorizeSourceMutation(API_KEY_SOURCE_ACTOR, {
        existing: PRIVILEGED_SOURCE,
        operation: "update",
        trustLevel: "LOW",
      }),
    ).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});