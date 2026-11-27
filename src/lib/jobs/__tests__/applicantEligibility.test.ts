import { describe, it, expect } from "vitest";
import {
  APPLICANT_ELIGIBILITY_VALUES,
  DEFAULT_APPLICANT_ELIGIBILITY,
  applicantEligibilityLabel,
  classifyApplicantEligibility,
  isApplicantEligibility,
  isDeadlineExpired,
  normalizeApplicantEligibility,
} from "../applicantEligibility";

describe("applicant eligibility", () => {
  it("defaults to NOT_STATED and never infers from a location", () => {
    expect(classifyApplicantEligibility()).toBe("NOT_STATED");
    expect(classifyApplicantEligibility(null, undefined, "")).toBe(
      "NOT_STATED",
    );
    expect(classifyApplicantEligibility("Addis Ababa, Ethiopia")).toBe(
      "NOT_STATED",
    );
    expect(
      classifyApplicantEligibility("Ethiopian Airlines is headquartered here"),
    ).toBe("NOT_STATED");
  });

  it("detects an explicit Ethiopian-applicant statement", () => {
    expect(
      classifyApplicantEligibility("Open to Ethiopian applicants"),
    ).toBe("ETHIOPIAN_APPLICANTS_CONFIRMED");
    expect(
      classifyApplicantEligibility("We are hiring Ethiopian nationals"),
    ).toBe("ETHIOPIAN_APPLICANTS_CONFIRMED");
  });

  it("detects international eligibility", () => {
    expect(
      classifyApplicantEligibility("International applicants are welcome"),
    ).toBe("INTERNATIONAL_APPLICANTS_ACCEPTED");
    expect(
      classifyApplicantEligibility("Applicants from all countries may apply"),
    ).toBe("INTERNATIONAL_APPLICANTS_ACCEPTED");
  });

  it("detects local work-authorization requirements", () => {
    expect(
      classifyApplicantEligibility("Candidates must be authorized to work"),
    ).toBe("LOCAL_WORK_AUTHORIZATION_REQUIRED");
    expect(
      classifyApplicantEligibility("A valid work permit is required"),
    ).toBe("LOCAL_WORK_AUTHORIZATION_REQUIRED");
  });

  it("detects citizenship restrictions and prioritises them", () => {
    expect(
      classifyApplicantEligibility("Citizenship is required"),
    ).toBe("CITIZENSHIP_RESTRICTED");
    expect(
      classifyApplicantEligibility(
        "Open to Ethiopian nationals. Citizenship required.",
      ),
    ).toBe("CITIZENSHIP_RESTRICTED");
  });

  it("checks values and normalises unknown input conservatively", () => {
    for (const value of APPLICANT_ELIGIBILITY_VALUES) {
      expect(isApplicantEligibility(value)).toBe(true);
      expect(normalizeApplicantEligibility(value)).toBe(value);
    }
    expect(isApplicantEligibility("ETHIOPIAN")).toBe(false);
    expect(normalizeApplicantEligibility("ETHIOPIAN")).toBe(
      DEFAULT_APPLICANT_ELIGIBILITY,
    );
    expect(normalizeApplicantEligibility(null)).toBe("NOT_STATED");
  });

  it("labels eligibility in English", () => {
    expect(applicantEligibilityLabel("NOT_STATED", "en")).toBe(
      "Eligibility not stated by the employer",
    );
    expect(applicantEligibilityLabel("CITIZENSHIP_RESTRICTED", "en")).toBe(
      "Citizenship restricted",
    );
  });
});

describe("isDeadlineExpired", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("treats a missing or invalid deadline as not expired", () => {
    expect(isDeadlineExpired(null, now)).toBe(false);
    expect(isDeadlineExpired(undefined, now)).toBe(false);
    expect(isDeadlineExpired("not-a-date", now)).toBe(false);
  });

  it("detects past and future deadlines", () => {
    expect(isDeadlineExpired("2026-05-31T23:59:59.000Z", now)).toBe(true);
    expect(isDeadlineExpired("2026-06-02T00:00:00.000Z", now)).toBe(false);
  });

  it("treats the exact deadline instant as expired", () => {
    expect(isDeadlineExpired(now, now)).toBe(true);
  });
});
