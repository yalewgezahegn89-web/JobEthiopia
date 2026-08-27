import type {
  NormalizedSalary,
  NormalizedExperience,
} from "./types";

export function normalizeTitle(title: string): string {
  let result = title;
  result = result.replace(/\s+/g, " ");
  result = result.trim();
  result = result.replace(/^[\-|,]+/, "");
  result = result.replace(/[\-|,]+$/, "");
  result = result.trim();
  return result;
}

export function normalizeOrganization(name: string): string {
  let result = name;
  result = result.replace(/\s+/g, " ");
  result = result.trim();
  return result;
}

export function normalizeDescription(description: string): string {
  let result = description;
  result = result.replace(/<[^>]*>/g, " ");
  result = result.replace(/\s+/g, " ");
  result = result.trim();
  if (result.length > 10000) {
    result = result.substring(0, 10000).trim();
  }
  return result;
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  "full-time": "FULL_TIME",
  "full time": "FULL_TIME",
  fulltime: "FULL_TIME",
  full_time: "FULL_TIME",
  "part-time": "PART_TIME",
  "part time": "PART_TIME",
  parttime: "PART_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACT",
  temporary: "TEMPORARY",
  temp: "TEMPORARY",
  internship: "INTERNSHIP",
  intern: "INTERNSHIP",
  volunteer: "VOLUNTEER",
  freelancing: "FREELANCE",
  freelance: "FREELANCE",
  other: "OTHER",
};

export function normalizeEmploymentType(input: string | null): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  const mapped = EMPLOYMENT_TYPE_MAP[normalized];
  return mapped ?? "OTHER";
}

const SALARY_PERIOD_MAP: Record<string, NormalizedSalary["salaryPeriod"]> = {
  hour: "HOURLY",
  hourly: "HOURLY",
  day: "DAILY",
  daily: "DAILY",
  week: "MONTHLY",
  weekly: "MONTHLY",
  month: "MONTHLY",
  monthly: "MONTHLY",
  year: "YEARLY",
  yearly: "YEARLY",
  annual: "YEARLY",
  annually: "YEARLY",
  "per annum": "YEARLY",
  "per year": "YEARLY",
};

export function normalizeSalary(input: string | null): NormalizedSalary {
  if (!input) {
    return {
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
    };
  }

  let text = input.trim();

  let currency: string | null = null;
  const currencyMatch = text.match(
    /^(ETB|USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR)\s*/i,
  );
  if (currencyMatch) {
    currency = currencyMatch[1].toUpperCase();
    text = text.substring(currencyMatch[0].length);
  }

  let period: NormalizedSalary["salaryPeriod"] = null;
  for (const [key, value] of Object.entries(SALARY_PERIOD_MAP)) {
    if (text.toLowerCase().includes(key)) {
      period = value;
      break;
    }
  }

  text = text.replace(/[^\d.\-–,\s]/g, " ");
  text = text.replace(/,/g, "");

  const rangeMatch = text.match(
    /(\d+(?:\.\d+)?)\s*[\-–]+\s*(\d+(?:\.\d+)?)/,
  );
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return {
      salaryMin: min,
      salaryMax: max,
      salaryCurrency: currency ?? "ETB",
      salaryPeriod: period,
    };
  }

  const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1]);
    return {
      salaryMin: value,
      salaryMax: null,
      salaryCurrency: currency ?? "ETB",
      salaryPeriod: period,
    };
  }

  return {
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: currency,
    salaryPeriod: period,
  };
}

export function normalizeExperience(input: string | null): NormalizedExperience {
  if (!input) {
    return { experienceMin: null, experienceMax: null };
  }

  const text = input.trim().toLowerCase();

  if (
    text.includes("fresh graduate") ||
    text.includes("freshman") ||
    text.includes("no experience") ||
    text === "entry level" ||
    text === "entry-level"
  ) {
    return { experienceMin: 0, experienceMax: 0 };
  }

  const rangeMatch = text.match(/(\d+)\s*(?:[\-–]+|to)\s*(\d+)/);
  if (rangeMatch) {
    return {
      experienceMin: parseInt(rangeMatch[1], 10),
      experienceMax: parseInt(rangeMatch[2], 10),
    };
  }

  const plusMatch = text.match(/(\d+)\s*\+\s*(?:years?|yrs?)/);
  if (plusMatch) {
    return {
      experienceMin: parseInt(plusMatch[1], 10),
      experienceMax: null,
    };
  }

  const singleMatch = text.match(/(\d+)/);
  if (singleMatch) {
    const value = parseInt(singleMatch[1], 10);
    return { experienceMin: value, experienceMax: value };
  }

  return { experienceMin: null, experienceMax: null };
}

export function normalizeLocation(input: string | null): string | null {
  if (!input) return null;
  let result = input.trim();
  result = result.replace(/\s+/g, " ");
  result = result
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return result || null;
}
