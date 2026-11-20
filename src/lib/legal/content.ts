import type { Locale } from "@/lib/i18n/locale";
import { LEGAL_OPERATOR, mailtoOperator } from "./operator";

/**
 * Server-only legal page content.
 *
 * The text is keyed by the existing {@link Locale} type and is selected with
 * `getCurrentLocale()` / `getDictionary(locale)` conventions. It deliberately
 * lives outside the shared i18n messages so that long policy documents are not
 * shipped to the client on every page.
 */

export type LegalLink = {
  label: string;
  href: string;
};

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  links?: LegalLink[];
};

export type LegalDocument = {
  metaTitle: string;
  metaDescription: string;
  heading: string;
  intro: string[];
  sections: LegalSection[];
};

export type LegalContent = {
  privacy: LegalDocument;
  terms: LegalDocument;
  cookies: LegalDocument;
};

const emailLink = (label: string): LegalLink => ({
  label,
  href: mailtoOperator(),
});

const adsLinks = (digitalLabel: string): LegalLink[] => [
  { label: "Google Ads Settings", href: LEGAL_OPERATOR.googleAdsSettings },
  { label: digitalLabel, href: LEGAL_OPERATOR.aboutAdsChoices },
];

const en: LegalContent = {
  privacy: {
    metaTitle: "Privacy Policy | JobEthiopia",
    metaDescription:
      "How JobEthiopia collects, uses, shares and protects personal information.",
    heading: "Privacy Policy",
    intro: [
      "Effective date: November 19, 2026.",
      `JobEthiopia is operated by ${LEGAL_OPERATOR.name}, an individual operator based in Ethiopia. In this policy, "we", "us" and "our" mean ${LEGAL_OPERATOR.name} operating JobEthiopia. This policy explains what personal information we collect, why we collect it, who we share it with, how long we keep it, and the choices you have.`,
      `Our website is ${LEGAL_OPERATOR.website}. If you have a question about this policy, contact us at ${LEGAL_OPERATOR.email}.`,
    ],
    sections: [
      {
        heading: "1. Information we collect",
        paragraphs: [
          "Candidate accounts and profiles. When you register we collect your full name, email address and password. Your password is stored only as a salted scrypt hash and never in plain text. We also store your email-verification status, account role and account status. In your candidate profile you may add a phone number, location, professional summary, total years of experience and education.",
          "CVs and cover letters. If you use our career tools, we store the CV details you enter, such as your professional summary, phone number, location, website, work experience, education, skills and certifications. We also store cover letters you create, including the target position, employer, recipient and letter text. Your name and email address are taken from your account and are not stored separately in CV or cover-letter records.",
          "Uploaded resumes. When you apply with a resume, we store the PDF file privately in configurable S3-compatible object storage and record its storage key, display filename, MIME type and size in our database. Resumes are not placed in a public folder.",
          "Applications. We record the job you apply to, the cover-letter text you submit, application status and timestamps, and any employer notes attached to the application. When you apply, your name and email address from your account are also used to send you a confirmation email and to notify the employer.",
          "Employers and organizations. Employer onboarding collects the admin contact's name, email address, password and phone number, together with organization details such as name, industry, website, contact phone, description and location. Staff may keep review notes. If you invite a team member, we store the email address you provide; once the person appears on a team, their name and email address are visible to other team members.",
          "Google and Telegram sign-in. If you sign in with Google, we receive your Google account identifier, email address, name, given and family names, and a profile picture URL. We store the identifier, email and a display name; the picture URL is received but not stored. If you sign in with Telegram, we receive your Telegram user identifier and display name (which may be derived from your username). We do not receive or store Telegram chat IDs, messages, or your password.",
          "Phone data. If you use phone sign-in, we store your phone number in international (E.164) format, a hash of the one-time code, and verification timestamps. Production SMS delivery is not currently implemented: a code can be generated and stored, but no SMS provider is connected to send it, so phone sign-in is not currently usable in production.",
          "Saved jobs, alerts and notifications. We store jobs you save, job alerts you create (name, keywords, category, profession, location, employment type, frequency and locale), a hash of the unsubscribe token, alert delivery records, and in-app notifications. Notifications sent to employers may include a candidate's name.",
          "Security and analytics records. We store hashed session tokens, session expiry and last-used times, failed-login records containing a hashed email identifier and (where supplied) an IP address, and audit logs with pseudonymous identifiers. Our first-party analytics records a limited, allowlisted set of events using route patterns rather than personal details. Analytics does not use cookies and does not collect IP addresses, user agents, email addresses or user IDs.",
        ],
      },
      {
        heading: "2. Why we use your information",
        paragraphs: ["We use the information described above to:"],
        bullets: [
          "create and secure your account and let you sign in;",
          "operate job search, recommendations, applications and matching;",
          "show employers the profile, cover letter and resume you choose to submit with an application;",
          "send service emails such as verification, password reset, application status and job alerts;",
          "prevent fraud, abuse and unauthorized access, and keep audit records;",
          "understand aggregate use of the site through privacy-preserving analytics; and",
          "comply with applicable legal obligations and respond to your requests.",
        ],
      },
      {
        heading: "3. Who we share information with",
        paragraphs: [
          "Employers. When you submit an application, the relevant employer organization can see your name, email address, profile details, cover letter and submitted resume. JobEthiopia is not the employer and does not make recruitment decisions.",
          "Service providers. We use hosting and database services to run the site; Resend to send transactional email; Google for Google sign-in (and for loading fonts when the site is built); Telegram for Telegram sign-in and for publishing job posts to our channel where configured; Meta/Facebook for page publishing and ingestion where configured; and configurable private S3-compatible object storage (for example Amazon S3 or Cloudflare R2) for resume files. The exact providers and regions depend on deployment configuration.",
          "We do not sell your personal information. We do not currently share personal information with advertising networks.",
        ],
      },
      {
        heading: "4. Cookies and similar technologies",
        paragraphs: [
          "We use an essential session cookie for sign-in, a locale preference cookie, and short-lived cookies during Google or Telegram sign-in. We do not currently use advertising or cross-site tracking cookies. Our analytics are first-party and cookie-free. The interview checklist uses your browser's local storage. See our Cookie Policy for details.",
        ],
      },
      {
        heading: "5. Advertising",
        paragraphs: [
          "JobEthiopia does not currently have Google AdSense or any third-party advertising network integrated, and no advertising cookies are currently used.",
          "We may introduce Google AdSense or other advertising in the future. When advertising is enabled, Google and other advertising partners may use cookies or similar technologies for ad delivery and personalization, and may collect information such as your IP address and browsing activity. We will update this policy before advertising is enabled.",
          "You can learn about opting out of personalized advertising through the resources below. These links are provided for future use; they do not change anything today because no advertising cookies are currently set.",
        ],
        links: adsLinks("Digital Advertising Alliance choices"),
      },
      {
        heading: "6. How long we keep information",
        paragraphs: [
          "First-party analytics events are configured for 365-day retention and are pruned on that schedule. Session cookies last 7 days; temporary OAuth cookies last 10 minutes; email verification tokens expire after 24 hours; password-reset links after 30 minutes; one-time codes after 5 minutes; and failed-login records are cleaned up on a rolling basis.",
          "We do not currently have fixed retention periods for applications, resumes, employer notes, audit logs or backups. We keep this information for as long as it is needed to operate the service, meet legal requirements or resolve disputes, and then delete or anonymize it.",
          "There is no self-service account deletion feature at present. You can request deletion by contacting us.",
        ],
      },
      {
        heading: "7. Your rights and choices",
        paragraphs: [
          "You can ask us to give you access to your personal information, correct information that is wrong, or delete information we hold about you. You can also unsubscribe from job alerts using the link in each alert email or from your account settings, manage active sessions in your settings, and delete CVs, cover letters, resumes, alerts and notifications where those controls are available on the site.",
          "Withdrawing an application changes its status; it does not erase the application record or the resume from our systems.",
          "To make a request, contact Yalew Abera at jobethiopiaet@gmail.com. We may need to verify your identity before we act, and applicable legal requirements may limit or delay what we can delete or change.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "8. Security",
        paragraphs: [
          "We use measures appropriate to the service, including salted scrypt password hashing, hashed storage for session tokens and sensitive one-time tokens, HTTPS delivery, CSRF protections on forms, role-based access controls, authenticated download of private resumes, and audit logging. No online service can be completely secure, so please protect your credentials and tell us if you suspect unauthorized access.",
        ],
      },
      {
        heading: "9. Changes to this policy",
        paragraphs: [
          "We may update this policy as the service changes. The effective date at the top shows when this version took effect. Please review this page from time to time.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: [
          `JobEthiopia is operated by ${LEGAL_OPERATOR.name}, an individual operator in Ethiopia. Website: ${LEGAL_OPERATOR.website}. For privacy questions or requests, email ${LEGAL_OPERATOR.email}.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  terms: {
    metaTitle: "Terms of Use | JobEthiopia",
    metaDescription: "The rules for using the JobEthiopia website and services.",
    heading: "Terms of Use",
    intro: [
      "Effective date: November 19, 2026.",
      `These Terms of Use govern your use of JobEthiopia, operated by ${LEGAL_OPERATOR.name}, an individual operator based in Ethiopia (${LEGAL_OPERATOR.website}). By using the site you agree to these terms. If you do not agree, please do not use the service.`,
    ],
    sections: [
      {
        heading: "1. About the service",
        paragraphs: [
          "JobEthiopia is a job and career platform. It displays vacancies, helps candidates build profiles and CVs, and passes applications to the organizations that posted the vacancies. JobEthiopia is not an employer, does not make recruitment decisions, and is not a party to any employment contract between a candidate and an employer.",
        ],
      },
      {
        heading: "2. Your account and acceptable use",
        paragraphs: [
          "You are responsible for keeping your account credentials secure and for activity that happens under your account. Use the service only for lawful purposes. Do not post unlawful, misleading, discriminatory or harmful material; do not impersonate another person; do not attempt to gain unauthorized access to accounts or systems; and do not scrape, overload or interfere with the operation of the site. Report suspected abuse to the contact address below.",
        ],
      },
      {
        heading: "3. Candidate responsibilities",
        paragraphs: [
          "You are responsible for the accuracy of the information in your profile, CV, cover letters and applications. Check your submissions before sending them. Submitting false information or documents you do not have the right to share may lead to your account being limited or removed.",
        ],
      },
      {
        heading: "4. Employer responsibilities",
        paragraphs: [
          "Employers must post only vacancies that are accurate, current and lawful to advertise, and must have the right to publish the job description and logo they provide. Employers are responsible for complying with applicable law in their recruitment process, including rules on equal opportunity and the handling of applicant information. Misleading or fraudulent vacancies may be removed and access may be limited.",
        ],
      },
      {
        heading: "5. Ownership of your content",
        paragraphs: [
          "You keep ownership of the CVs, cover letters and other content you create and submit. You grant JobEthiopia a limited, non-exclusive, royalty-free permission to host, store, reproduce and display that content only as needed to operate the service, including showing it to the employer you apply to. This permission ends when you delete the content or your account, except where information must be retained for legal or security reasons as described in the Privacy Policy.",
        ],
      },
      {
        heading: "6. Employer content and logos",
        paragraphs: [
          "Employers keep ownership of their job descriptions, logos and other materials. By submitting them you give JobEthiopia limited permission to host, display and distribute them on the site and, where publishing is configured, on channels such as Telegram and Facebook. You confirm that you have the rights needed to grant this permission.",
        ],
      },
      {
        heading: "7. Applications and sharing with employers",
        paragraphs: [
          "When you submit an application, your profile details, cover letter and submitted resume are transmitted to the employer organization responsible for the vacancy. That employer, not JobEthiopia, reviews applications and decides whether to contact you. Withdrawing an application changes its status but does not delete records already shared.",
        ],
      },
      {
        heading: "8. Third-party vacancies, websites and links",
        paragraphs: [
          "Some vacancies and career resources may come from third parties or link to external websites. JobEthiopia does not control those sites and is not responsible for their content, availability or privacy practices. A link does not mean we endorse the destination. Review the terms and policies of any external site before submitting information to it.",
        ],
      },
      {
        heading: "9. Fraud prevention and reporting",
        paragraphs: [
          "If you see a vacancy or message that seems suspicious, do not send money or personal documents, and report it to us. We may investigate, remove content, or suspend accounts to protect users. Employers are responsible for verifying candidates through their own lawful processes.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "10. No guarantee of employment or availability",
        paragraphs: [
          "JobEthiopia does not guarantee employment, an interview, a response from an employer, or that a vacancy will remain available. Vacancies may be filled, closed, corrected or removed at any time. Information on the site is provided for general guidance and is not professional advice.",
        ],
      },
      {
        heading: "11. Limitation of liability",
        paragraphs: [
          "To the maximum extent permitted by applicable mandatory law, JobEthiopia and its operator are not liable for indirect or consequential losses, lost profits, lost opportunities, or damages arising from the use of the site, third-party content, or matters between candidates and employers. Nothing in these terms excludes liability that cannot lawfully be excluded. Your statutory rights under applicable law remain unaffected.",
        ],
      },
      {
        heading: "12. Changes, contact and update procedures",
        paragraphs: [
          `We may update these terms as the service changes. The effective date at the top shows when this version took effect, and we will post the updated terms on this page. Questions, reports or notices about these terms can be sent to ${LEGAL_OPERATOR.name} at ${LEGAL_OPERATOR.email}. For questions about how information is handled, see the Privacy Policy.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  cookies: {
    metaTitle: "Cookie Policy | JobEthiopia",
    metaDescription:
      "The cookies, session storage and local browser storage used by JobEthiopia.",
    heading: "Cookie Policy",
    intro: [
      "Effective date: November 19, 2026.",
      "This policy explains the small pieces of data that JobEthiopia stores in your browser and why. It should be read together with the Privacy Policy.",
    ],
    sections: [
      {
        heading: "1. Essential authentication cookie",
        paragraphs: [
          "We set a session cookie named \"session\" when you sign in. It lets the site recognize you across requests and lasts 7 days. It is HttpOnly, uses SameSite=Lax, and is marked Secure when the site is served over HTTPS. It is essential: if you block or delete it, you will not be able to stay signed in or use features that require an account.",
        ],
      },
      {
        heading: "2. Locale preference cookie",
        paragraphs: [
          "A cookie named \"jobethiopia_locale\" remembers your language choice (English, Amharic or Afaan Oromo). It is a session cookie with no fixed expiry date. If you disable it, the site will use its default language on your next visit.",
        ],
      },
      {
        heading: "3. Temporary sign-in security cookies",
        paragraphs: [
          "During Google or Telegram sign-in we set short-lived cookies that hold the state, nonce and PKCE verifier for that single sign-in attempt. They are HttpOnly, restricted to the sign-in routes, expire after 10 minutes and are cleared when sign-in finishes. Blocking them will prevent Google or Telegram sign-in from working.",
        ],
      },
      {
        heading: "4. First-party analytics without tracking cookies",
        paragraphs: [
          "Our analytics are recorded on our own servers. They use an allowlisted set of events and page-route patterns, and do not set cookies, read advertising identifiers, or collect IP addresses, user agents, email addresses or user IDs. Events are retained for 365 days. These analytics are not used for advertising.",
        ],
      },
      {
        heading: "5. Local browser storage",
        paragraphs: [
          "The interview checklist keeps your ticked items in your browser's localStorage so they remain when you return to the page. This data stays on your device and is not sent to our servers. You can clear it at any time through your browser's site-data settings.",
        ],
      },
      {
        heading: "6. Future advertising cookies",
        paragraphs: [
          "No advertising cookies are currently used. JobEthiopia does not currently have Google AdSense or another advertising network integrated. If advertising is introduced in the future, Google and other advertising partners may use cookies or similar technologies for ad delivery and personalization. We will update the Privacy Policy and this page before that happens, and will apply the consent and notice required by applicable law.",
          "Information about opting out of personalized advertising is available here:",
        ],
        links: adsLinks("Digital Advertising Alliance choices"),
      },
      {
        heading: "7. Managing cookies",
        paragraphs: [
          "You can block or delete cookies in your browser settings. Be aware that disabling the essential cookies described above will affect login and other website functionality. Deleting cookies does not delete account or application information stored on our servers.",
        ],
      },
      {
        heading: "8. Contact",
        paragraphs: [
          `If you have questions about this Cookie Policy, contact ${LEGAL_OPERATOR.name} at ${LEGAL_OPERATOR.email}.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

const am: LegalContent = {
  privacy: {
    metaTitle: "የግላዊነት መመሪያ | JobEthiopia",
    metaDescription:
      "JobEthiopia የግል መረጃን እንዴት እንደሚሰበስብ፣ እንደሚጠቀም፣ እንደሚያካፍልና እንደሚጠብቅ።",
    heading: "የግላዊነት መመሪያ",
    intro: [
      "የሚጀምርበት ቀን፡ ኖቬምበር 19፣ 2026።",
      `JobEthiopia የሚተዳደረው በ${LEGAL_OPERATOR.name}፣ በኢትዮጵያ ውስጥ በግል ሥራ አስኪያጅነት ነው። በዚህ መመሪያ ውስጥ «እኛ»፣ «እኛን»ና «የእኛ» ማለት JobEthiopiaን የሚያካሂደው ${LEGAL_OPERATOR.name} ነው። ይህ መመሪያ ስለምንሰበስበው የግል መረጃ፣ ስለምንጠቀምበት ምክንያት፣ ስለምናካፍለው አካል፣ ስለምንጠብቅበት ጊዜና ስላሎት ምርጫ ያብራራል።`,
      `ድረ-ገፃችን ${LEGAL_OPERATOR.website} ነው። ስለዚህ መመሪያ ጥያቄ ካለዎት በ${LEGAL_OPERATOR.email} ሊያገኙን ይችላሉ።`,
    ],
    sections: [
      {
        heading: "1. የምንሰበስበው መረጃ",
        paragraphs: [
          "የእጩ መለያዎችና መገለጫዎች። ሲመዘገቡ ሙሉ ስምዎን፣ የኢሜይል አድራሻዎንና የይለፍ ቃልዎን እንሰበስባለን። የይለፍ ቃልዎ እንደ ጨው የተጨመረበት scrypt hash ብቻ ነው የሚከማቸው፣ በግልጽ ጽሑፍ ፈጽሞ አይከማችም። የኢሜይል ማረጋገጫ ሁኔታዎን፣ የመለያ ሚናዎንና ሁኔታዎንም እናከማቻለን። በመገለጫዎ ውስጥ የስልክ ቁጥር፣ አካባቢ፣ ሙያዊ ማጠቃለያ፣ የሥራ ዓመታትና ትምህርት ማከል ይችላሉ።",
          "ሲቪዎችና የሽፋን ደብዳቤዎች። የሙያ መሳሪያችንን ከተጠቀሙ የሚያስገቧቸውን የሲቪ ዝርዝሮች እናከማቻለን፡ ሙያዊ ማጠቃለያ፣ ስልክ ቁጥር፣ አካባቢ፣ ድረ-ገፅ፣ የሥራ ልምድ፣ ትምህርት፣ ክህሎቶችና ምስክርነቶች። የሚፈጥሯቸውን የሽፋን ደብዳቤዎችም እናከማቻለን፡ ኢላማ የሆነው የሥራ መደብ፣ አሰሪ፣ ተቀባይና የደብዳቤው ጽሑፍ። ስምዎና የኢሜይል አድራሻዎ ከመለያዎ የሚወሰዱ እንጂ በሲቪ ወይም በደብዳቤ መዝገቦች ውስጥ ለየት ብለው አይከማቹም።",
          "የሚሰቀሉ የሲቪ ፋይሎች። በሲቪ ሲያመለክቱ ፒዲኤፍ ፋይሉን በሚዋቀር የግል S3-ተኳሃኝ ማከማቻ ውስጥ እናከማቻለን፤ የማከማቻ ቁልፉን፣ የሚታየው የፋይል ስም፣ MIME ዓይነትና መጠኑንም በመረጃ ቋታችን ውስጥ እንመዘግባለን። ፋይሎቹ በሕዝብ አቃፊ ውስጥ አይቀመጡም።",
          "ማመልከቻዎች። የሚያመለክቱበት ሥራ፣ የሚልኩት የሽፋን ደብዳቤ ጽሑፍ፣ የማመልከቻ ሁኔታና ጊዜዎች፣ እንዲሁም ከማመልከቻው ጋር የተያያዙ የአሰሪ ማስታወሻዎች እንመዘግባለን። ሲያመለክቱ ስምዎና የኢሜይል አድራሻዎ ለማረጋገጫ ኢሜይል ለመላክና አሰሪውን ለማሳወቅም ጥቅም ላይ ይውላሉ።",
          "አሰሪዎችና ድርጅቶች። የአሰሪ ምዝገባ የአስተዳዳሪውን ስም፣ ኢሜይል፣ የይለፍ ቃልና ስልክ ቁጥር፣ እንዲሁም የድርጅቱን ስም፣ ኢንዱስትሪ፣ ድረ-ገፅ፣ የእውቂያ ስልክ፣ መግለጫና አካባቢ ይሰበስባል። ሠራተኞች የግምገማ ማስታወሻዎች ሊኖራቸው ይችላል። የቡድን አባል ከጋበዙ የሚሰጡትን የኢሜይል አድራሻ እናከማቻለን፤ አባሉ በቡድኑ ውስጥ ከታየ በኋላ ስሙና ኢሜይሉ ለሌሎች የቡድን አባላት ይታያል።",
          "በGoogleና Telegram መግባት። በGoogle ከገቡ የGoogle መለያ ቁጥርዎን፣ ኢሜይልዎን፣ ስምዎን፣ የመጀመሪያና የአባት ስምዎንና የምስል አድራሻዎን እንቀበላለን። መለያውን፣ ኢሜይሉንና የሚታየውን ስም እናከማቻለን፤ የምስሉ አድራሻ ግን ሳይከማች ይቀበላል። በTelegram ከገቡ የTelegram ተጠቃሚ መለያዎንና የሚታየውን ስምዎን (ከተጠቃሚ ስምዎ ሊመጣ የሚችል) እንቀበላለን። የTelegram ውይይት መለያዎችን፣ መልእክቶችን ወይም የይለፍ ቃልዎን አንቀበልም፤ አናከማችምም።",
          "የስልክ መረጃ። የስልክ መግቢያ ከተጠቀሙ ስልክ ቁጥርዎን በዓለም አቀፍ (E.164) ቅርጸት፣ የአንድ ጊዜ ኮዱን hash፣ የማረጋገጫ ጊዜዎችን እናከማቻለን። በምርት አካባቢ የኤስኤምኤስ መላክ በአሁኑ ጊዜ የለም፡ ኮድ ሊፈጠርና ሊከማች ቢችልም ለመላክ የተገናኘ የኤስኤምኤስ አገልግሎት አቅራቢ የለም፤ ስለዚህ የስልክ መግቢያ በምርት አካባቢ አሁን ሊሠራ አይችልም።",
          "የተቀመጡ ሥራዎች፣ ማንቂያዎችና ማሳወቂያዎች። የተቀመጧቸውን ሥራዎች፣ የሚፈጥሯቸውን የሥራ ማንቂያዎች (ስም፣ ቁልፍ ቃላት፣ ምድብ፣ ሙያ፣ አካባቢ፣ የሥራ ዓይነት፣ ድግግሞሽና ቋንቋ)፣ የመመሪያ (unsubscribe) ማስመሰያ hash፣ የማንቂያ መላክ መዝገቦችና በመተግበሪያው ውስጥ ያሉ ማሳወቂያዎችን እናከማቻለን። ለአሰሪዎች የሚላኩ ማሳወቂያዎች የእጩውን ስም ሊያካትቱ ይችላሉ።",
          "የደህንነትና የትንታኔ መዝገቦች። የክፍለጊዜ ማስመሰያዎች hash፣ የክፍለጊዜ መጥፊያና የመጨረሻ ጥቅም ጊዜዎች፣ የተሳካ-ያልሆነ ግባት መዝገቦች (የተሰራ ኢሜይል መለያና፣ ከተሰጠ፣ የአይፒ አድራሻ)፣ እንዲሁም ስም-አልባ መለያዎች ያሉት የኦዲት መዝገቦች እናከማቻለን። የእኛ የመጀመሪያ-ወገን ትንታኔ ከግል ዝርዝር ይልቅ የመንገድ (route) ንድፎችን በመጠቀም የተፈቀደላቸውን ጥቂት ክስተቶች ብቻ ይመዘግባል። ትንታኔው ኩኪዎችን አይጠቀምም፤ የአይፒ አድራሻ፣ የአሳሽ መረጃ፣ የኢሜይል አድራሻ ወይም የተጠቃሚ መለያ አይሰበስብም።",
        ],
      },
      {
        heading: "2. መረጃዎን ስለምንጠቀምበት",
        paragraphs: ["ከላይ የተገለጸውን መረጃ ለሚከተሉት ዓላማዎች እንጠቀማለን፡-"],
        bullets: [
          "መለያዎን ለመፍጠርና ለመጠበቅ፣ እንዲገቡ ለማስቻል፤",
          "የሥራ ፍለጋ፣ ምክረ-ሥራ፣ ማመልከቻና ማዛመድን ለማካሄድ፤",
          "አመልካች ለመሆን ለመረጡት አሰሪ መገለጫዎን፣ የሽፋን ደብዳቤዎንና ሲቪዎን ለማሳየት፤",
          "ማረጋገጫ፣ የይለፍ ቃል ዳግም ማስጀመሪያ፣ የማመልከቻ ሁኔታና የሥራ ማንቂያዎችን ጨምሮ የአገልግሎት ኢሜይሎችን ለመላክ፤",
          "ማጭበርበር፣ መጎሳቆልና ፈቃድ የሌለው መግባትን ለመከላከልና የኦዲት መዝገቦችን ለመያዝ፤",
          "ግላዊነትን በሚጠብቅ ትንታኔ የጣቢያውን አጠቃላይ አጠቃቀም ለመረዳት፤ እና",
          "የሚመለከታቸው የሕግ ግዴታዎችን ለመፈጸምና ጥያቄዎችዎን ለመመለስ።",
        ],
      },
      {
        heading: "3. መረጃዎን ለማን እናካፍላለን",
        paragraphs: [
          "አሰሪዎች። ማመልከቻ ሲያስገቡ ተገቢው የአሰሪ ድርጅት ስምዎን፣ የኢሜይል አድራሻዎን፣ የመገለጫ ዝርዝሮችዎን፣ የሽፋን ደብዳቤዎንና የሚሰቅሉትን ሲቪ ማየት ይችላል። JobEthiopia አሰሪ አይደለም፤ የቅጥር ውሳኔም አያደርግም።",
          "የአገልግሎት አቅራቢዎች። ጣቢያውን ለማስኬድ የማስተናገጃና የመረጃ ቋት አገልግሎቶችን፣ የኢሜይል መላኪያን Resend፣ ለGoogle መግቢያ Googleን (እና ጣቢያው ሲገነባ ፊደሎችን ለመጫን)፣ ለTelegram መግቢያና የሥራ ማስታወቂያዎችን ወደ ሰርጣችን ለመላክ Telegramን፣ የገፅ መለጠፍና መረጃ መቀበልን Meta/Facebookን፣ እንዲሁም የሲቪ ፋይሎችን ለማከማቸት ሊዋቀር የሚችል የግል S3-ተኳሃኝ ማከማቻ (ለምሳሌ Amazon S3 ወይም Cloudflare R2) እንጠቀማለን። ትክክለኛዎቹ አቅራቢዎችና ክልሎች በማሰማራት ውቅር ላይ ይመረኮዛሉ።",
          "የግል መረጃዎን አንሸጥም። በአሁኑ ጊዜ ለማስታወቂያ አውታረ መረቦች መረጃ አናካፍልም።",
        ],
      },
      {
        heading: "4. ኩኪዎችና ተመሳሳይ ቴክኖሎጂዎች",
        paragraphs: [
          "ለመግባት አስፈላጊ የሆነ የክፍለጊዜ ኩኪ፣ የቋንቋ ምርጫ ኩኪ፣ እንዲሁም በGoogle ወይም Telegram መግቢያ ጊዜ ለጊዜው የሚቀመጡ ኩኪዎችን እንጠቀማለን። በአሁኑ ጊዜ የማስታወቂያ ወይም የሌላ ጣቢያ ክትትል ኩኪዎችን አንጠቀምም። ትንታኔው የመጀመሪያ-ወገንና ከኩኪ ነጻ ነው። የቃለ-መጠይቅ ዝግጅት መሳሪያው የአሳሽዎን የአካባቢ ማከማቻ (localStorage) ይጠቀማል። ለዝርዝር የኩኪ መመሪያችንን ይመልከቱ።",
        ],
      },
      {
        heading: "5. ማስታወቂያ",
        paragraphs: [
          "JobEthiopia በአሁኑ ጊዜ Google AdSense ወምሳሌ ማንኛውንም የማስታወቂያ አውታረ መረብ አልተቀናጀም፤ የማስታወቂያ ኩኪዎችም አሁን አይጠቀሙም።",
          "ወደፊት Google AdSense ወይም ሌላ ማስታወቂያ ልናስተዋውቅ እንችላለን። ማስታወቂያ ሲነቃ Googleና ሌሎች የማስታወቂያ አጋሮች ማስታወቂያ ለማድረስና ለግል ለማበጀት ኩኪዎችን ወይም ተመሳሳይ ቴክኖሎጂዎችን ሊጠቀሙና የአይፒ አድራሻዎንና የአሰሳ እንቅስቃሴዎን ሊሰበስቡ ይችላሉ። ማስታወቂያ ከመነቃቱ በፊት ይህን መመሪያ እናሻሽላለን።",
          "ስለ ግላዊ ያልሆነ ማስታወቂያ መርጦ መውጣት ከሚከተሉት ምንጮች ማወቅ ይችላሉ። እነዚህ አገናኞች ለወደፊት ጥቅም የቀረቡ ናቸው፤ አሁን ምንም የማስታወቂያ ኩኪ ስለሌለ ምንም ለውጥ አያመጡም።",
        ],
        links: adsLinks("የDigital Advertising Alliance ምርጫዎች"),
      },
      {
        heading: "6. መረጃውን ለምን ያህል ጊዜ እናከማቻለን",
        paragraphs: [
          "የመጀመሪያ-ወገን ትንታኔ ክስተቶች ለ365 ቀናት እንዲቀመጡ የተዋቀሩ ናቸው። የክፍለጊዜ ኩኪዎች 7 ቀናት ይቆያሉ፤ ጊዜያዊ የOAuth ኩኪዎች 10 ደቂቃዎች፤ የኢሜይል ማረጋገጫ ማስመሰያዎች 24 ሰዓታት፤ የይለፍ ቃል ዳግም ማስጀመሪያ አገናኞች 30 ደቂቃዎች፤ የአንድ ጊዜ ኮዶች 5 ደቂቃዎች፤ የተሳካ-ያልሆነ ግባት መዝገቦችም በተከታታይ መሰረት ይጸዳሉ።",
          "በአሁኑ ጊዜ ለማመልከቻዎች፣ ለሲቪ ፋይሎች፣ ለአሰሪ ማስታወሻዎች፣ ለኦዲት መዝገቦችና ለመጠባበቂያ ቅጂዎች የተወሰነ የማቆያ ጊዜ የለም። አገልግሎቱን ለማካሄድ፣ የሕግ ግዴታዎችን ለመፈጸም ወይም አለመግባባቶችን ለመፍታት ለሚያስፈልግ ጊዜ ያህል እናከማቻለን፣ ከዚያም እናጠፋለን ወይም ስም እናስወግዳለን።",
          "በአሁኑ ጊዜ ራስ-ሰር የመለያ መሰረዣ ባህሪ የለም። መሰረዝ ለመጠየቅ ሊያገኙን ይችላሉ።",
        ],
      },
      {
        heading: "7. መብቶችዎና ምርጫዎችዎ",
        paragraphs: [
          "የግል መረጃዎን እንድናሳይዎት፣ የተሳሳተ መረጃ እንድናስተካክል፣ ወይም ስለእርስዎ ያለንን መረጃ እንድንሰርዝ መጠየቅ ይችላሉ። በኢሜይልዎ ውስጥ ካለው አገናኝ ወይም ከመለያ ቅንብሮችዎ የሥራ ማንቂያዎችን መቋረጥ፣ ንቁ ክፍለጊዜዎችን ማስተዳደር፣ እንዲሁም ጣቢያው ላይ ካሉ መቆጣጠሪያዎች ሲቪዎችን፣ የሽፋን ደብዳቤዎችን፣ ሲቪ ፋይሎችን፣ ማንቂያዎችንና ማሳወቂያዎችን መሰረዝ ይችላሉ።",
          "ማመልከቻን መመለስ የማመልከቻውን ሁኔታ ብቻ ነው የሚቀይረው፤ የማመልከቻ መዝገቡንና ሲቪውን ከስርዓታችን አያጠፋም።",
          "ጥያቄዎን ለማስገባት ያለው አበራ በjobethiopiaet@gmail.com ሊያገኙት ይችላሉ። ከማከናወናችን በፊት ማንነትዎን ማረጋገጥ ሊኖርብን ይችላል፣ የሚመለከታቸው የሕግ መስፈርቶችም ሊሰርዙት ወይም ሊቀይሩት የምንችለውን ሊገድቡ ወይም ሊያዘገዩ ይችላሉ።",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "8. ደህንነት",
        paragraphs: [
          "ለአገልግሎቱ ተገቢ የሆኑ እርምጃዎችን እንጠቀማለን፡ ጨው የተጨመረበት scrypt የይለፍ ቃል hash፣ ለክፍለጊዜ ማስመሰያዎችና ስሱ የአንድ ጊዜ ማስመሰያዎች hash የተደረገ ማከማቻ፣ HTTPS፣ በቅጾች ላይ CSRF ጥበቃ፣ በሚና መሰረት የተደረገ መዳረሻ መቆጣጠሪያ፣ የግል ሲቪዎችን በማረጋገጫ ማውረድና የኦዲት መዝገቦች። ምንም የመስመር ላይ አገልግሎት ሙሉ በሙሉ ደህንነቱ የተጠበቀ ሊሆን አይችልም፤ ስለዚህ የመግቢያ መረጃዎን ይጠብቁ እና ፈቃድ የሌለው መዳረሻ ከጠረጠሩ ያሳውቁን።",
        ],
      },
      {
        heading: "9. ለዚህ መመሪያ የሚደረግ ለውጥ",
        paragraphs: [
          "ይህን መመሪያ አገልግሎቱ ሲለዋወጥ ልናሻሽለው እንችላለን። በላይ ያለው የሚጀምርበት ቀን የዚህ እትም መጀመሪያ ያሳያል። እባክዎ ይህን ገፅ አልፎ አልፎ ይመልከቱ።",
        ],
      },
      {
        heading: "10. ማነጋገሪያ",
        paragraphs: [
          `JobEthiopia የሚተዳደረው በ${LEGAL_OPERATOR.name}፣ በኢትዮጵያ ውስጥ በግል ሥራ አስኪያጅነት ነው። ድረ-ገፅ፡ ${LEGAL_OPERATOR.website}። ስለ ግላዊነት ጥያቄዎች ወይም ጥያቄዎች በ${LEGAL_OPERATOR.email} ይላኩልን።`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  terms: {
    metaTitle: "የአጠቃቀም ውሎች | JobEthiopia",
    metaDescription: "JobEthiopia ድረ-ገፅንና አገልግሎቶችን ስለመጠቀም ህጎቹ።",
    heading: "የአጠቃቀም ውሎች",
    intro: [
      "የሚጀምርበት ቀን፡ ኖቬምበር 19፣ 2026።",
      `እነዚህ የአጠቃቀም ውሎች JobEthiopiaን ስለመጠቀምዎ ይመራሉ። እሱም የሚተዳደረው በ${LEGAL_OPERATOR.name}፣ በኢትዮጵያ ውስጥ በግል ሥራ አስኪያጅነት (${LEGAL_OPERATOR.website}) ነው። ጣቢያውን በመጠቀም እነዚህን ውሎች እንደተቀበሉ ይቆጠራል። ካልተስማሙ አገልግሎቱን አይጠቀሙ።`,
    ],
    sections: [
      {
        heading: "1. ስለ አገልግሎቱ",
        paragraphs: [
          "JobEthiopia የሥራና የሙያ መድረክ ነው። የሥራ ማስታወቂያዎችን ያሳያል፣ እጩዎች መገለጫና ሲቪ እንዲያዘጋጁ ይረዳል፣ ማመልከቻዎችንም ማስታወቂያውን ለለጠፈው ድርጅት ያስተላልፋል። JobEthiopia አሰሪ አይደለም፤ የቅጥር ውሳኔ አያደርግም፤ በእጩውና በአሰሪው መካከል ካለው የሥራ ውል አካል አይደለም።",
        ],
      },
      {
        heading: "2. መለያዎና ተቀባይነት ያለው አጠቃቀም",
        paragraphs: [
          "የመግቢያ መረጃዎን ደህንነቱ የተጠበቀ ማድረግና በመለያዎ ስም የሚደረግ እንቅስቃሴ ኃላፊነት የእርስዎ ነው። አገልግሎቱን ለሕጋዊ ዓላማዎች ብቻ ይጠቀሙ። ሕገ-ወጥ፣ አሳሳች፣ አድልዎ ያለው ወይም ጎጂ ቁሳቁስ አትለጥፉ፤ ሌላ ሰው መስለው አትቅረቡ፤ ፈቃድ የሌለው መግባትን አትሞክሩ፤ ጣቢያውን አትቧጭሩ፣ አትጫኑበትም፣ አሠራሩንም አትረብሹ። ስለ አጎሳቆል ከጠረጠሩ ከታች ባለው አድራሻ ያሳውቁን።",
        ],
      },
      {
        heading: "3. የእጩዎች ኃላፊነት",
        paragraphs: [
          "በመገለጫዎ፣ በሲቪዎ፣ በሽፋን ደብዳቤዎችዎና በማመልከቻዎችዎ ያለው መረጃ ትክክለኛ መሆኑ የእርስዎ ኃላፊነት ነው። ከመላክዎ በፊት ይፈትሹ። ሐሰተኛ መረጃ ወይም የማጋራት መብት የሌለው ሰነድ ማስገባት መለያዎ እንዲገደብ ወይም እንዲወገድ ሊያደርግ ይችላል።",
        ],
      },
      {
        heading: "4. የአሰሪዎች ኃላፊነት",
        paragraphs: [
          "አሰሪዎች ትክክለኛ፣ ወቅታዊና ሕጋዊ በሆኑ ማስታወቂያዎች ብቻ መለጠፍ አለባቸው፤ የሚሰጡትን የሥራ መግለጫና አርማ ለማተም መብትም ሊኖራቸው ይገባል። የቅጥር ሂደታቸው በሚመለከታቸው ሕግ፣ የእኩል ዕድል ህጎችንና የአመልካች መረጃ አያያዝን ጨምሮ፣ መከበሩ የእነሱ ኃላፊነት ነው። አሳሳች ወይም ጭብጥ ያለባቸው ማስታወቂያዎች ሊወገዱና መዳረሻ ሊገደብ ይችላል።",
        ],
      },
      {
        heading: "5. የእርስዎ ይዘት ባለቤትነት",
        paragraphs: [
          "የሚፈጥሯቸውና የሚያስገቧቸው ሲቪዎች፣ የሽፋን ደብዳቤዎችና ሌሎች ይዘቶች የእርስዎ ናቸው። JobEthiopia አገልግሎቱን ለማካሄድ፣ ማመልከቻ ላስገቡት አሰሪ ማሳየትን ጨምሮ፣ ያንን ይዘት ለማስተናገድ፣ ለማከማቸት፣ ለመቅዳትና ለማሳየት ብቻ የተገደበ፣ ልዩ ያልሆነ፣ ክፍያ-አልባ ፈቃድ ይሰጣሉ። ይህ ፈቃድ ይዘቱን ወይም መለያዎን ሲሰርዙ ያበቃል፣ በግላዊነት መመሪያው መሰረት ለሕጋዊ ወይም የደህንነት ምክንያት መቀመጥ ካለበት ይልቅ።",
        ],
      },
      {
        heading: "6. የአሰሪ ይዘትና አርማዎች",
        paragraphs: [
          "አሰሪዎች የሥራ መግለጫዎቻቸው፣ አርማዎቻቸውና ሌሎች ቁሳቁሶች ባለቤቶች ናቸው። እነዚህን ሲያስገቡ በጣቢያው ላይና ማተሚያ ሲዋቀር እንደ Telegramና Facebook ባሉ ሰርጦች ላይ ለማስተናገድ፣ ለማሳየትና ለማሰራጨት የተገደበ ፈቃድ ይሰጣሉ። ይህን ፈቃድ ለመስጠት አስፈላጊው መብት እንዳለዎት ያረጋግጣሉ።",
        ],
      },
      {
        heading: "7. ማመልከቻዎችና ለአሰሪዎች መጋራት",
        paragraphs: [
          "ማመልከቻ ሲያስገቡ የመገለጫ ዝርዝሮችዎ፣ የሽፋን ደብዳቤዎና የሚሰቅሉት ሲቪ ለሥራው ኃላፊ ለሆነው የአሰሪ ድርጅት ይተላለፋሉ። አመልካቾችን የሚገመግመውና ሊያነጋግርዎት የሚወስነው JobEthiopia ሳይሆን አሰሪው ነው። ማመልከቻ መመለስ ሁኔታውን የሚቀይር ቢሆንም ቀድሞ የተጋሩ መዝገቦችን አያጠፋም።",
        ],
      },
      {
        heading: "8. የሌላ አካል ማስታወቂያዎች፣ ድረ-ገፆችና አገናኞች",
        paragraphs: [
          "አንዳንድ የሥራ ማስታወቂያዎችና የሙያ ግብዓቶች ከሌላ አካል ሊመጡ ወይም ወደ ውጫዊ ድረ-ገፆች ሊያመሩ ይችላሉ። JobEthiopia እነዚህን ጣቢያዎች አይቆጣጠርም፤ ስለ ይዘታቸው፣ መገኘታቸውና የግላዊነት አሠራራቸው ኃላፊነት አይወስድም። አገናኝ መኖር ድጋፍ ማለት አይደለም። መረጃ ከመስጠትዎ በፊት የማንኛውም ውጫዊ ጣቢያ ውሎችንና መመሪያዎችን ይገምግሙ።",
        ],
      },
      {
        heading: "9. ማጭበርበር መከላከልና ሪፖርት ማድረግ",
        paragraphs: [
          "አጠራጣሪ የሆነ ማስታወቂያ ወይም መልእክት ካዩ ገንዘብ ወይም የግል ሰነዶችን አይላኩና ለእኛ ያሳውቁን። ተጠቃሚዎችን ለመጠበቅ ምርመራ ማድረግ፣ ይዘት ማውጣት ወይም መለያዎችን ማገድ እንችላለን። አሰሪዎች እጩዎችን በራሳቸው ሕጋዊ ሂደት ማረጋገጥ አለባቸው።",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "10. ስለ ሥራ ወይም መገኘት ምንም ዋስትና የለም",
        paragraphs: [
          "JobEthiopia ስራን፣ ቃለ-መጠይቅን፣ ከአሰሪው ምላሽን ወይም ማስታወቂያው መገኘቱን አያረጋግጥም። ማስታወቂያዎች በማንኛውም ጊዜ ሊሞሉ፣ ሊዘጉ፣ ሊስተካከሉ ወይም ሊወገዱ ይችላሉ። በጣቢያው ያለው መረጃ ለአጠቃላይ መመሪያ የሚሆን እንጂ ሙያዊ ምክር አይደለም።",
        ],
      },
      {
        heading: "11. የኃላፊነት ወሰን",
        paragraphs: [
          "በሚመለከታቸው ግዴታ ያለው ሕግ በሚፈቅደው ከፍተኛ ገደብ ውስጥ፣ JobEthiopiaና አስኪያጁ በጣቢያው አጠቃቀም፣ በሌላ አካል ይዘት ወይም በእጩዎችና አሰሪዎች መካከል ባሉ ጉዳዮች ምክንያት ለሚደርሱ ቀጥተኛ ያልሆኑ ኪሳራዎች፣ ያጡ ትርፎች፣ ያጡ ዕድሎች ወይም ጉዳቶች ኃላፊነት አይወስዱም። በሕግ ሊገለል የማይችልን ኃላፊነት ግን እነዚህ ውሎች አያገልልም። በሚመለከታቸው ሕግ ያሉዎት የሕጋዊ መብቶች ሳይነኩ ይቀራሉ።",
        ],
      },
      {
        heading: "12. ለውጦች፣ ማነጋገሪያና የማሻሻያ ሂደት",
        paragraphs: [
          `አገልግሎቱ ሲለዋወጥ እነዚህን ውሎች ልናሻሽላቸው እንችላለን። በላይ ያለው የሚጀምርበት ቀን የዚህ እትም መጀመሪያ ያሳያል፣ የተሻሻሉትንም በዚህ ገፅ እናስቀምጣለን። ስለእነዚህ ውሎች ጥያቄዎች፣ ሪፖርቶች ወይም ማሳወቂያዎች ለ${LEGAL_OPERATOR.name} በ${LEGAL_OPERATOR.email} ሊላኩ ይችላሉ። መረጃ እንዴት እንደሚስተናገድ ለማወቅ የግላዊነት መመሪያውን ይመልከቱ።`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  cookies: {
    metaTitle: "የኩኪ መመሪያ | JobEthiopia",
    metaDescription: "JobEthiopia የሚጠቀማቸው ኩኪዎች፣ የክፍለጊዜ ማከማቻና የአካባቢያዊ ማከማቻ።",
    heading: "የኩኪ መመሪያ",
    intro: [
      "የሚጀምርበት ቀን፡ ኖቬምበር 19፣ 2026።",
      "ይህ መመሪያ JobEthiopia በአሳሽዎ ውስጥ የሚያከማቻቸውን ትናንሽ የመረጃ ቁርጥራጮችና ምክንያቶቻቸውን ያብራራል። ከግላዊነት መመሪያው ጋር አብሮ መነበብ አለበት።",
    ],
    sections: [
      {
        heading: "1. አስፈላጊው የማረጋገጫ ኩኪ",
        paragraphs: [
          "ሲገቡ \"session\" የሚባል የክፍለጊዜ ኩኪ እናስቀምጣለን። ጣቢያው በሁሉም ጥያቄዎችዎ እርስዎን እንዲያውቅ ያደርጋል፣ 7 ቀናትም ይቆያል። HttpOnly ነው፣ SameSite=Lax ይጠቀማል፣ ጣቢያው በHTTPS ሲቀርብ Secure መለያ ይኖረዋል። አስፈላጊ ነው፡ ብሎክ ካደረጉት ወይም ካጠፉት መግባትም ሆነ መለያ የሚጠይቁ ባህሪያትን መጠቀም አይችሉም።",
        ],
      },
      {
        heading: "2. የቋንቋ ምርጫ ኩኪ",
        paragraphs: [
          "\"jobethiopia_locale\" የሚባል ኩኪ የቋንቋ ምርጫዎን (እንግሊዝኛ፣ አማርኛ ወይም አፋን ኦሮሞ) ያስታውሳል። የተወሰነ ጊዜ የሌለው የክፍለጊዜ ኩኪ ነው። ቢያሰናክሉት ጣቢያው በሚቀጥለው ጉብኝትዎ ነባር ቋንቋውን ይጠቀማል።",
        ],
      },
      {
        heading: "3. ጊዜያዊ የመግቢያ ደህንነት ኩኪዎች",
        paragraphs: [
          "በGoogle ወይም Telegram ሲገቡ ለዚያ አንድ የመግቢያ ሙከራ state፣ nonceና PKCE verifier የሚይዙ አጭር ጊዜ ያላቸው ኩኪዎችን እናስቀምጣለን። HttpOnly ናቸው፣ ለመግቢያ መንገዶች ብቻ የተገደቡ ናቸው፣ ከ10 ደቂቃዎች በኋላ መጥፋት ሲሆን መግቢያው ሲጠናቀቅ ይጸዳሉ። ቢያሰናክሉት በGoogle ወይም Telegram መግባት አይሠራም።",
        ],
      },
      {
        heading: "4. የመጀመሪያ-ወገን ትንታኔ ያለ ክትትል ኩኪዎች",
        paragraphs: [
          "ትንታኔው በራሳችን አገልጋዮች ላይ ይመዘገባል። የተፈቀደላቸው ክስተቶችና የገፅ መንገድ ንድፎችን ብቻ ይጠቀማል፤ ኩኪዎችን አያስቀምጥም፣ የማስታወቂያ መለያዎችን አያነብም፣ የአይፒ አድራሻ፣ የአሳሽ መረጃ፣ የኢሜይል አድራሻ ወይም የተጠቃሚ መለያ አይሰበስብም። ክስተቶች ለ365 ቀናት ይቀመጣሉ። ይህ ትንታኔ ለማስታወቂያ ጥቅም ላይ አይውልም።",
        ],
      },
      {
        heading: "5. የአካባቢያዊ የአሳሽ ማከማቻ",
        paragraphs: [
          "የቃለ-መጠይቅ ዝግጅት መሳሪያው ምልክት ያደረጓቸውን ነገሮች በአሳሽዎ localStorage ውስጥ ያከማቻል፣ ገፁ ሲመለሱ እንዲቆዩ። ይህ መረጃ በመሳሪያዎ ላይ ይቀራል፣ ወደ አገልጋዮቻችን አይላክም። በማንኛውም ጊዜ በአሳሽዎ የጣቢያ-መረጃ ቅንብሮች ማጽዳት ይችላሉ።",
        ],
      },
      {
        heading: "6. ወደፊት ሊመጡ የማስታወቂያ ኩኪዎች",
        paragraphs: [
          "በአሁኑ ጊዜ ምንም የማስታወቂያ ኩኪ አይጠቀሙም። JobEthiopia Google AdSense ወይም ሌላ የማስታወቂያ አውታረ መረብ በአሁኑ ጊዜ አልተቀናጀም። ወደፊት ማስታወቂያ ከተጀመረ Googleና ሌሎች የማስታወቂያ አጋሮች ማስታወቂያ ለማድረስና ለግል ለማበጀት ኩኪዎችን ወይም ተመሳሳይ ቴክኖሎጂዎችን ሊጠቀሙ ይችላሉ። ይህ ከመሆኑ በፊት የግላዊነት መመሪያውንና ይህን ገፅ እናሻሽላለን፣ በሚመለከታቸው ሕግ የሚፈለገውን ፈቃድና ማሳወቂያም እናስከብራለን።",
          "ስለ ግላዊ ያልሆነ ማስታወቂያ መርጦ መውጣት መረጃ እዚህ ይገኛል፡",
        ],
        links: adsLinks("የDigital Advertising Alliance ምርጫዎች"),
      },
      {
        heading: "7. ኩኪዎችን ማስተዳደር",
        paragraphs: [
          "በአሳሽዎ ቅንብሮች ኩኪዎችን ማገድ ወይም ማጥፋት ይችላሉ። ከላይ የተገለጹትን አስፈላጊ ኩኪዎች ቢያሰናክሉ መግባትና ሌሎች የጣቢያ ተግባራት እንደሚጎዱ ልብ ይበሉ። ኩኪዎችን መሰረዝ በአገልጋዮቻችን ላይ ያለውን የመለያ ወይም የማመልከቻ መረጃ አያጠፋም።",
        ],
      },
      {
        heading: "8. ማነጋገሪያ",
        paragraphs: [
          `ስለዚህ የኩኪ መመሪያ ጥያቄ ካለዎት ${LEGAL_OPERATOR.name} በ${LEGAL_OPERATOR.email} ሊያገኙት ይችላሉ።`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

const om: LegalContent = {
  privacy: {
    metaTitle: "Siyaasa Dhuugaa | JobEthiopia",
    metaDescription:
      "JobEthiopia odoo dhuugaa akkamitti akka funaantu, itti fayyadamtu, hirttuu fi eeguu.",
    heading: "Siyaasa Dhuugaa",
    intro: [
      "Guyyaa eessaa jalqabe: Sadaasa 19, 2026.",
      `JobEthiopia kan bulchu ${LEGAL_OPERATOR.name}, dhalataa biyya keessaatti hojii dhuugaa ta'ee jira. As keessatti "nuti" fi "kan keenyatti" jedhu ${LEGAL_OPERATOR.name} JobEthiopia bulchu jechuudha. Siyaasi kun odoo dhuugaa maal funaannattu, maaliif itti fayyadamtu, eenyuu waliin hirttu, yeroo hamma darbu eeguu fi filannoo sii jiru ibsa.`,
      `Saayitiin keenyaa ${LEGAL_OPERATOR.website} dha. Gaaffii siyaasa kanaa qabta ta'e ${LEGAL_OPERATOR.email} dhaan nu qunnami.`,
    ],
    sections: [
      {
        heading: "1. Odoo funaannattu",
        paragraphs: [
          "Herregaa fi saanduqa namootaa. Yeroo galattoon maqaa kee guutu, imeelii fi jecha icciitii funaanna. Jechi icciitii kee akka saltii qabameetti (scrypt hash) qofa kuufama; iddoo ulfaataa hin kuufamu. Haala mirkaneessaa imeelii, maqaa herregaa fi haala herregaa kaa'uu nutti kuufama. Saanduqa keessatti lakkoofsa bilbilaa, iddoo, ibsa hojii, waggaa hojii fi barumsa dabaluu dandeessa.",
          "CV fi kaadhuwwan uwwisaa. Meeshaalee hojii keenyatti yoo fayyadamtellee, CV kee kan barreessite kuufanna: ibsa hojii, lakkoofsa bilbilaa, iddoo, weebsaayitii, hojii furyii, barumsa, dandeettii fi shiboo'ii. Kaadhuyyuu kan uumte kuufanna: maqaa hojii, warra qacaru, fudhatuu fi zaayita kaadhuhii. Maqaa fi imeelii kee herregaa keessaa fudhanna; saanduqa ykn kaadhutti addaan hin kuufannu.",
          "PDF'n darbii galchite. Yeroo CVn darbii galchitu, PDFn kee iddoo kuusaa S3-fi walqixa ta'ee darbii keessatti kuufama; kaallii kuusaa, maqaa faayilii, gosa MIME fi guddina isaa kanniin immoo database keessatti galchina. Faayiloonni iddoo hawaatti hin kaa'aman.",
          "Darbiiwwan. Hojii darbii galchitte, zaayita kaadhuhii darbii galchite, haala darbii fi yeroo, fi dubbisa warra qacaraa kan darbii kanaa galchina. Yeroo galchittellee maqaa fi imeelii kee imeelii mirkaneessaa fi warra qacaraa beeksisuuf fayyadanna.",
          "Warra qacaraa fi dhaabota. Galii warra qacaraa maqaa, imeelii, jecha icciitii fi lakkoofsa bilbilaa hojii eessaa jiru, fi maqaa dhaabaa, industirii, weebsaayitii, lakkoofsa bilbilaa, ibsa fi iddoo dabalatee funaanna. Hojjattonni dubbisa madda'uu qaban. Yeroo nama gamaatti afferte imeelii kenname kuufanna; yeroo nama kun gamaatti mul'atu maqaa fi imeelii isaa gamaattii birootti mul'atu.",
          "Galii Google fi Telegramtiin. Yeroo Googletiin galattu ID herregaa Google, imeelii, maqaa, maqaa dhalootaa fi maqaa abbaa, fi URL fakkaattii kee fudhanna. ID, imeelii fi maqaa mul'atu kuufanna; URL fakkaattii immoo kuufamaa hin fudhannu. Yeroo Telegramtiin galattu ID fi maqaa mul'atu kee (maqaa Telegram keessaa ta'ee darbuu danda'u) fudhanna. ID tawwaa, zaayita, ykn jecha icciitii kee hin fudhannu; hin kuufannus.",
          "Odoo bilbilaa. Yeroo bilbiliin galattu lakkoofsa bilbilaa kee unka iddoo biyyaa (E.164) keessatti, hash koodii yeroo tokkoo fi yeroo mirkaneessaa kuufanna. Darbii SMS ummata keessa yeroo ammaa hin hojjetu: koodii uumuu fi kuufuu dandeessa garuu darbii isaa geessisuuf darbii SMS kallattii hin jiru; kanaaf galii bilbilaa ummata keessa yeroo ammaa hin hojjetu.",
          "Hojii kuufame, beeksannaa fi himannaa. Hojii kuufattu, beeksannaa hojii uumtu (maqaa, jeessii, gosa hojii, dandeettii, iddoo, unka hojii, yeroo fi afaan), hash kaallii dhiisuu, galcha darbii beeksannaa fi himannaa keessa kaa'uu kuufanna. Himannaan warra qacaraaf darbii maqaa darbii qabuu danda'a.",
          "Galcha nageenyaa fi xiinxalaa. Hash kaallii yeroo, yeroo darbii fi yeroo fayyadamaa dhuma, galcha galii kufaa (imeelii hashed fi yeroo kennameetti IP) fi galcha hojii IDs nama hin beekamuu qaban kuufanna. Xiinxalli keenyaa kallattii jalqabaa kaallii hin fayyadamu; odoo dhuugaa bakka bu'ee karaa (route) fayyadama. IP, user-agent, imeelii fi ID namootaa hin funaannattu.",
        ],
      },
      {
        heading: "2. Maaliif odoo keetti fayyadamna",
        paragraphs: ["Odoo olitti ibsame kanaaf sababoota kanaaf fayyadanna:"],
        bullets: [
          "herregaa kee uumuu fi eeguu, fi galuu dandeessisuuf;",
          "barbaacha hojii, darbii fi walitti qabaa hojii kaa'uu fi hojjetuu;",
          "warra qacaraaf saanduqa, kaadhu fi CV darbii keetti darbattu akka mul'atu taasisaaf;",
          "imeelii gargaarsaa kan akka mirkaneessaa, jecha icciitii haaromsuu, haala darbii fi beeksannaa hojii darbisuuf;",
          "gugguu, dogoggoraa fi galii hayyama ala ta'ee ittisuu fi galcha hojii eeguuf;",
          "xiinxala dhuugaa eeguutiin fayyadama waliigalaa saayitii hubachuuf; fi",
          "seera akaakuu jiru cabsuu fi gaaffii kee deebisuu fi.",
        ],
      },
      {
        heading: "3. Odoo kee eenyuu waliin hirttu",
        paragraphs: [
          "Warra qacaraa. Yeroo darbii galchitte, dhaabni warra qacaraa kallattii koo maqaa, imeelii, saanduqa, kaadhu fi CV darbii keetti darbu akka argattu dandeessa. JobEthiopia warra qacaraa miti; murtee qacaraa hin godhu.",
          "Darbii gargaarsaa. Saayitii kaa'uuf gargaarsa kuusaa fi database, imeelii darbisuuf Resend, galii Googlefiif Google (fi yeroo saayitiin ijaarama fonts uumuu), galii Telegram fi beeksannaa hojii kan kallattii jiruuf Telegram, darbii fuulaa fi odoo fudhachuu kan kallattii jiruuf Meta/Facebook, fi faayiloota CV kuufuuf S3 fi walqixa ta'ee darbii keessatti kuusuu (fakkeenyaaf Amazon S3 ykn Cloudflare R2) fayyadamna. Darbiiwwan fi naannoon sirriin haala kaa'uu irratti hundaa'u.",
          "Odoo dhuugaa kee hin gurgurru. Yeroo ammaa odoo dhuugaa gargaarsa beeksannaa waliin hin hirttu.",
        ],
      },
      {
        heading: "4. Kaallii fi teeknooloojii waliin",
        paragraphs: [
          "Galuu fi kaallii yeroo kallattii, kaallii filannoo afaanii fi kaallii yeroo gabaabaa galii Google ykn Telegram keetti fayyadamna. Yeroo ammaa beeksannaa ykn kaallii hordoffii biroo hin fayyadamnu. Xiinxalli keenyaa kallattii jalqabaa fi kaallii ala dha. Meeshaan qophii gaaffii fi deebii localStorage afaan keetti fayyadama. Bal'inaaf Siyaasa Kaallii keenyai ilaali.",
        ],
      },
      {
        heading: "5. Beeksannaa",
        paragraphs: [
          "JobEthiopia yeroo ammaa Google AdSense ykn gargaarsa beeksannaa biroo hin kallattii'e; kaallii beeksannaa yeroo ammaa hin fayyadamnu.",
          "Yeroo darbii Google AdSense ykn beeksannaa biroo dabaluu dandeessa. Yeroo beeksannaan darbii keessa jiru Google fi darbii beeksannaa biroo kaallii ykn teeknooloojii waliin beeksannaa darbii fi dhuugaa taasisaaf fayyadamuu danda'u; akka IP fi zaayita keetti fudhachuu danda'u. Beeksannaa darbii keessa jiruuf, siyaasa kanaa duraan hiruu fi haaromsina.",
          "Beeksannaa dhuugaa taasisee dhiisuu (opt-out) ilaalchisee gargaarsa armaan gadiitiin baruu dandeessa. Kaalliiwwan kunneen yeroo darbii kallattii kenname; yeroo ammaa kaalliin beeksannaa hin kaa'amuu kanaaf yeroo ammaa wantaa hin jijjiiran.",
        ],
        links: adsLinks("Filannoo Digital Advertising Alliance"),
      },
      {
        heading: "6. Yeroo hamma odoo eeguu",
        paragraphs: [
          "Xiinxalaa kallattii jalqabaa guyyaa 365f eeguuf qophii ta'a; yeroo kana booda haqama. Kaallii yeroo guyyaa 7, kaallii OAuth yeroo 10, kaallii mirkaneessaa imeelii sa'aatii 24, kaallii haaromsaa jecha icciitii daqiiqaa 30, koodii yeroo tokkoo daqiiqaa 5, fi galcha galii kufaa yeroo yerootti haqamu.",
          "Yeroo ammaa darbiiwwan, faayiloonna CV, dubbisa warra qacaraa, galcha hojii fi kuusaa darbii (backup)af yeroo murtaa'ee hin qabnu. Odoo kana tajaajila kaa'uuf, seera cabsuu fi walii galtee furuuf barbaachisutti fudhanna; boodas ni haqna ykn maqaa isaa ni haqna.",
          "Yeroo ammaa herregaa ofii haquu (self-service) hin jiru. Haquu gaafachuuf nu qunnami.",
        ],
      },
      {
        heading: "7. Mirgi fi filannoo kee",
        paragraphs: [
          "Odoo dhuugaa kee akka sii ibsinuu, odoo dogoggoraa akka sir'essinuu ykn odoo keetti jiru akka haqannuu gaafattu dandeessa. Itti dabaluun, imeelii beeksannaa keetti jiruun ykn herregaa keessaa beeksannaa hojii dhiisuu, kaallii yeroo jiru bulchuu, fi meeshaalee saayitii kaa'uu fi haquu ykn dhiisuu dandeessa.",
          "Darbii dhiisuu (withdraw) haala isaa qofa jijjiira; galcha darbii fi CV kee sirna keessaa hin haqu.",
          "Gaaffii darbisuuf ${LEGAL_OPERATOR.name} ${LEGAL_OPERATOR.email} dhaan qunnami. Duraan maqaa kee mirkaneessuu nutti barbaachisuu danda'a; seerri akaakuu jiru immoo wantaa haquu ykn jijjiiruu dandeenyu daangessuu ykn tursuu danda'a.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "8. Nageenya",
        paragraphs: [
          "Tajaajilaaf malattoo ta'an fayyadamna: jecha icciitii scrypt salted, kaallii yeroo fi koodii yeroo tokkoo kaallii hashed, HTTPS, gaaffii fi darbii CSRF ittisuu, hayyama maqaa irratti hundaa'ee, CV dhuugaa mirkaneessaa fi galcha hojii. Tajaajiloonni internetii hundi guutuun nageenya qaban hin ta'u; kanaaf jecha icciitii kee eeguu fi galii hayyama alaa shakkattellee nutti himuu.",
        ],
      },
      {
        heading: "9. Jijjiirama siyaasa kanaa",
        paragraphs: [
          "Siyaasa kana yeroo tajaajilli jijjiiramu haaromsuu dandeessa. Guyyaa olitti ibsame yeroo koppii kuni eessaa jalqabe agarsiisa. Yeroo yeroo bittinnaa'ee fuula kana ilaali.",
        ],
      },
      {
        heading: "10. Qunnamtii",
        paragraphs: [
          `JobEthiopia ${LEGAL_OPERATOR.name}, Itoophiyaa keessa hojii dhuugaa ta'een bulchama. Saayitii: ${LEGAL_OPERATOR.website}. Gaaffii dhuugaa fi gaaffii biroo ${LEGAL_OPERATOR.email} dhaan darbisi.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  terms: {
    metaTitle: "Shartii Fayyadamaa | JobEthiopia",
    metaDescription: "Saayitii fi tajaajila JobEthiopia fayyadamuu ilaalchisee seeronni.",
    heading: "Shartii Fayyadamaa",
    intro: [
      "Guyyaa eessaa jalqabe: Sadaasa 19, 2026.",
      `Shartiin Fayyadamaa kun saayitii JobEthiopia fayyadamuu keetiin bulchama. Isaa immoo ${LEGAL_OPERATOR.name}, Itoophiyaa keessa hojii dhuugaa ta'ee (${LEGAL_OPERATOR.website}) bulchuun ta'uu dandeessa. Saayitii fayyadamuun shartii kana fudhachuu keetti hirkatta. Yoo hin fudhachuullee tajaajila hin fayyadami.`,
    ],
    sections: [
      {
        heading: "1. Tajaajila ilaalchisee",
        paragraphs: [
          "JobEthiopia tajaajila hojii fi ogummaati. Beksannaa hojii agarsiisa; namoota hojii barbaadan profaayilii fi CV ijaaruuf gargaara; darbiiwwan immoo dhaaba beeksannaa kaa'etti darbisiisa. JobEthiopia warra qacaraa miti; murtee qacaraa hin godhu; walii galtee hojii darbii fi warra qacaraa jidduu jirtu keessa hin hirmattu.",
        ],
      },
      {
        heading: "2. Herregaa kee fi fayyadama hayyama qabu",
        paragraphs: [
          "Kaallii galii kee eeguu fi goesa herregaa keetti ta'uuf deemuu itti gaafatamuummaa keeti. Tajaajila kana seeraaf qofa fayyadami. Wantaa seeraa ala, dogoggoraa, adda baasuu fi miidhuu hin kaa'u; namoota biroo fakkaachuu hin yaali; galii hayyama alaa hin yaali; saayitii hin qottoon, hin baay'isiin, hojii isaa hin balleessin. Shakkii yoo jiraate iddoo qunnamtii gadiitiin nutti himi.",
        ],
      },
      {
        heading: "3. Itti gaafatamuummaa darbii galaattootaa",
        paragraphs: [
          "Odoo profaayilii, CV, kaadhuyii fi darbii keetti jiru sirrii ta'uun itti gaafatamuummaa keeti. Darbii duraan ilaali. Odoo dogoggoraa ykn darbii siif hin ta'u galchuu yoo ta'e herregaa kee daangeffamuu ykn haqamuu danda'a.",
        ],
      },
      {
        heading: "4. Itti gaafatamuummaa warra qacaraa",
        paragraphs: [
          "Warra qacaraa beksannaa sirrii, yeroo jiru fi seeraan darbii ta'u qofa ka'uu qaban; ibsa hojii fi mallattoo (logo) darbatan darbii godhuuf mirgi isaanii jiraachuu qaba. Hala qacaraa isaanii seera jiru, seera carraa walqixa fi odoo darbii galattootaa dabalatee cabsuu dhiisun isaanii itti gaafatamuummaa isanii. Beksannaa dogoggoraa ykn shakkiin qabu haqamuu danda'a; darbii immoo daangeffamuu danda'a.",
        ],
      },
      {
        heading: "5. Dhuugaa kee kan dhalkeetti",
        paragraphs: [
          "CV, kaadhuyii fi dhuugaa biroo uumte fi darbite kan keeti. JobEthiopiaaf hayyama murtaa'ee, adda hin ta'in, kaffaltii ala ta'ee dhuugaa kana tajaajila kaa'uuf, darbii keetti darbattuuf warra qacaraa agarsiisuu dabalatee fudhachuu, kuufachuu, nattinuu fi agarsiisuu ni kenna. Hayyaman kun yeroo dhuugaa ykn herregaa kee haqattu darbii kofa'uu danda'a; seeraan ykn nageenyaaf Siyaasi Dhuugaa keetti ibsamutti kuufamuu qaba ta'e felti.",
        ],
      },
      {
        heading: "6. Dhuugaa fi mallattoo warra qacaraa",
        paragraphs: [
          "Warra qacaraa ibsa hojii, mallattoo fi meeshaalee biroo isanii kan dhalkeetti. Yeroo darbatan saayitii irratti fi yeroo darbii qophii ta'etti kan akka Telegram fi Facebook kallattiiwwan irratti tajaajilaa, agarsiisaa fi facaasuu hayyama murtaa'ee ni kenna. Hayyama kana darbii keessatti mirgi barbaachisu siif jiraachuu mirkaneessa.",
        ],
      },
      {
        heading: "7. Darbiiwwan fi warra qacaraa waliin hiruu",
        paragraphs: [
          "Yeroo darbii galchitte saanduqni, kaadhun fi CVn kee dhaaba warra qacaraa hojii kanaa keessa jiruuf darbii ta'u. Warra qacaraa (JobEthiopia miti) darbii harkaa fuudhu fi si qunnamuu murtee godha. Darbii dhiisuu haala isaa jijjiira; wantaa duraan hirame hin haqu.",
        ],
      },
      {
        heading: "8. Beksannaa, saayitii fi kaallii biroo",
        paragraphs: [
          "Beksannaa fi qophii ogummaa tokko tokko biroo jiruun dhufuu ykn saayitii birootti geessu danda'u. JobEthiopia saayitii kana hin to'atu; zaayita isanii, argachuu isanii fi siyaasa dhuugaa isanii itti gaafatamaa miti. Kaalliin jiraachuu darbuumaa (endorsement) hin agarsiisu. Odoo darbii saayitii biroo kaa'uu duraan shartii fi siyaasa isanii ilaali.",
        ],
      },
      {
        heading: "9. Gugguu ittisuu fi beeksisuu",
        paragraphs: [
          "Beksannaa ykn zaayita shakkii qabu yoo arttellee maallaqa ykn dhuugaa kee hin darbisin; nutti beeksisi. Tajaajilatuu eeguuf sakatta'uu, zaayita haquu ykn herregaa darbii kaa'uu dandeessa. Warra qacaraa darbii galattootaa karaa isanii seeraan mirkaneessuu qaban.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "10. Hojii ykn argachuu hin mirkaneessu",
        paragraphs: [
          "JobEthiopia hojii, gaaffii fi deebiin warra qacaraa ykn beksannaa argachuu hin mirkaneessu. Beksannoon yeroo hunda darbii galamuu, cufamuu, sir'eeffamuu ykn haqamuu danda'u. Odoo saayitii kaa'uuf qophii waliigalaa fi gorsa ogummaa miti.",
        ],
      },
      {
        heading: "11. Daangaa itti gaafatamuummaa",
        paragraphs: [
          "Seera dirqamaa jiruun hayyame darbii keessatti, JobEthiopia fi bulchaan isaa fayyadama saayitii, zaayita biroo fi walii galtee darbii galattootaa fi warra qacaraa irraa kan ka'e kasaaraa kallattii ala, fayyidaa darbee, carraa darbee fi miidhuu itti gaafatamaa hin ta'u. Shartiiwwan kun seeraan haqamuu hin dandeenye itti gaafatamuummaa hin haqu. Mirgi seeraa kee seera jiruun eeguu keessa jiru tasaa hin tuqamu.",
        ],
      },
      {
        heading: "12. Jijjiirama, qunnamtii fi haaromsa",
        paragraphs: [
          `Tajaajilli yeroo jijjiiramu shartii kana haaromsuu dandeessa. Guyyaa olitti ibsame koppii kana eessaa jalqabe agarsiisa; shartii haaromsame fuula kana irratti kaa'uun beeksisna. Gaaffii, beeksannaa fi himannaa shartii kanaa ilaalchisee ${LEGAL_OPERATOR.name} ${LEGAL_OPERATOR.email} dhaan darbisi. Odoo akkamitti akka harkaa fuudhamu beekuuf Siyaasi Dhuugaa ilaali.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },

  cookies: {
    metaTitle: "Siyaasi Kaallii | JobEthiopia",
    metaDescription: "Kaallii, kuufama yeroo fi kuufama iddoo biroo JobEthiopia fayyadamu.",
    heading: "Siyaasi Kaallii",
    intro: [
      "Guyyaa eessaa jalqabe: Sadaasa 19, 2026.",
      "Siyaasi kun odoo xixiqqoo JobEthiopia afaan keetti kuufatu fi sababaa isanii ibsa. Siyaasi Dhuugaa waliin dubbisuu qaba.",
    ],
    sections: [
      {
        heading: "1. Kaallii mirkaneessaa barbaachisaa",
        paragraphs: [
          "Yeroo galattu kaallii yeroo \"session\" jedhamu kaa'uun gaafattuu hunda keessa si beekssisa; guyyaa 7 turu. HttpOnly dha, SameSite=Lax fayyadama, saayitii HTTPS keessa yoo ture immoo Secure ta'ee agarsiifama. Barbaachisaa dha: yoo darbii kaa'uu ykn haquu gaaffattellee galuu fi tajaajila herregaa barbaadu hin fayyadamu.",
        ],
      },
      {
        heading: "2. Kaallii filannoo afaanii",
        paragraphs: [
          "Kaalliin \"jobethiopia_locale\" jedhamu filannoo afaanii kee (English, Amharic ykn Afaan Oromoo) yaadha. Kaallii yeroo yeroo murtaa'ee hin qabu. Yoo darbii kaa'elte saayitiin yeroo itti dabartu afaan isaa jalqabaa fayyadama.",
        ],
      },
      {
        heading: "3. Kaallii nageenyaa galii yeroo gabaabaa",
        paragraphs: [
          "Yeroo Google ykn Telegramtiin galattu kaallii gabaabaa yeroo kanaaf state, nonce fi PKCE verifier qaban kaa'uun. HttpOnly dha, karaa galii qofaaf daangaa'e, daqiiqaa 10 booda darbii xumuramee yoo ta'e haqamu. Yoo darbii kaa'elte galii Google fi Telegram hin hojjetu.",
        ],
      },
      {
        heading: "4. Xiinxala kallattii jalqabaa kaallii hordoffii ala",
        paragraphs: [
          "Xiinxalli keenya ofii keenya server keessatti galama. Zaayita hayyama qabu fi karaa fuulaa fayyadama; kaallii hin kaa'u, ID beeksannaa hin dubbisu, IP, user-agent, imeelii fi ID dhuugaa hin funaannattu. Zaayitni guyyaa 365 turu. Xiinxalli kun beeksannaaaf hin fayyadamu.",
        ],
      },
      {
        heading: "5. Kuufama iddoo biroo (local storage)",
        paragraphs: [
          "Meeshaan qophii gaaffii fi deebii waan mallattoo kaa'atte localStorage keessa kaa'uun yeroo fuula irra deebi'attu akka turu godha. Odoo kun meeshaa keetti turu; server keenyatti hin darbii'u. Yeroo hunda saayitii fi iddoo meeshaa kaa'uu keessatti haquu dandeessa.",
        ],
      },
      {
        heading: "6. Kaallii beeksannaa yeroo darbii",
        paragraphs: [
          "Yeroo ammaa kaalliin beeksannaa hin fayyadamu. JobEthiopia yeroo ammaa Google AdSense fi gargaarsa beeksannaa biroo hin kallattii'e. Yeroo darbii beeksannaa eessaa jiraateellee, Google fi darbii beeksannaa biroo kaallii ykn teeknooloojii waliin beeksannaa darbii fi dhuugaa taasisaaf fayyadamu danda'u. Kun duraan Siyaasi Dhuugaa fi fuula kana haaromsuu fi hayyama seeraan barbaachisu eessaa jiru taasisa.",
          "Beeksannaa dhuugaa taasisee dhiisuu (opt-out) ilaalchisee gargaarsa armaan gadiitiin baruu dandeessa:",
        ],
        links: adsLinks("Filannoo Digital Advertising Alliance"),
      },
      {
        heading: "7. Kaallii bulchuu",
        paragraphs: [
          "Kaallii afaan keetti darbii kaa'uu ykn haquu dandeessa. Kaallii barbaachisaa olitti ibsamu yoo darbii kaa'elte galii fi tajaajila biroo akka hin hojjetellee hubadhu. Kaallii haquun herregaa fi darbii server keenya keessa jiru haquu miti.",
        ],
      },
      {
        heading: "8. Qunnamtii",
        paragraphs: [
          `Gaaffii Siyaasi Kaallii kanaa qabta ta'e ${LEGAL_OPERATOR.name} ${LEGAL_OPERATOR.email} dhaan qunnami.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

/** Server-only legal content keyed by the site's existing locale type. */
export const legalContent: Record<Locale, LegalContent> = { en, am, om };

export function getLegalContent(locale: Locale): LegalContent {
  return legalContent[locale];
}
