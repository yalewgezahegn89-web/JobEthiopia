/**
 * Phase 6 Step 7 — FIRST REAL, VERIFIED VACANCIES (DEV-ONLY inventory).
 *
 * These are the real vacancies already verified from official employer
 * sources (UNICEF and UNFPA career pages). Every field was transcribed from
 * the official posting; nothing here is invented.
 *
 * This fixture is NOT written to any database by this module: it feeds the
 * automated safety tests in `src/lib/admin/__tests__/verifiedVacancies.test.ts`
 * and serves as the verified, staff-facing record to enter through the admin
 * "Create Curated Job" UI (createCuratedJobAction -> createCuratedJob).
 *
 * To populate on any environment:
 *  1. Ensure taxonomy exists and is ACTIVE (repeat hooks for the taxonomy that
 *     Step 6 added to the seed): categories healthcare, operations-
 *     administration, finance-economics, transport-logistics; professions
 *     nutrition, operations, public-finance-economic-policy, driver;
 *     locations hawassa, semera, addis-ababa, konso.
 *  2. Ensure the two organizations (UNICEF, UNFPA) exist and are ACTIVE
 *     (admin organizations UI).
 *  3. Enter each record through the create-curated-job form. Provide the
 *     official vacancy URL and employer reference in the "Original vacancy
 *     source" section so both the external source and the internal data-entry
 *     method are preserved.
 *  4. Review each job in moderation and publish. Entries must be made before
 *     their deadline; these fixtures are only valid while the postings are
 *     actually open on the official sites.
 *
 * Deadlines are stored as exact instants. The UNICEF pages publish them as
 * "11:55 PM E. Africa Standard Time (UTC+3)" and the UNFPA page as "21
 * September 2026 02:12 (America/New_York)".
 */

import {
  UNICEF_CAREERS_SOURCE_NAME,
  UNFPA_CAREERS_SOURCE_NAME,
} from "@/lib/sources/provenance";

export const VERIFIED_VACANCIES_HEADER = {
  scope: "phase-6-step-7",
  designation: "real-verified-vacancies",
  verified: true,
  published: false,
} as const;

/** Real international organisations the vacancies belong to. */
export type VerifiedVacancyOrganization = {
  name: string;
  slug: string;
  description: string;
  industry: string;
  websiteUrl: string;
  /** Location slug (Step 6 seed taxonomy). */
  locationSlug: string;
};

export const VERIFIED_VACANCY_ORGANIZATIONS: VerifiedVacancyOrganization[] = [
  {
    name: "UNICEF",
    slug: "unicef",
    description:
      "The United Nations Children's Fund (UNICEF) — Ethiopia country office. UNICEF works in over 190 countries and territories to save children's lives, defend their rights and help them fulfill their potential, from early childhood through adolescence.",
    industry: "International Organization (UN agency)",
    websiteUrl: "https://www.unicef.org/ethiopia",
    locationSlug: "addis-ababa",
  },
  {
    name: "UNFPA",
    slug: "unfpa",
    description:
      "The United Nations Population Fund (UNFPA) — Ethiopia country office. UNFPA is the United Nations sexual and reproductive health agency, delivering a world where every pregnancy is wanted, every childbirth is safe and every young person's potential is fulfilled.",
    industry: "International Organization (UN agency)",
    websiteUrl: "https://www.unfpa.org",
    locationSlug: "addis-ababa",
  },
];

/**
 * Stable, server-resolved source names for the official employer career sites.
 * createCuratedJob resolves (or first creates) a WEBSITE source by these exact
 * names when an "original source" is recorded.
 */
export const VERIFIED_VACANCY_SOURCES: {
  sourceName: string;
  baseUrl: string;
}[] = [
  { sourceName: UNICEF_CAREERS_SOURCE_NAME, baseUrl: "https://jobs.unicef.org" },
  { sourceName: UNFPA_CAREERS_SOURCE_NAME, baseUrl: "https://www.unfpa.org" },
];

export type VerifiedVacancyEmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERNSHIP"
  | "VOLUNTEER"
  | "FREELANCE"
  | "OTHER";

export type VerifiedVacancyRecord = {
  verified: true;
  scope: "phase-6-step-7";
  title: string;
  /** Organization slug (matches VERIFIED_VACANCY_ORGANIZATIONS). */
  organizationSlug: string;
  /** Step 6 seed taxonomy slugs. */
  categorySlug: string;
  professionSlug: string | null;
  locationSlug: string;
  employmentType: VerifiedVacancyEmploymentType;
  experienceMin: number | null;
  experienceMax: number | null;
  /** Date the vacancy was advertised (from the official page), or null. */
  advertisedOn: string | null;
  /** Exact application deadline as an ISO instant. */
  deadline: string;
  /** Official page where candidates apply. */
  applicationUrl: string;
  description: string;
  responsibilities: string;
  requirements: string;
  educationRequirements: string;
  benefits: string | null;
  /** Official employer reference + original publisher site. */
  originalSource: {
    sourceName: string;
    sourceUrl: string;
    externalId: string;
  };
};

export const VERIFIED_VACANCIES: VerifiedVacancyRecord[] = [
  {
    verified: true,
    scope: "phase-6-step-7",
    title: "Nutrition Officer, NO-2, Fixed Term Appointment",
    organizationSlug: "unicef",
    categorySlug: "healthcare",
    professionSlug: "nutrition",
    locationSlug: "hawassa",
    employmentType: "CONTRACT",
    experienceMin: 2,
    experienceMax: null,
    advertisedOn: "2026-08-24",
    deadline: "2027-09-14T20:55:00.000Z",
    applicationUrl: "https://jobs.unicef.org/cw/en-us/job/595227",
    description:
      "UNICEF Ethiopia is seeking a seasoned and highly motivated professional to provide technical, operational, administrative and programmatic support across the full nutrition programme cycle, from strategic planning and design to implementation, monitoring, evaluation and reporting. The role advances nutrition outcomes for children and women by supporting evidence-based programme development, coordinating with partners and stakeholders, and delivering high-impact nutrition interventions.",
    responsibilities:
      "Support nutrition programme development and planning by conducting and updating situation analyses and contributing to results-based planning; manage, monitor and report on programme implementation and the use of sectoral programme resources; provide technical and operational support to government counterparts, NGO partners, UN system partners and other stakeholders; build and sustain effective working partnerships with national stakeholders and participate in relevant inter-agency coordination; and capture and share lessons learned and build the capacity of clients and stakeholders.",
    requirements:
      "Bachelor or equivalent (First Level University Degree) in Nutrition and Dietetics, Public Health, Health Administration, epidemiology, global health, maternal and child health, health policy, health management, health/nutrition research or another health-related science field. At least 2 years of relevant work experience in health, programme management, nutrition, public health, maternal and child health, monitoring and evaluation, partnership development, capacity building, policy and advocacy or a related field. Skills in nutrition planning, programme management, monitoring and evaluation, public health, child health and maternal health. Fluency in English is required. Knowledge of another official UN language or a local language is desirable.",
    educationRequirements:
      "Bachelor or equivalent (First Level University Degree) in Nutrition and Dietetics, Public Health, Health Administration, epidemiology, global health, maternal and child health, health policy, health management, health/nutrition research or another health-related science field.",
    benefits: null,
    originalSource: {
      sourceName: UNICEF_CAREERS_SOURCE_NAME,
      sourceUrl: "https://jobs.unicef.org/cw/en-us/job/595227",
      externalId: "595227",
    },
  },
  {
    verified: true,
    scope: "phase-6-step-7",
    title: "Operations Officer, NO-1, Fixed Term Position",
    organizationSlug: "unicef",
    categorySlug: "operations-administration",
    professionSlug: "operations",
    locationSlug: "semera",
    employmentType: "CONTRACT",
    experienceMin: 1,
    experienceMax: null,
    advertisedOn: "2026-08-26",
    deadline: "2027-09-16T20:55:00.000Z",
    applicationUrl:
      "https://jobs.unicef.org/en-us/job/595360/operations-officer-no1-fixed-term-position-semera-ethiopia-00137690",
    description:
      "UNICEF Ethiopia is looking for a seasoned professional who can lead and be accountable for operations functions, facilitate change, and provide risk-informed, solution-focused analysis, advice and services to contribute to programme and management decision-making that delivers results for children in complex operational contexts. The Operations Officer is based in Semera and supports people management, finance, supply, risk management and partnerships.",
    responsibilities:
      "Lead and be accountable for operations functions at the duty station: implement people resources strategies and promote an agile workforce and staff well-being; champion strategic resources and ensure value for money through financial oversight, budgeting and eco-efficiency; enhance risk management and internal control through governance, risk and compliance frameworks, business continuity planning and anti-fraud actions; support operational centralization and IT-enabled business processes; and strengthen internal and external-facing partnerships, including HACT implementation and written financial reporting with donor accountability.",
    requirements:
      "Bachelor or equivalent (First Level University Degree) in business management, financial management, accounting, public finance or a related operations function (supply chain, human resources, information technology, international business, project management, etc.). A minimum of 1 year of professional experience at the national and/or international level in one or more operations management areas including budget, financial management and reporting, facilities management, administration, supply and logistics management, information and communication technology, or human resources. Understanding of Results Based Management is required and familiarity with Microsoft Office applications. Proficiency in English is required. Knowledge of another official UN language or a local language is an asset.",
    educationRequirements:
      "Bachelor or equivalent (First Level University Degree) in business management, financial management, accounting, public finance or a related operations function (supply chain, human resources, information technology, international business, project management, etc.).",
    benefits: null,
    originalSource: {
      sourceName: UNICEF_CAREERS_SOURCE_NAME,
      sourceUrl:
        "https://jobs.unicef.org/en-us/job/595360/operations-officer-no1-fixed-term-position-semera-ethiopia-00137690",
      externalId: "595360",
    },
  },
  {
    verified: true,
    scope: "phase-6-step-7",
    title:
      "Senior Economic and Public Finance National/International Consultant: Debt and Social Sector Financing",
    organizationSlug: "unicef",
    categorySlug: "finance-economics",
    professionSlug: "public-finance-economic-policy",
    locationSlug: "addis-ababa",
    employmentType: "CONTRACT",
    experienceMin: 10,
    experienceMax: null,
    advertisedOn: "2026-08-25",
    deadline: "2027-09-15T20:55:00.000Z",
    applicationUrl:
      "https://jobs.unicef.org/en-us/job/595328/senior-economic-and-public-finance-nationalinternational-consultant-debt-and-social-sector-financing-addis-ababa-ethiopia-remote-75-months-595328",
    description:
      "UNICEF seeks a senior economic and public finance consultant to generate evidence, analysis and policy recommendations on how debt dynamics, fiscal adjustment and broader macroeconomic reforms shape fiscal space for child-relevant social sector financing in Ethiopia. The 7.5-month consultancy combines empirical, political economy and policy reform analysis to inform national discussions on public finance and development financing and contribute to international discussions on debt, fiscal policy and child outcomes. The assignment can be performed remotely from Addis Ababa, Ethiopia.",
    responsibilities:
      "Undertake a high-level economic and public finance analysis of debt dynamics, fiscal adjustment, external financing pressures and social sector financing in Ethiopia, with a focus on implications for children and future human capital development; integrate quantitative, documentary and qualitative evidence; examine the interaction between debt dynamics, external financing, exchange-rate reform and social sector financing; and produce clear, actionable policy recommendations for government, development partners and international stakeholders, supporting evidence-informed policy dialogue.",
    requirements:
      "Advanced university degree in economics, macroeconomics, development economics, public finance, public policy, political economy or related fields. Minimum 10 years of progressively responsible experience in economics, public finance management, fiscal policy, debt management, macroeconomic analysis, political economy, development financing or related fields, with a demonstrated track record of leading or substantially contributing to high-level analytical work, policy advisory assignments or economic reform processes for governments, international financial institutions, multilateral organisations, development partners or research institutions. Experience working on economic policy, public finance management, debt, fiscal policy or development financing in Ethiopia or comparable contexts is highly desirable. Fluency in spoken and written English is required, with strong analytical, writing and communication skills.",
    educationRequirements:
      "Advanced university degree in economics, macroeconomics, development economics, public finance, public policy, political economy or related fields.",
    benefits: null,
    originalSource: {
      sourceName: UNICEF_CAREERS_SOURCE_NAME,
      sourceUrl:
        "https://jobs.unicef.org/en-us/job/595328/senior-economic-and-public-finance-nationalinternational-consultant-debt-and-social-sector-financing-addis-ababa-ethiopia-remote-75-months-595328",
      externalId: "595328",
    },
  },
  {
    verified: true,
    scope: "phase-6-step-7",
    title: "National Post: Driver, Konso, Ethiopia, GS-2, FTA",
    organizationSlug: "unfpa",
    categorySlug: "transport-logistics",
    professionSlug: "driver",
    locationSlug: "konso",
    employmentType: "CONTRACT",
    experienceMin: 3,
    experienceMax: null,
    advertisedOn: null,
    deadline: "2027-09-21T06:12:00.000Z",
    applicationUrl: "https://www.unfpa.org/jobs/national-post-driver-konso-ethiopia-gs-2-fta",
    description:
      "The Driver provides reliable and safe driving services to the Representative, Deputy Representative, high-ranking UN officials and visitors in Konso, Ethiopia, reporting to the Regional Programme Analyst. The role upholds the highest standards of discretion and integrity, with excellent knowledge of protocol, security issues and local roads, and supports UNFPA's mission of delivering a world where every pregnancy is wanted, every childbirth is safe and every young person's potential is fulfilled.",
    responsibilities:
      "Provide reliable and safe driving services, driving office vehicles for the transport of UNFPA staff, officials and visitors; deliver and collect mail and documentation; meet official personnel and visitors at the airport, including managing visa and customs formalities when required; keep abreast of traffic, road, security and safety conditions for safe, on-time arrivals; manage all aspects of vehicle maintenance, keep daily vehicle logs and assist in preparing vehicle maintenance plans and history reports; keep track of insurance and tax formalities; act as a translator in the local language for official passengers where necessary; guide and coach junior drivers as appropriate; and assist Country Office staff with general administrative duties as required.",
    requirements:
      "Completed secondary level education. Valid driver's license. Three years' work experience as a driver in an international organization, embassy or UN system with a safe driving record. Knowledge of driving rules and regulations, chauffeur protocol and courtesies, and local roads and conditions, plus defensive driving skills. Skill in minor vehicle repairs. Basic knowledge of the official UN language of the duty station.",
    educationRequirements: "Completed Secondary Level Education.",
    benefits:
      "Attractive remuneration package including a competitive net salary plus health insurance and other benefits as applicable.",
    originalSource: {
      sourceName: UNFPA_CAREERS_SOURCE_NAME,
      sourceUrl: "https://www.unfpa.org/jobs/national-post-driver-konso-ethiopia-gs-2-fta",
      externalId: "36696",
    },
  },
];

/**
 * Maps taxonomic/org slugs to their database ids for a specific environment.
 */
export type VerifiedVacancyIdMap = {
  organizations: Record<string, string>;
  categories: Record<string, string>;
  professions: Record<string, string>;
  locations: Record<string, string>;
};

/**
 * Builds the curated-create input (curatedCreateJobSchema shape) for a
 * verified vacancy, resolving slugs to ids via the provided id map.
 */
export function vacancyToCuratedInput(
  record: VerifiedVacancyRecord,
  ids: VerifiedVacancyIdMap,
): {
  organizationId: string;
  title: string;
  description: string;
  categoryId: string;
  professionId: string | null;
  locationId: string;
  responsibilities: string;
  requirements: string;
  educationRequirements: string;
  benefits: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  employmentType: VerifiedVacancyEmploymentType;
  deadline: string;
  applicationUrl: string;
  originalSource: {
    sourceName: string;
    sourceUrl: string;
    externalId: string;
  };
} {
  return {
    organizationId: ids.organizations[record.organizationSlug],
    title: record.title,
    description: record.description,
    categoryId: ids.categories[record.categorySlug],
    professionId: record.professionSlug
      ? (ids.professions[record.professionSlug] ?? null)
      : null,
    locationId: ids.locations[record.locationSlug],
    responsibilities: record.responsibilities,
    requirements: record.requirements,
    educationRequirements: record.educationRequirements,
    benefits: record.benefits,
    experienceMin: record.experienceMin,
    experienceMax: record.experienceMax,
    employmentType: record.employmentType,
    deadline: record.deadline,
    applicationUrl: record.applicationUrl,
    originalSource: {
      sourceName: record.originalSource.sourceName,
      sourceUrl: record.originalSource.sourceUrl,
      externalId: record.originalSource.externalId,
    },
  };
}