export interface NormalizedSalary {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "HOURLY" | "DAILY" | "MONTHLY" | "YEARLY" | "OTHER" | null;
}

export interface NormalizedExperience {
  experienceMin: number | null;
  experienceMax: number | null;
}

export interface NormalizedJobInput {
  title: string;
  description: string;
  employmentType: string | null;
  salary: NormalizedSalary;
  experience: NormalizedExperience;
  locationSlug: string;
  applicationUrl: string | null;
  deadline: string | null;
}

export interface ContentHashInput {
  normalizedTitle: string;
  organizationId: string;
  locationId: string;
  normalizedDescription: string;
  deadline: string;
  applicationUrl: string;
}
