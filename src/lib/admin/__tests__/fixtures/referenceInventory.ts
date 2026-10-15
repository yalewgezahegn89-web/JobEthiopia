/**
 * Phase 6 Batch 4 — DEMO / REFERENCE inventory (DEV-ONLY).
 *
 * This is NOT production content and is never written to any database by this
 * fixture. It feeds the automated safety tests in
 * `src/lib/admin/__tests__/initialInventory.test.ts` so the machine can prove,
 * off-the-record, that records shaped like these pass the full curated-job
 * workflow (create -> Manual Entry provenance -> publication validation ->
 * PUBLISHED + VERIFIED) before any real vacancy is ever entered.
 *
 * Every record is explicitly flagged `demo: true`, uses clearly-labelled
 * "[Demo]" employers and `example.com` application URLs, and must remain in its
 * `__tests__` home — kept deliberately separate from production content.
 *
 * To populate production, a staff member replaces each demo record with a REAL,
 * currently open vacancy that has been verified at source, entered through the
 * admin "Create Curated Job" UI (createCuratedJobAction -> createCuratedJob),
 * then reviewed and published through the existing moderation workflow. The
 * taxonomic labels (organization / category / profession / location) must exist
 * and be ACTIVE in the database first (admin taxonomy UI).
 *
 * The single source of provenance for these records is the server-resolved
 * "Manual Entry" source record (src/lib/sources/provenance.ts). No source
 * selection is ever exposed in the entry UI or in this fixture: there is no
 * source field here on purpose.
 */
export const REFERENCE_INVENTORY_HEADER = {
  scope: "phase-6-batch-4",
  designation: "demo-reference",
  published: false,
} as const;

export type ReferenceInventoryEmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERNSHIP"
  | "VOLUNTEER"
  | "FREELANCE"
  | "OTHER";

export type ReferenceInventoryApplicationMethod = "IN_SITE" | "EXTERNAL";

export type ReferenceInventoryRecord = {
  demo: true;
  /** Job title exactly as it should be entered. */
  title: string;
  /** Target organization label for the entry checklist (NOT a real claim). */
  organizationName: string;
  /** Target active category label. */
  categoryName: string;
  /** Target active profession label (null = category-level only). */
  professionName: string | null;
  /** Target active location label. */
  locationName: string;
  employmentType: ReferenceInventoryEmploymentType;
  /** Realistic future deadline, expressed as days from "now". */
  deadlineDays: number;
  applicationMethod: ReferenceInventoryApplicationMethod;
  /** Real source application URL for EXTERNAL records; example.com placeholders only. */
  applicationUrl: string | null;
  description: string;
  responsibilities: string;
  requirements: string;
  educationRequirements: string;
  /** Stable ids the automated mechanism tests map these labels to. */
  fixtureIds: {
    organizationId: string;
    categoryId: string;
    professionId: string | null;
    locationId: string;
  };
};

export const REFERENCE_INVENTORY: ReferenceInventoryRecord[] = [
  {
    demo: true,
    title: "Full-Stack Software Engineer",
    organizationName: "[Demo] Addis Tech Solutions Plc",
    categoryName: "Technology",
    professionName: "Software Engineering",
    locationName: "Addis Ababa",
    employmentType: "FULL_TIME",
    deadlineDays: 30,
    applicationMethod: "EXTERNAL",
    applicationUrl: "https://example.com/careers/full-stack-engineer",
    description:
      "Representative full-stack role: build and maintain web applications end to end, collaborate with product and design on features, and keep services reliable and secure. Replace with the verified real role before entry.",
    responsibilities:
      "Develop and ship features across the application stack; write clean, tested code; participate in code review and technical design discussions.",
    requirements:
      "Experience with modern web frameworks and relational databases; strong problem-solving skills; ability to work in a small team.",
    educationRequirements:
      "Bachelor's degree in Computer Science, Software Engineering, or a related field.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000001",
      categoryId: "20000000-0000-4000-8000-000000000001",
      professionId: "30000000-0000-4000-8000-000000000001",
      locationId: "40000000-0000-4000-8000-000000000001",
    },
  },
  {
    demo: true,
    title: "Registered Nurse",
    organizationName: "[Demo] Hawassa Health Services Plc",
    categoryName: "Healthcare",
    professionName: "Nursing",
    locationName: "Hawassa",
    employmentType: "FULL_TIME",
    deadlineDays: 45,
    applicationMethod: "IN_SITE",
    applicationUrl: null,
    description:
      "Representative nursing role: deliver bedside care, administer medication, monitor patient vitals, and coordinate with the medical team. Replace with the verified real role before entry.",
    responsibilities:
      "Provide direct patient care and medication administration; record vital signs and patient progress; support doctors during consultations and rounds.",
    requirements:
      "Valid nursing license in Ethiopia; clinical experience preferred; strong communication and documentation skills.",
    educationRequirements:
      "Bachelor of Science in Nursing or equivalent accredited qualification.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000002",
      categoryId: "20000000-0000-4000-8000-000000000002",
      professionId: "30000000-0000-4000-8000-000000000002",
      locationId: "40000000-0000-4000-8000-000000000002",
    },
  },
  {
    demo: true,
    title: "Accountant",
    organizationName: "[Demo] FinAdvisory Consulting Plc",
    categoryName: "Finance & Accounting",
    professionName: "Accounting",
    locationName: "Addis Ababa",
    employmentType: "CONTRACT",
    deadlineDays: 35,
    applicationMethod: "EXTERNAL",
    applicationUrl: "https://example.com/careers/accountant",
    description:
      "Representative accounting role: maintain ledgers, prepare financial statements and tax filings, and support budgeting and audit processes. Replace with the verified real role before entry.",
    responsibilities:
      "Record and reconcile daily transactions; prepare monthly account reconciliations and reports; assist with annual audits and tax declarations.",
    requirements:
      "Accounting experience and knowledge of Ethiopian tax rules; attention to detail and spreadsheet proficiency.",
    educationRequirements:
      "Bachelor's degree in Accounting, Finance, or a related field; professional certification is a plus.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000003",
      categoryId: "20000000-0000-4000-8000-000000000003",
      professionId: "30000000-0000-4000-8000-000000000003",
      locationId: "40000000-0000-4000-8000-000000000001",
    },
  },
  {
    demo: true,
    title: "High School Mathematics Teacher",
    organizationName: "[Demo] Bahir Dar Education Trust",
    categoryName: "Education",
    professionName: "Teaching",
    locationName: "Bahir Dar",
    employmentType: "FULL_TIME",
    deadlineDays: 40,
    applicationMethod: "IN_SITE",
    applicationUrl: null,
    description:
      "Representative teaching role: plan and deliver secondary mathematics lessons, assess student progress, and support learners toward national examinations. Replace with the verified real role before entry.",
    responsibilities:
      "Prepare lesson plans and deliver mathematics instruction; grade assignments and examinations; communicate progress to parents and school leadership.",
    requirements:
      "Teaching experience in secondary education; fluency in English and Amharic; patience and strong classroom management.",
    educationRequirements:
      "Bachelor of Education in Mathematics or a related degree with a teaching qualification.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000004",
      categoryId: "20000000-0000-4000-8000-000000000004",
      professionId: "30000000-0000-4000-8000-000000000004",
      locationId: "40000000-0000-4000-8000-000000000003",
    },
  },
  {
    demo: true,
    title: "Field Agronomist",
    organizationName: "[Demo] Tigray Green Agriculture Plc",
    categoryName: "Agriculture",
    professionName: "Agronomy",
    locationName: "Mekelle",
    employmentType: "CONTRACT",
    deadlineDays: 28,
    applicationMethod: "IN_SITE",
    applicationUrl: null,
    description:
      "Representative agronomy role: support smallholder cooperatives with crop planning, soil management, and extension advice across a field region. Replace with the verified real role before entry.",
    responsibilities:
      "Conduct field assessments and soil sampling; advise farmers on planting, irrigation, and pest control; report trial results to the agronomy team.",
    requirements:
      "Field agronomy experience; willingness to travel to rural sites; strong working relationship skills with farming communities.",
    educationRequirements:
      "Bachelor's degree in Agronomy, Plant Science, or a related agricultural discipline.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000005",
      categoryId: "20000000-0000-4000-8000-000000000005",
      professionId: "30000000-0000-4000-8000-000000000005",
      locationId: "40000000-0000-4000-8000-000000000004",
    },
  },
  {
    demo: true,
    title: "Site Civil Engineer",
    organizationName: "[Demo] Dir Dawa Construction Plc",
    categoryName: "Construction & Engineering",
    professionName: "Civil Engineering",
    locationName: "Dire Dawa",
    employmentType: "TEMPORARY",
    deadlineDays: 50,
    applicationMethod: "EXTERNAL",
    applicationUrl: "https://example.com/careers/site-civil-engineer",
    description:
      "Representative site engineering role: supervise construction works, verify quality against drawings, and coordinate contractors on an active project site. Replace with the verified real role before entry.",
    responsibilities:
      "Supervise daily site activities and quality control; review drawings and resolve on-site technical issues; prepare progress reports for the project manager.",
    requirements:
      "Site supervision experience; knowledge of Ethiopian construction standards and safety practices; physical presence on site required.",
    educationRequirements:
      "Bachelor's degree in Civil Engineering or construction engineering.",
    fixtureIds: {
      organizationId: "10000000-0000-4000-8000-000000000006",
      categoryId: "20000000-0000-4000-8000-000000000006",
      professionId: "30000000-0000-4000-8000-000000000006",
      locationId: "40000000-0000-4000-8000-000000000005",
    },
  },
];