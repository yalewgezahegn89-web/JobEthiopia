import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  normalizeOrganization,
  normalizeDescription,
  normalizeEmploymentType,
  normalizeSalary,
  normalizeExperience,
  normalizeLocation,
} from "../index";

describe("normalizeTitle", () => {
  it("collapses multiple whitespace into single space", () => {
    expect(normalizeTitle("  Senior   Developer  ")).toBe("Senior Developer");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeTitle("  Nurse  ")).toBe("Nurse");
  });

  it("removes leading punctuation (pipes, commas, hyphens)", () => {
    expect(normalizeTitle("--- Senior Developer")).toBe("Senior Developer");
    expect(normalizeTitle("| Nurse")).toBe("Nurse");
    expect(normalizeTitle(", Doctor")).toBe("Doctor");
  });

  it("removes trailing punctuation (pipes, commas, hyphens)", () => {
    expect(normalizeTitle("Senior Developer---")).toBe("Senior Developer");
    expect(normalizeTitle("Nurse|")).toBe("Nurse");
    expect(normalizeTitle("Doctor,")).toBe("Doctor");
  });

  it("removes both leading and trailing punctuation", () => {
    expect(normalizeTitle("--- Senior Developer---")).toBe("Senior Developer");
  });

  it("preserves internal punctuation", () => {
    expect(normalizeTitle("C++ Developer")).toBe("C++ Developer");
    expect(normalizeTitle("Node.js Engineer")).toBe("Node.js Engineer");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles only whitespace", () => {
    expect(normalizeTitle("   ")).toBe("");
  });

  it("handles only punctuation", () => {
    expect(normalizeTitle("---")).toBe("");
  });

  it("is idempotent", () => {
    const input = "  Senior   Developer  ";
    const first = normalizeTitle(input);
    const second = normalizeTitle(first);
    expect(first).toBe(second);
  });
});

describe("normalizeOrganization", () => {
  it("collapses multiple whitespace into single space", () => {
    expect(normalizeOrganization("  Black   Lion   Hospital  ")).toBe(
      "Black Lion Hospital",
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeOrganization("  Ethiopian Airlines  ")).toBe(
      "Ethiopian Airlines",
    );
  });

  it("preserves original casing", () => {
    expect(normalizeOrganization("WHO")).toBe("WHO");
    expect(normalizeOrganization("world bank")).toBe("world bank");
  });

  it("handles empty string", () => {
    expect(normalizeOrganization("")).toBe("");
  });

  it("handles only whitespace", () => {
    expect(normalizeOrganization("   ")).toBe("");
  });

  it("is idempotent", () => {
    const input = "  Black   Lion   Hospital  ";
    const first = normalizeOrganization(input);
    const second = normalizeOrganization(first);
    expect(first).toBe(second);
  });
});

describe("normalizeDescription", () => {
  it("strips HTML tags", () => {
    expect(normalizeDescription("<p>Hello</p>")).toBe("Hello");
    expect(normalizeDescription("<b>Bold</b> text")).toBe("Bold text");
  });

  it("collapses whitespace after tag removal", () => {
    expect(normalizeDescription("<p>Hello</p>  <p>World</p>")).toBe(
      "Hello World",
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeDescription("  Hello  ")).toBe("Hello");
  });

  it("truncates to 10000 characters", () => {
    const long = "a".repeat(15000);
    const result = normalizeDescription(long);
    expect(result.length).toBeLessThanOrEqual(10000);
  });

  it("handles empty string", () => {
    expect(normalizeDescription("")).toBe("");
  });

  it("handles nested HTML tags", () => {
    expect(
      normalizeDescription("<div><span>Hello</span> <b>World</b></div>"),
    ).toBe("Hello World");
  });

  it("is idempotent for plain text", () => {
    const input = "Hello World";
    const first = normalizeDescription(input);
    const second = normalizeDescription(first);
    expect(first).toBe(second);
  });
});

describe("normalizeEmploymentType", () => {
  it("returns null for null input", () => {
    expect(normalizeEmploymentType(null)).toBeNull();
  });

  it("maps full-time variants", () => {
    expect(normalizeEmploymentType("full-time")).toBe("FULL_TIME");
    expect(normalizeEmploymentType("full time")).toBe("FULL_TIME");
    expect(normalizeEmploymentType("fulltime")).toBe("FULL_TIME");
    expect(normalizeEmploymentType("full_time")).toBe("FULL_TIME");
  });

  it("maps part-time variants", () => {
    expect(normalizeEmploymentType("part-time")).toBe("PART_TIME");
    expect(normalizeEmploymentType("part time")).toBe("PART_TIME");
    expect(normalizeEmploymentType("parttime")).toBe("PART_TIME");
    expect(normalizeEmploymentType("part_time")).toBe("PART_TIME");
  });

  it("maps direct matches", () => {
    expect(normalizeEmploymentType("contract")).toBe("CONTRACT");
    expect(normalizeEmploymentType("temporary")).toBe("TEMPORARY");
    expect(normalizeEmploymentType("temp")).toBe("TEMPORARY");
    expect(normalizeEmploymentType("internship")).toBe("INTERNSHIP");
    expect(normalizeEmploymentType("intern")).toBe("INTERNSHIP");
    expect(normalizeEmploymentType("volunteer")).toBe("VOLUNTEER");
    expect(normalizeEmploymentType("freelancing")).toBe("FREELANCE");
    expect(normalizeEmploymentType("freelance")).toBe("FREELANCE");
    expect(normalizeEmploymentType("other")).toBe("OTHER");
  });

  it("is case-insensitive", () => {
    expect(normalizeEmploymentType("Full-Time")).toBe("FULL_TIME");
    expect(normalizeEmploymentType("CONTRACT")).toBe("CONTRACT");
  });

  it("trims whitespace", () => {
    expect(normalizeEmploymentType("  full-time  ")).toBe("FULL_TIME");
  });

  it("returns OTHER for unknown types", () => {
    expect(normalizeEmploymentType("permanent")).toBe("OTHER");
    expect(normalizeEmploymentType("seasonal")).toBe("OTHER");
  });
});

describe("normalizeSalary", () => {
  it("returns null fields for null input", () => {
    const result = normalizeSalary(null);
    expect(result).toEqual({
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    });
  });

  it("parses currency prefix ETB", () => {
    const result = normalizeSalary("ETB 5000-8000");
    expect(result.salaryCurrency).toBe("ETB");
    expect(result.salaryMin).toBe(5000);
    expect(result.salaryMax).toBe(8000);
  });

  it("parses currency prefix USD", () => {
    const result = normalizeSalary("USD 1000-2000 monthly");
    expect(result.salaryCurrency).toBe("USD");
    expect(result.salaryMin).toBe(1000);
    expect(result.salaryMax).toBe(2000);
    expect(result.salaryPeriod).toBe("MONTHLY");
  });

  it("parses salary range with hyphen", () => {
    const result = normalizeSalary("5000-8000");
    expect(result.salaryMin).toBe(5000);
    expect(result.salaryMax).toBe(8000);
  });

  it("parses salary range with en-dash", () => {
    const result = normalizeSalary("5000–8000");
    expect(result.salaryMin).toBe(5000);
    expect(result.salaryMax).toBe(8000);
  });

  it("parses single salary value", () => {
    const result = normalizeSalary("5000");
    expect(result.salaryMin).toBe(5000);
    expect(result.salaryMax).toBeNull();
  });

  it("parses salary with commas", () => {
    const result = normalizeSalary("5,000-8,000");
    expect(result.salaryMin).toBe(5000);
    expect(result.salaryMax).toBe(8000);
  });

  it("parses salary period", () => {
    expect(normalizeSalary("5000 monthly").salaryPeriod).toBe("MONTHLY");
    expect(normalizeSalary("5000 yearly").salaryPeriod).toBe("YEARLY");
    expect(normalizeSalary("5000 hourly").salaryPeriod).toBe("HOURLY");
    expect(normalizeSalary("5000 daily").salaryPeriod).toBe("DAILY");
  });

  it("parses salary with decimal values", () => {
    const result = normalizeSalary("50.50-100.75");
    expect(result.salaryMin).toBe(50.5);
    expect(result.salaryMax).toBe(100.75);
  });

  it("defaults currency to ETB when no currency specified", () => {
    const result = normalizeSalary("5000");
    expect(result.salaryCurrency).toBe("ETB");
  });

  it("returns null fields for non-numeric input", () => {
    const result = normalizeSalary("no salary info");
    expect(result.salaryMin).toBeNull();
    expect(result.salaryMax).toBeNull();
  });

  it("parses complex salary string", () => {
    const result = normalizeSalary("ETB 10,000-15,000 per month");
    expect(result.salaryCurrency).toBe("ETB");
    expect(result.salaryMin).toBe(10000);
    expect(result.salaryMax).toBe(15000);
    expect(result.salaryPeriod).toBe("MONTHLY");
  });
});

describe("normalizeExperience", () => {
  it("returns null fields for null input", () => {
    const result = normalizeExperience(null);
    expect(result).toEqual({
      experienceMin: null,
      experienceMax: null,
    });
  });

  it("parses range with hyphen", () => {
    const result = normalizeExperience("3-5 years");
    expect(result.experienceMin).toBe(3);
    expect(result.experienceMax).toBe(5);
  });

  it("parses range with en-dash", () => {
    const result = normalizeExperience("3–5 years");
    expect(result.experienceMin).toBe(3);
    expect(result.experienceMax).toBe(5);
  });

  it("parses range with 'to'", () => {
    const result = normalizeExperience("3 to 5 years");
    expect(result.experienceMin).toBe(3);
    expect(result.experienceMax).toBe(5);
  });

  it("parses 'X+' format", () => {
    const result = normalizeExperience("5+ years");
    expect(result.experienceMin).toBe(5);
    expect(result.experienceMax).toBeNull();
  });

  it("parses single value", () => {
    const result = normalizeExperience("3 years");
    expect(result.experienceMin).toBe(3);
    expect(result.experienceMax).toBe(3);
  });

  it("handles fresh graduate", () => {
    expect(normalizeExperience("fresh graduate")).toEqual({
      experienceMin: 0,
      experienceMax: 0,
    });
    expect(normalizeExperience("freshman")).toEqual({
      experienceMin: 0,
      experienceMax: 0,
    });
    expect(normalizeExperience("no experience")).toEqual({
      experienceMin: 0,
      experienceMax: 0,
    });
  });

  it("handles entry level", () => {
    expect(normalizeExperience("entry level")).toEqual({
      experienceMin: 0,
      experienceMax: 0,
    });
    expect(normalizeExperience("entry-level")).toEqual({
      experienceMin: 0,
      experienceMax: 0,
    });
  });

  it("is case-insensitive", () => {
    const result = normalizeExperience("3-5 YEARS");
    expect(result.experienceMin).toBe(3);
    expect(result.experienceMax).toBe(5);
  });

  it("returns null fields for non-numeric input", () => {
    const result = normalizeExperience("experienced professional");
    expect(result.experienceMin).toBeNull();
    expect(result.experienceMax).toBeNull();
  });

  it("parses 'yrs' abbreviation", () => {
    const result = normalizeExperience("5+ yrs");
    expect(result.experienceMin).toBe(5);
    expect(result.experienceMax).toBeNull();
  });
});

describe("normalizeLocation", () => {
  it("returns null for null input", () => {
    expect(normalizeLocation(null)).toBeNull();
  });

  it("converts to lowercase slug", () => {
    expect(normalizeLocation("Addis Ababa")).toBe("addis-ababa");
  });

  it("trims whitespace", () => {
    expect(normalizeLocation("  Addis Ababa  ")).toBe("addis-ababa");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeLocation("Addis   Ababa")).toBe("addis-ababa");
  });

  it("removes special characters", () => {
    expect(normalizeLocation("Addis Ababa!")).toBe("addis-ababa");
    expect(normalizeLocation("Addis Ababa @#$")).toBe("addis-ababa");
  });

  it("collapses multiple hyphens", () => {
    expect(normalizeLocation("Addis---Ababa")).toBe("addis-ababa");
  });

  it("removes leading and trailing hyphens", () => {
    expect(normalizeLocation("-Addis Ababa-")).toBe("addis-ababa");
  });

  it("returns null for empty result", () => {
    expect(normalizeLocation("!!!")).toBeNull();
  });

  it("preserves numbers", () => {
    expect(normalizeLocation("Zone 1")).toBe("zone-1");
  });

  it("is idempotent", () => {
    const input = "Addis Ababa";
    const first = normalizeLocation(input);
    const second = normalizeLocation(first);
    expect(first).toBe(second);
  });
});
