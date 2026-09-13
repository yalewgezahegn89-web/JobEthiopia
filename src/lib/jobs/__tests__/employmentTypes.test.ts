import { describe, it, expect } from "vitest";
import { employmentTypeEnum } from "@/db/schema/enums";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  formatEmploymentType,
} from "../employmentTypes";

describe("EMPLOYMENT_TYPE_OPTIONS", () => {
  it("matches the authoritative DB enum exactly", () => {
    expect(EMPLOYMENT_TYPE_OPTIONS).toEqual(employmentTypeEnum.enumValues);
  });

  it("covers every known employment type", () => {
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("FULL_TIME");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("PART_TIME");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("CONTRACT");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("TEMPORARY");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("INTERNSHIP");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("VOLUNTEER");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("FREELANCE");
    expect(EMPLOYMENT_TYPE_OPTIONS).toContain("OTHER");
  });
});

describe("formatEmploymentType", () => {
  it("presents underscores as spaces", () => {
    expect(formatEmploymentType("FULL_TIME")).toBe("FULL TIME");
  });

  it("leaves single-word values untouched", () => {
    expect(formatEmploymentType("CONTRACT")).toBe("CONTRACT");
  });
});