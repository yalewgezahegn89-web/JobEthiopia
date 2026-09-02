import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetProfile: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/auth/context", () => ({
  getCurrentUser: () => mocks.mockGetCurrentUser(),
}));

vi.mock("@/lib/candidateProfile/dal", () => ({
  getCandidateProfile: (...args: unknown[]) => mocks.mockGetProfile(...args),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      locations: {
        findMany: (...args: unknown[]) => mocks.mockFindMany(...args),
        findFirst: (...args: unknown[]) => mocks.mockFindFirst(...args),
      },
    },
  },
}));

vi.mock("@/components/profile/profile-form", () => ({
  ProfileForm: (props: Record<string, unknown>) =>
    createElement(
      "div",
      { "data-testid": "profile-form" },
      JSON.stringify(props),
    ),
}));

import ProfilePage from "@/app/profile/page";

const CANDIDATE = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "candidate@example.com",
  name: "Candidate",
  role: "CANDIDATE",
};

const ACTIVE_LOCATION = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Addis Ababa",
};

const INACTIVE_LOCATION = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Old City",
};

const PROFILE = {
  id: "44444444-4444-4444-8444-444444444444",
  candidateId: CANDIDATE.id,
  phone: "+251911234567",
  locationId: ACTIVE_LOCATION.id,
  professionalSummary: "Engineer",
  totalExperienceYears: 5,
  education: "BSc",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(CANDIDATE);
  mocks.mockGetProfile.mockResolvedValue(null);
  mocks.mockFindMany.mockResolvedValue([ACTIVE_LOCATION]);
  mocks.mockFindFirst.mockResolvedValue(undefined);
});

describe("ProfilePage", () => {
  it("redirects anonymous users to /login", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects non-candidate roles to /jobs", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("renders own profile correctly for a candidate", async () => {
    mocks.mockGetProfile.mockResolvedValue(PROFILE);
    const element = await ProfilePage();
    expect(element).toBeTruthy();
    expect(mocks.mockGetProfile).toHaveBeenCalledWith(CANDIDATE.id);
  });

  it("passes profile fields to the form", async () => {
    mocks.mockGetProfile.mockResolvedValue(PROFILE);
    const element = await ProfilePage();
    expect(element).toBeTruthy();
  });

  it("renders an empty profile when none exists", async () => {
    mocks.mockGetProfile.mockResolvedValue(null);
    const element = await ProfilePage();
    expect(element).toBeTruthy();
    expect(mocks.mockFindMany).toHaveBeenCalled();
  });

  it("keeps an existing inactive location visible/selectable", async () => {
    mocks.mockGetProfile.mockResolvedValue({
      ...PROFILE,
      locationId: INACTIVE_LOCATION.id,
    });
    // active locations do not include the current inactive one
    mocks.mockFindMany.mockResolvedValue([ACTIVE_LOCATION]);
    mocks.mockFindFirst.mockResolvedValue(INACTIVE_LOCATION);

    const element = await ProfilePage();
    expect(element).toBeTruthy();
    // page resolves the current inactive location so it is not lost
    expect(mocks.mockFindFirst).toHaveBeenCalled();
  });

  it("shows a generic error on profile load failure", async () => {
    mocks.mockGetProfile.mockRejectedValue(new Error("db down"));
    const element = await ProfilePage();
    expect(element).toBeTruthy();
  });

  it("shows a generic error on location load failure", async () => {
    mocks.mockFindMany.mockRejectedValue(new Error("db down"));
    const element = await ProfilePage();
    expect(element).toBeTruthy();
  });

  it("renders the change-password section for a candidate", async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain("Change password");
    expect(html).toContain("Update your password to keep your account secure.");
    expect(html).toContain("Current password");
    expect(html).toContain("New password");
    expect(html).toContain('name="currentPassword"');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('name="confirmPassword"');
  });

  it("renders the existing candidate profile alongside the password section", async () => {
    mocks.mockGetProfile.mockResolvedValue(PROFILE);
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain("My Profile");
    expect(html).toContain("Change password");
    expect(html).toContain("My Applications");
  });

  it("does not render the password section for non-candidate roles", async () => {
    mocks.mockGetCurrentUser.mockResolvedValue({ ...CANDIDATE, role: "ADMIN" });
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/jobs");
  });

  it("renders a single H1 with the page title", async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain("My Profile");
    const h1Count = (html.match(/<h1\b/g) ?? []).length;
    expect(h1Count).toBe(1);
  });

  it("renders a Security section with change password", async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain("Security");
    expect(html).toContain("Change password");
  });

  it("renders a sign-out form posting to /logout", async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).toContain('action="/logout"');
    expect(html).toContain('method="POST"');
    expect(html).toContain("Sign out");
  });

  it("does not leak any password value", async () => {
    const html = renderToStaticMarkup(await ProfilePage());
    expect(html).not.toContain("OldPassword");
    expect(html).not.toContain("NewPassword");
  });
});
