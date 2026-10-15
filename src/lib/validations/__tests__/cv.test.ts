import { describe, it, expect } from "vitest";
import {
  cvHeaderSchema,
  cvSchema,
  parseCvPayload,
  isValidYearMonth,
  emptyToNull,
  CV_TITLE_MAX,
  CV_SUMMARY_MAX,
  CV_STRING_SHORT_MAX,
  CV_DESCRIPTION_MAX,
  CV_SKILL_NAME_MAX,
  CV_LEVEL_MAX,
  CV_LOCATION_MAX,
  CV_PHONE_MAX,
  CV_EXPERIENCES_MAX,
  CV_EDUCATIONS_MAX,
  CV_SKILLS_MAX,
  CV_CERTIFICATIONS_MAX,
} from "@/lib/validations/cv";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function validHeader(overrides: Record<string, unknown> = {}) {
  return {
    title: "Software Engineer",
    ...overrides,
  };
}

function validExperience(overrides: Record<string, unknown> = {}) {
  return {
    employer: "Acme Corp",
    role: "Developer",
    startMonth: "2020-01",
    ...overrides,
  };
}

function validEducation(overrides: Record<string, unknown> = {}) {
  return {
    institution: "Addis Ababa University",
    qualification: "BSc Computer Science",
    startMonth: "2016-09",
    ...overrides,
  };
}

function validSkill(overrides: Record<string, unknown> = {}) {
  return {
    name: "TypeScript",
    ...overrides,
  };
}

function validCertification(overrides: Record<string, unknown> = {}) {
  return {
    name: "AWS Solutions Architect",
    issuer: "Amazon Web Services",
    issuedMonth: "2023-06",
    ...overrides,
  };
}

function fullPayload(overrides: Record<string, unknown> = {}) {
  return {
    header: validHeader(),
    experiences: [validExperience()],
    educations: [validEducation()],
    skills: [validSkill()],
    certifications: [validCertification()],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

describe("CV constants", () => {
  it("exports correct limits", () => {
    expect(CV_TITLE_MAX).toBe(80);
    expect(CV_SUMMARY_MAX).toBe(2000);
    expect(CV_STRING_SHORT_MAX).toBe(120);
    expect(CV_DESCRIPTION_MAX).toBe(1000);
    expect(CV_SKILL_NAME_MAX).toBe(60);
    expect(CV_LEVEL_MAX).toBe(20);
    expect(CV_LOCATION_MAX).toBe(120);
    expect(CV_PHONE_MAX).toBe(20);
    expect(CV_EXPERIENCES_MAX).toBe(10);
    expect(CV_EDUCATIONS_MAX).toBe(10);
    expect(CV_SKILLS_MAX).toBe(15);
    expect(CV_CERTIFICATIONS_MAX).toBe(10);
  });
});

/* ------------------------------------------------------------------ */
/*  isValidYearMonth                                                  */
/* ------------------------------------------------------------------ */

describe("isValidYearMonth", () => {
  it("accepts valid months", () => {
    expect(isValidYearMonth("2020-01")).toBe(true);
    expect(isValidYearMonth("2020-12")).toBe(true);
    expect(isValidYearMonth("1900-01")).toBe(true);
    expect(isValidYearMonth("2099-12")).toBe(true);
  });

  it("rejects month 00", () => {
    expect(isValidYearMonth("2020-00")).toBe(false);
  });

  it("rejects month 13", () => {
    expect(isValidYearMonth("2020-13")).toBe(false);
  });

  it("rejects non-numeric month", () => {
    expect(isValidYearMonth("abc-def")).toBe(false);
  });

  it("rejects short year", () => {
    expect(isValidYearMonth("20-01")).toBe(false);
  });

  it("rejects year before 1900", () => {
    expect(isValidYearMonth("1899-12")).toBe(false);
  });

  it("rejects year after 2099", () => {
    expect(isValidYearMonth("2100-01")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidYearMonth("")).toBe(false);
  });

  it("rejects partial format", () => {
    expect(isValidYearMonth("2020-1")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  emptyToNull                                                       */
/* ------------------------------------------------------------------ */

describe("emptyToNull", () => {
  it("returns null for null", () => {
    expect(emptyToNull(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(emptyToNull(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(emptyToNull("   ")).toBeNull();
  });

  it("trims and returns non-empty string", () => {
    expect(emptyToNull("  hello  ")).toBe("hello");
  });

  it("returns the string unchanged when no whitespace", () => {
    expect(emptyToNull("value")).toBe("value");
  });
});

/* ------------------------------------------------------------------ */
/*  cvHeaderSchema                                                    */
/* ------------------------------------------------------------------ */

describe("cvHeaderSchema", () => {
  it("accepts minimal valid header", () => {
    const res = cvHeaderSchema.safeParse(validHeader());
    expect(res.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({
        professionalSummary: "Experienced engineer",
        phone: "+251911234567",
        location: "Addis Ababa",
        websiteUrl: "https://example.com",
      }),
    );
    expect(res.success).toBe(true);
  });

  it("requires title", () => {
    const res = cvHeaderSchema.safeParse({});
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toContain("title");
    }
  });

  it("rejects empty title", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ title: "" }));
    expect(res.success).toBe(false);
  });

  it("rejects title over max length", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ title: "a".repeat(CV_TITLE_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts title at max length", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ title: "a".repeat(CV_TITLE_MAX) }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects professionalSummary over max length", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ professionalSummary: "a".repeat(CV_SUMMARY_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts professionalSummary at max length", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ professionalSummary: "a".repeat(CV_SUMMARY_MAX) }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty professionalSummary to null", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ professionalSummary: "   " }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.professionalSummary).toBeNull();
  });

  it("maps empty phone to null", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ phone: "" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBeNull();
  });

  it("maps null phone to null", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ phone: null }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBeNull();
  });

  it("accepts valid phone", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ phone: "+251911234567" }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe("+251911234567");
  });

  it("rejects phone with letters", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ phone: "09112A4567" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects phone too short", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ phone: "123" }));
    expect(res.success).toBe(false);
  });

  it("accepts null location", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ location: null }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.location).toBeNull();
  });

  it("maps empty location to null", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ location: "   " }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.location).toBeNull();
  });

  it("rejects location over max length", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ location: "a".repeat(CV_LOCATION_MAX + 1) }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts valid websiteUrl", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ websiteUrl: "https://example.com" }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty websiteUrl to null", () => {
    const res = cvHeaderSchema.safeParse(validHeader({ websiteUrl: "" }));
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.websiteUrl).toBeNull();
  });

  it("rejects ftp URL for websiteUrl", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ websiteUrl: "ftp://example.com" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects javascript: URL for websiteUrl", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ websiteUrl: "javascript:alert(1)" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects URL without scheme for websiteUrl", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ websiteUrl: "example.com" }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields (strict mode)", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ extraField: "value" }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — experiences                                            */
/* ------------------------------------------------------------------ */

describe("cvSchema — experiences", () => {
  it("defaults experiences to empty array", () => {
    const res = cvSchema.safeParse({ header: validHeader() });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.experiences).toEqual([]);
  });

  it("accepts valid experience", () => {
    const res = cvSchema.safeParse(fullPayload());
    expect(res.success).toBe(true);
  });

  it("requires employer", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [{ role: "Developer", startMonth: "2020-01" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires role", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [{ employer: "Acme", startMonth: "2020-01" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [{ employer: "Acme", role: "Developer" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty employer", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ employer: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty role", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ role: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects employer over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ employer: "a".repeat(CV_STRING_SHORT_MAX + 1) }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects role over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ role: "a".repeat(CV_STRING_SHORT_MAX + 1) }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({
            location: "Addis Ababa",
            endMonth: "2023-06",
            description: "Built things",
          }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty location to null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ location: "  " })],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.experiences[0].location).toBeNull();
    }
  });

  it("maps empty description to null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ description: "  " })],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.experiences[0].description).toBeNull();
    }
  });

  it("rejects description over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({
            description: "a".repeat(CV_DESCRIPTION_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts description at max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({
            description: "a".repeat(CV_DESCRIPTION_MAX),
          }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects invalid startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ startMonth: "2020-13" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects endMonth before startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ startMonth: "2022-06", endMonth: "2020-01" }),
        ],
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("experiences.0.endMonth");
    }
  });

  it("accepts endMonth equal to startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ startMonth: "2022-06", endMonth: "2022-06" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts null endMonth (current role)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ startMonth: "2022-06", endMonth: null }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts empty endMonth string as null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ startMonth: "2022-06", endMonth: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.experiences[0].endMonth).toBeNull();
    }
  });

  it("rejects more than max experiences", () => {
    const items = Array.from({ length: CV_EXPERIENCES_MAX + 1 }, () =>
      validExperience(),
    );
    const res = cvSchema.safeParse(fullPayload({ experiences: items }));
    expect(res.success).toBe(false);
  });

  it("accepts exactly max experiences", () => {
    const items = Array.from({ length: CV_EXPERIENCES_MAX }, () =>
      validExperience(),
    );
    const res = cvSchema.safeParse(fullPayload({ experiences: items }));
    expect(res.success).toBe(true);
  });

  it("rejects blank rows (filtering happens in the action layer)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience(), {}],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields in experience (strict mode)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ extraField: "value" })],
      }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — educations                                             */
/* ------------------------------------------------------------------ */

describe("cvSchema — educations", () => {
  it("defaults educations to empty array", () => {
    const res = cvSchema.safeParse({ header: validHeader() });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.educations).toEqual([]);
  });

  it("accepts valid education", () => {
    const res = cvSchema.safeParse(fullPayload());
    expect(res.success).toBe(true);
  });

  it("requires institution", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [{ qualification: "BSc", startMonth: "2016-09" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires qualification", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [{ institution: "AAU", startMonth: "2016-09" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [{ institution: "AAU", qualification: "BSc" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty institution", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ institution: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty qualification", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ qualification: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects institution over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({
            institution: "a".repeat(CV_STRING_SHORT_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects qualification over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({
            qualification: "a".repeat(CV_STRING_SHORT_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts optional fieldOfStudy", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ fieldOfStudy: "Computer Science" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty fieldOfStudy to null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ fieldOfStudy: "  " })],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.educations[0].fieldOfStudy).toBeNull();
    }
  });

  it("rejects fieldOfStudy over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({
            fieldOfStudy: "a".repeat(CV_STRING_SHORT_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects invalid startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ startMonth: "2020-00" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects endMonth before startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ startMonth: "2020-09", endMonth: "2018-06" }),
        ],
      }),
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("educations.0.endMonth");
    }
  });

  it("accepts endMonth equal to startMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ startMonth: "2020-09", endMonth: "2020-09" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts null endMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ startMonth: "2020-09", endMonth: null }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts empty endMonth string as null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ startMonth: "2020-09", endMonth: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.educations[0].endMonth).toBeNull();
    }
  });

  it("rejects more than max educations", () => {
    const items = Array.from({ length: CV_EDUCATIONS_MAX + 1 }, () =>
      validEducation(),
    );
    const res = cvSchema.safeParse(fullPayload({ educations: items }));
    expect(res.success).toBe(false);
  });

  it("accepts exactly max educations", () => {
    const items = Array.from({ length: CV_EDUCATIONS_MAX }, () =>
      validEducation(),
    );
    const res = cvSchema.safeParse(fullPayload({ educations: items }));
    expect(res.success).toBe(true);
  });

  it("rejects blank rows (filtering happens in the action layer)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation(), {}],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields in education (strict mode)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ extraField: "value" })],
      }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — skills                                                 */
/* ------------------------------------------------------------------ */

describe("cvSchema — skills", () => {
  it("defaults skills to empty array", () => {
    const res = cvSchema.safeParse({ header: validHeader() });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.skills).toEqual([]);
  });

  it("accepts valid skill", () => {
    const res = cvSchema.safeParse(fullPayload());
    expect(res.success).toBe(true);
  });

  it("requires skill name", () => {
    const res = cvSchema.safeParse(
      fullPayload({ skills: [{}] }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty skill name", () => {
    const res = cvSchema.safeParse(
      fullPayload({ skills: [{ name: "" }] }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects skill name over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "a".repeat(CV_SKILL_NAME_MAX + 1) }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts skill name at max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "a".repeat(CV_SKILL_NAME_MAX) }],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts optional level", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "TypeScript", level: "Expert" }],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty level to null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "TypeScript", level: "  " }],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.skills[0].level).toBeNull();
    }
  });

  it("rejects level over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [
          { name: "TypeScript", level: "a".repeat(CV_LEVEL_MAX + 1) },
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts level at max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [
          { name: "TypeScript", level: "a".repeat(CV_LEVEL_MAX) },
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("rejects more than max skills", () => {
    const items = Array.from({ length: CV_SKILLS_MAX + 1 }, () =>
      validSkill(),
    );
    const res = cvSchema.safeParse(fullPayload({ skills: items }));
    expect(res.success).toBe(false);
  });

  it("accepts exactly max skills", () => {
    const items = Array.from({ length: CV_SKILLS_MAX }, () => validSkill());
    const res = cvSchema.safeParse(fullPayload({ skills: items }));
    expect(res.success).toBe(true);
  });

  it("rejects blank rows (filtering happens in the action layer)", () => {
    const res = cvSchema.safeParse(
      fullPayload({ skills: [validSkill(), {}] }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields in skill (strict mode)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "TypeScript", extraField: "value" }],
      }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — certifications                                         */
/* ------------------------------------------------------------------ */

describe("cvSchema — certifications", () => {
  it("defaults certifications to empty array", () => {
    const res = cvSchema.safeParse({ header: validHeader() });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.certifications).toEqual([]);
  });

  it("accepts valid certification", () => {
    const res = cvSchema.safeParse(fullPayload());
    expect(res.success).toBe(true);
  });

  it("requires certification name", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [{ issuer: "AWS", issuedMonth: "2023-06" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires issuer", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          { name: "AWS Architect", issuedMonth: "2023-06" },
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("requires issuedMonth", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [{ name: "AWS Architect", issuer: "AWS" }],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty name", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [validCertification({ name: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects empty issuer", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [validCertification({ issuer: "" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects name over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({
            name: "a".repeat(CV_STRING_SHORT_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects issuer over max length", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({
            issuer: "a".repeat(CV_STRING_SHORT_MAX + 1),
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("accepts valid credentialUrl", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({
            credentialUrl: "https://example.com/cert",
          }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("maps empty credentialUrl to null", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({ credentialUrl: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.certifications[0].credentialUrl).toBeNull();
    }
  });

  it("rejects ftp credentialUrl", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({
            credentialUrl: "ftp://example.com/cert",
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects javascript: credentialUrl", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({
            credentialUrl: "javascript:alert(1)",
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects more than max certifications", () => {
    const items = Array.from({ length: CV_CERTIFICATIONS_MAX + 1 }, () =>
      validCertification(),
    );
    const res = cvSchema.safeParse(fullPayload({ certifications: items }));
    expect(res.success).toBe(false);
  });

  it("accepts exactly max certifications", () => {
    const items = Array.from({ length: CV_CERTIFICATIONS_MAX }, () =>
      validCertification(),
    );
    const res = cvSchema.safeParse(fullPayload({ certifications: items }));
    expect(res.success).toBe(true);
  });

  it("rejects blank rows (filtering happens in the action layer)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [validCertification(), {}],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects unknown fields in certification (strict mode)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({ extraField: "value" }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — invalid months                                         */
/* ------------------------------------------------------------------ */

describe("cvSchema — invalid months", () => {
  it("rejects month 13", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ startMonth: "2020-13" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects month 00", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ startMonth: "2020-00" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects non-numeric month (abc-def)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ startMonth: "abc-def" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects year after max (2100-01)", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [validExperience({ startMonth: "2100-01" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects endMonth 2020-13", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({
            startMonth: "2020-01",
            endMonth: "2020-13",
          }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects education startMonth abc-def", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [validEducation({ startMonth: "abc-def" })],
      }),
    );
    expect(res.success).toBe(false);
  });

  it("rejects certification issuedMonth 2020-00", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({ issuedMonth: "2020-00" }),
        ],
      }),
    );
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — empty optional fields normalize to null                */
/* ------------------------------------------------------------------ */

describe("cvSchema — empty optional fields normalize to null", () => {
  it("normalizes all optional string fields in header", () => {
    const res = cvSchema.safeParse({
      header: {
        title: "Engineer",
        professionalSummary: "  ",
        phone: "",
        location: "  ",
        websiteUrl: "",
      },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.header.professionalSummary).toBeNull();
      expect(res.data.header.phone).toBeNull();
      expect(res.data.header.location).toBeNull();
      expect(res.data.header.websiteUrl).toBeNull();
    }
  });

  it("normalizes optional fields in experience", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ location: "  ", description: "  ", endMonth: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.experiences[0].location).toBeNull();
      expect(res.data.experiences[0].description).toBeNull();
      expect(res.data.experiences[0].endMonth).toBeNull();
    }
  });

  it("normalizes optional fields in education", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({ fieldOfStudy: "  ", endMonth: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.educations[0].fieldOfStudy).toBeNull();
      expect(res.data.educations[0].endMonth).toBeNull();
    }
  });

  it("normalizes optional fields in skill", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "Go", level: "  " }],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.skills[0].level).toBeNull();
    }
  });

  it("normalizes optional fields in certification", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({ credentialUrl: "" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.certifications[0].credentialUrl).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — Unicode / Amharic / Oromo / mixed text                 */
/* ------------------------------------------------------------------ */

describe("cvSchema — Unicode and Amharic/Oromo text", () => {
  it("accepts Amharic title", () => {
    const res = cvSchema.safeParse({
      header: { title: "ሶፍትዌር ኢንጅነር" },
    });
    expect(res.success).toBe(true);
  });

  it("accepts Afaan Oromo title", () => {
    const res = cvSchema.safeParse({
      header: { title: "Injiniirii Software" },
    });
    expect(res.success).toBe(true);
  });

  it("accepts mixed script professionalSummary", () => {
    const res = cvSchema.safeParse({
      header: {
        title: "Engineer",
        professionalSummary:
          "ት.localization — ትምህርት — Oromiffatext — 中文",
      },
    });
    expect(res.success).toBe(true);
  });

  it("accepts Amharic employer", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ employer: "አዲስ አበባ ቢሮ", role: "veloper" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts Amharic institution", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        educations: [
          validEducation({
            institution: "የኢትዮጵያ ዩኒቨርሲቲ",
            qualification: "ሳይንስ",
          }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts Amharic skill name", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        skills: [{ name: "ፒ.InnerText" }],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts Amharic certification name", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        certifications: [
          validCertification({ name: "የሶፍትዌር ማረጋገጫ" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });

  it("accepts Amharic location", () => {
    const res = cvSchema.safeParse({
      header: { title: "Engineer", location: "አዲስ አበባ" },
    });
    expect(res.success).toBe(true);
  });

  it("accepts Amharic experience description", () => {
    const res = cvSchema.safeParse(
      fullPayload({
        experiences: [
          validExperience({ description: " =>' ሥራ ተውን አድርጋለሁ" }),
        ],
      }),
    );
    expect(res.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — valid full payload                                     */
/* ------------------------------------------------------------------ */

describe("cvSchema — valid full payload", () => {
  it("accepts a complete CV with all sections", () => {
    const res = cvSchema.safeParse({
      header: {
        title: "Senior Software Engineer",
        professionalSummary: "10+ years building scalable systems",
        phone: "+251911234567",
        location: "Addis Ababa",
        websiteUrl: "https://example.com",
      },
      experiences: [
        {
          employer: "EthioTech",
          role: "Lead Engineer",
          location: "Addis Ababa",
          startMonth: "2020-01",
          endMonth: null,
          description: "Led a team of 5 engineers",
        },
        {
          employer: "GlobalSoft",
          role: "Developer",
          startMonth: "2016-03",
          endMonth: "2019-12",
        },
      ],
      educations: [
        {
          institution: "Addis Ababa University",
          qualification: "BSc Computer Science",
          fieldOfStudy: "Software Engineering",
          startMonth: "2012-09",
          endMonth: "2016-06",
        },
      ],
      skills: [
        { name: "TypeScript", level: "Expert" },
        { name: "Python", level: "Advanced" },
      ],
      certifications: [
        {
          name: "AWS Solutions Architect",
          issuer: "Amazon Web Services",
          issuedMonth: "2023-06",
          credentialUrl: "https://aws.example.com/cert",
        },
      ],
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.header.title).toBe("Senior Software Engineer");
      expect(res.data.experiences).toHaveLength(2);
      expect(res.data.educations).toHaveLength(1);
      expect(res.data.skills).toHaveLength(2);
      expect(res.data.certifications).toHaveLength(1);
    }
  });

  it("accepts empty optional fields at root level", () => {
    const res = cvSchema.safeParse({
      header: { title: "Engineer" },
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.experiences).toEqual([]);
      expect(res.data.educations).toEqual([]);
      expect(res.data.skills).toEqual([]);
      expect(res.data.certifications).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  cvSchema — strict mode (unknown root fields)                      */
/* ------------------------------------------------------------------ */

describe("cvSchema — strict mode", () => {
  it("rejects unknown root fields", () => {
    const res = cvSchema.safeParse({
      header: validHeader(),
      extraField: "value",
    });
    expect(res.success).toBe(false);
  });

  it("rejects unknown header fields", () => {
    const res = cvSchema.safeParse({
      header: { title: "Engineer", forged: true },
    });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  parseCvPayload                                                    */
/* ------------------------------------------------------------------ */

describe("parseCvPayload", () => {
  it("returns success for valid payload", () => {
    const res = parseCvPayload(fullPayload());
    expect(res.success).toBe(true);
  });

  it("returns failure for invalid payload", () => {
    const res = parseCvPayload({});
    expect(res.success).toBe(false);
  });

  it("returns failure for missing header", () => {
    const res = parseCvPayload({ experiences: [] });
    expect(res.success).toBe(false);
  });

  it("returns parsed data for valid payload", () => {
    const res = parseCvPayload(fullPayload());
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.header.title).toBe("Software Engineer");
    }
  });
});

/* ------------------------------------------------------------------ */
/*  CV phone within header                                             */
/* ------------------------------------------------------------------ */

describe("cvHeaderSchema — phone normalization", () => {
  it("normalizes phone spacing", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ phone: "+251 911 234 567" }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe("+251911234567");
  });

  it("normalizes phone dashes", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ phone: "+251-911-234-567" }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe("+251911234567");
  });

  it("normalizes phone dots", () => {
    const res = cvHeaderSchema.safeParse(
      validHeader({ phone: "+251.911.234.567" }),
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.phone).toBe("+251911234567");
  });
});
