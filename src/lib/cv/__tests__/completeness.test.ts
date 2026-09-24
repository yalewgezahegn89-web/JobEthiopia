import { describe, it, expect } from "vitest";
import {
  evaluateCvReadiness,
  CV_READINESS_CHECKS,
  type CvReadinessSource,
} from "@/lib/cv/completeness";

function source(overrides: Partial<CvReadinessSource> = {}): CvReadinessSource {
  return {
    hasCv: false,
    cv: null,
    accountEmail: null,
    profile: null,
    ...overrides,
  };
}

function fullCv(overrides: {
  professionalSummary?: string | null;
  phone?: string | null;
  location?: string | null;
  experiences?: number;
  educations?: number;
  skills?: number;
  certifications?: number;
} = {}) {
  const {
    professionalSummary = "Experienced accountant with 6 years in audit.",
    phone = "+251911000000",
    location = "Addis Ababa",
    experiences = 1,
    educations = 1,
    skills = 3,
    certifications = 0,
  } = overrides;

  return {
    header: { phone, location, professionalSummary },
    experiences: { length: experiences },
    educations: { length: educations },
    skills: { length: skills },
    certifications: { length: certifications },
  };
}

describe("CV_READINESS_CHECKS", () => {
  it("lists the five scored checks plus unscored certifications", () => {
    expect([...CV_READINESS_CHECKS]).toEqual([
      "contact",
      "summary",
      "experience",
      "education",
      "skills",
      "certifications",
    ]);
  });
});

describe("evaluateCvReadiness", () => {
  it("returns 0% and all five scored keys missing when nothing is present", () => {
    const res = evaluateCvReadiness(source());
    expect(res.percent).toBe(0);
    expect(res.complete).toBe(false);
    expect(res.missing).toEqual(["contact", "summary", "experience", "education", "skills"]);
    expect(res.checks).toHaveLength(6);
    expect(res.checks.filter((c) => c.satisfied)).toHaveLength(0);
  });

  it("returns 100% and complete when all scored checks are met", () => {
    const res = evaluateCvReadiness(source({ hasCv: true, cv: fullCv() }));
    expect(res.percent).toBe(100);
    expect(res.complete).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it("does not penalize a CV without certifications (unscored check)", () => {
    const res = evaluateCvReadiness(
      source({ hasCv: true, cv: fullCv({ certifications: 0 }) }),
    );
    expect(res.percent).toBe(100);
    expect(res.complete).toBe(true);
    const certs = res.checks.find((c) => c.key === "certifications");
    expect(certs?.scored).toBe(false);
    expect(certs?.satisfied).toBe(false);
  });

  it("satisfies contact from the account email alone", () => {
    const res = evaluateCvReadiness(
      source({
        accountEmail: "candidate@example.com",
        hasCv: true,
        cv: fullCv({ phone: null, location: null }),
      }),
    );
    const contact = res.checks.find((c) => c.key === "contact");
    expect(contact?.satisfied).toBe(true);
  });

  it("satisfies contact from the profile phone alone", () => {
    const res = evaluateCvReadiness(
      source({ profile: { phone: "+251900000000" }, hasCv: true, cv: fullCv({ phone: null, location: null }) }),
    );
    expect(res.checks.find((c) => c.key === "contact")?.satisfied).toBe(true);
  });

  it("fails contact when every source is empty or whitespace", () => {
    const res = evaluateCvReadiness(
      source({
        accountEmail: "   ",
        hasCv: true,
        cv: fullCv({ phone: "", location: "  " }),
        profile: { phone: null },
      }),
    );
    expect(res.checks.find((c) => c.key === "contact")?.satisfied).toBe(false);
    expect(res.missing).toContain("contact");
  });

  it("fails summary when the professional summary is blank", () => {
    const res = evaluateCvReadiness(
      source({ hasCv: true, cv: fullCv({ professionalSummary: "  " }) }),
    );
    expect(res.missing).toContain("summary");
  });

  it("scores checks by weight (contact 15 / summary 20 / experience 25 / education 20 / skills 20)", () => {
    expect(evaluateCvReadiness(source({ accountEmail: "a@b.c" })).percent).toBe(15);
    expect(
      evaluateCvReadiness(
        source({
          accountEmail: "a@b.c",
          hasCv: true,
          cv: fullCv({
            phone: null,
            location: null,
            professionalSummary: "Summary",
            experiences: 0,
            educations: 0,
            skills: 0,
          }),
        }),
      ).percent,
    ).toBe(35);
    expect(
      evaluateCvReadiness(
        source({
          accountEmail: "a@b.c",
          hasCv: true,
          cv: fullCv({
            phone: null,
            location: null,
            professionalSummary: "Summary",
            experiences: 2,
            educations: 0,
            skills: 0,
          }),
        }),
      ).percent,
    ).toBe(60);
    expect(
      evaluateCvReadiness(
        source({
          accountEmail: "a@b.c",
          hasCv: true,
          cv: fullCv({
            phone: null,
            location: null,
            professionalSummary: "Summary",
            experiences: 2,
            educations: 1,
            skills: 0,
          }),
        }),
      ).percent,
    ).toBe(80);
    expect(
      evaluateCvReadiness(
        source({
          accountEmail: "a@b.c",
          hasCv: true,
          cv: fullCv({
            phone: null,
            location: null,
            professionalSummary: "Summary",
            experiences: 2,
            educations: 1,
            skills: 1,
          }),
        }),
      ).percent,
    ).toBe(100);
  });

  it("lists only unsatisfied scored keys in missing", () => {
    const res = evaluateCvReadiness(
      source({ hasCv: true, cv: fullCv({ professionalSummary: null, skills: 0 }) }),
    );
    expect(res.missing).toEqual(["summary", "skills"]);
    expect(res.complete).toBe(false);
  });

  it("is not complete when a single scored check is missing", () => {
    const res = evaluateCvReadiness(
      source({ hasCv: true, cv: fullCv({ skills: 0 }) }),
    );
    expect(res.complete).toBe(false);
    expect(res.percent).toBe(80);
    expect(res.missing).toEqual(["skills"]);
  });

  it("handles a CV header present but empty sections", () => {
    const res = evaluateCvReadiness(
      source({
        hasCv: true,
        cv: fullCv({ experiences: 0, educations: 0, skills: 0, certifications: 0 }),
      }),
    );
    expect(res.percent).toBe(35);
    expect(res.missing).toEqual(["experience", "education", "skills"]);
  });
});