import type { Locale } from "@/lib/i18n/locale";
import type { LegalDocument } from "@/lib/legal/content";
import { LEGAL_OPERATOR, mailtoOperator } from "@/lib/legal/operator";

export type PublicInformationDocument = LegalDocument;

export type PublicInformationContent = {
  about: PublicInformationDocument;
  faq: PublicInformationDocument;
};

const emailLink = (label: string) => ({
  label,
  href: mailtoOperator(),
});

const en: PublicInformationContent = {
  about: {
    metaTitle: "About JobEthiopia",
    metaDescription:
      "Learn what JobEthiopia is, who it serves, and how the platform handles jobs, applications, languages, and trust.",
    heading: "About JobEthiopia",
    intro: [
      "JobEthiopia is an Ethiopian job and career platform. It helps job seekers find opportunities and helps organizations publish vacancies and review applications.",
    ],
    sections: [
      {
        heading: "1. What you can do",
        paragraphs: ["The platform provides tools for both job seekers and organizations:"],
        bullets: [
          "search and browse jobs by category, profession, location, and organization;",
          "save jobs and create job alerts;",
          "apply to jobs and view application details and status;",
          "build a profile, CV, and cover letters; and",
          "receive in-app notifications about account and application activity.",
        ],
      },
      {
        heading: "2. Who uses JobEthiopia",
        paragraphs: [
          "Candidates can register, manage a profile and password, upload a private PDF resume, and use career tools.",
          "Employers request onboarding, receive staff approval, manage a dashboard, create and close jobs, review applications, and manage team members.",
          "Staff users moderate users, organizations, and jobs, maintain categories, professions, and locations, manage job sources, and review audit records.",
        ],
      },
      {
        heading: "3. How hiring works",
        paragraphs: [
          "JobEthiopia displays vacancies and passes applications to the organization that posted them. JobEthiopia is not the employer, does not make recruitment decisions, and is not a party to an employment contract between a candidate and an employer.",
          "When an application is submitted, the relevant employer organization can review the candidate details, cover letter, and resume shared with that application.",
        ],
      },
      {
        heading: "4. Languages",
        paragraphs: [
          "The interface supports English, Amharic, and Afaan Oromo. Changing the interface language does not automatically translate vacancy content, so job descriptions may remain in the language provided by the employer.",
        ],
      },
      {
        heading: "5. Trust and safety",
        paragraphs: [
          "Jobs go through a moderation workflow. Resumes are stored in private object storage and downloaded only through authenticated access. Role-based permissions and audit records help protect accounts and administrative actions.",
          "If a vacancy or message seems suspicious, do not send money or documents. Report it using the contact details below.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "6. Technology",
        paragraphs: [
          "JobEthiopia is built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, and Zod.",
        ],
      },
      {
        heading: "7. Contact",
        paragraphs: [
          `Questions, feedback, and job-listing enquiries can be sent to ${LEGAL_OPERATOR.email}.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
  faq: {
    metaTitle: "Frequently Asked Questions | JobEthiopia",
    metaDescription:
      "Common questions about JobEthiopia accounts, applications, resumes, languages, alerts, and reporting concerns.",
    heading: "Frequently asked questions",
    intro: [
      "These answers explain how JobEthiopia works today. For privacy details, see the Privacy Policy; for platform rules, see the Terms of Use.",
    ],
    sections: [
      {
        heading: "1. Do I need an account to browse jobs?",
        paragraphs: [
          "You can browse public job listings without signing in. An account is needed to save jobs, apply, create alerts, manage notifications, and use candidate career tools.",
        ],
      },
      {
        heading: "2. How do I apply for a job?",
        paragraphs: [
          "Sign in, review the vacancy, and submit an application with the information requested by the listing. You may include a cover letter and a resume. You can view application details and status from your account.",
        ],
      },
      {
        heading: "3. Who receives my application?",
        paragraphs: [
          "Your application is sent to the organization responsible for the vacancy. That employer reviews it and decides whether to contact you. JobEthiopia does not make hiring decisions.",
        ],
      },
      {
        heading: "4. Where is my resume stored?",
        paragraphs: [
          "Uploaded PDF resumes are stored in configurable private S3-compatible object storage. The file is not placed in a public folder, and downloads require authenticated access.",
        ],
      },
      {
        heading: "5. Can I use the site in my language?",
        paragraphs: [
          "The interface is available in English, Amharic, and Afaan Oromo. Vacancy content is not automatically translated when you change the interface language.",
        ],
      },
      {
        heading: "6. How do job alerts work?",
        paragraphs: [
          "You can create job alerts from your account using criteria such as keywords, category, profession, location, and employment type. Alert emails include an unsubscribe link.",
        ],
      },
      {
        heading: "7. Does phone sign-in send SMS messages?",
        paragraphs: [
          "Production SMS delivery is not currently implemented. A phone verification code can be generated and stored, but no SMS provider is connected to send it, so phone sign-in is not currently usable in production.",
        ],
      },
      {
        heading: "8. How do I report a suspicious vacancy or request account help?",
        paragraphs: [
          "Do not send money or personal documents to a suspicious contact. Report the issue or request account help using the email address below.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

const am: PublicInformationContent = {
  about: {
    metaTitle: "ስለ JobEthiopia",
    metaDescription:
      "JobEthiopia ምን እንደሆነ፣ ለማን እንደሚያገለግል፣ እና ስራዎችን፣ ማመልከቻዎችን፣ ቋንቋዎችንና ደህንነትን እንዴት እንደሚይዝ ይወቁ።",
    heading: "ስለ JobEthiopia",
    intro: [
      "JobEthiopia የኢትዮጵያ የሥራና የሙያ መድረክ ነው። ሥራ ፈላጊዎች አጋጣሚዎችን እንዲያገኙ፣ ድርጅቶችም የሥራ ማስታወቂያዎችን እንዲያትሙና ማመልከቻዎችን እንዲገመግሙ ይረዳል።",
    ],
    sections: [
      {
        heading: "1. ማድረግ የሚችሉት",
        paragraphs: ["መድረኩ ለሥራ ፈላጊዎችና ለድርጅቶች የሚከተሉትን መሳሪያዎች ይሰጣል፡-"],
        bullets: [
          "ሥራዎችን በምድብ፣ በሙያ፣ በአካባቢና በድርጅት መፈለግና ማሰስ;",
          "ሥራዎችን ማስቀመጥና የሥራ ማንቂያዎችን መፍጠር;",
          "ለሥራ ማመልከት፣ የማመልከቻ ዝርዝሮችንና ሁኔታን ማየት;",
          "መገለጫ፣ ሲቪና የሽፋን ደብዳቤዎች መፍጠር; እና",
          "ስለመለያና ስለማመልከቻ እንቅስቃሴ በመተግበሪያው ውስጥ ማሳወቂያዎችን መቀበል።",
        ],
      },
      {
        heading: "2. JobEthiopiaን የሚጠቀሙት",
        paragraphs: [
          "እጩዎች መመዝገብ፣ መገለጫዎችንና የይለፍ ቃልን ማስተዳደር፣ የግል ፒዲኤፍ ሲቪ ሰቅለው ማስቀመጥና የሙያ መሳሪያዎችን መጠቀም ይችላሉ።",
          "አሰሪዎች የመመዝገቢያ ጥያቄ ያቀርባሉ፣ የሠራተኛ ፈቃድ ይቀበላሉ፣ ዳሽቦርድ ያስተዳድራሉ፣ ሥራዎችን ይፈጥራሉ ወይም ዘጉ፣ ማመልከቻዎችን ይገመግማሉ፣ የቡድን አባላትንም ያስተዳድራሉ።",
          "የሠራተኛ ሚና ያላቸው ተጠቃሚዎች ተጠቃሚዎችን፣ ድርጅቶችንና ሥራዎችን ይገመግማሉ፤ ምድቦችን፣ ሙያዎችንና አካባቢዎችን ያስተዳድራሉ፤ የሥራ ምንጮችን ይቆጣጠራሉ፤ የኦዲት መዝገቦችንም ይመረምራሉ።",
        ],
      },
      {
        heading: "3. የቅጥር ሂደት",
        paragraphs: [
          "JobEthiopia የሥራ ማስታወቂያዎችን ያሳያል፣ ማመልከቻዎችንም ለሚለጥፏቸው ድርጅቶች ያስተላልፋል። JobEthiopia አሰሪ አይደለም፤ የቅጥር ውሳኔ አያደርግም፤ በእጩና በአሰሪ መካከል የሥራ ውል አካልም አይደለም።",
          "ማመልከቻ ሲገባ ተገቢው አሰሪ ድርጅት ከማመልከቻው ጋር የተጋሩትን የእጩ ዝርዝሮች፣ የሽፋን ደብዳቤና ሲቪ ማየት ይችላል።",
        ],
      },
      {
        heading: "4. ቋንቋዎች",
        paragraphs: [
          "በይነገጹ እንግሊዝኛ፣ አማርኛና የኦሮሞ ቋንቋ ይደገፋሉ። የበይነገጽ ቋንቋን መቀየር የሥራ ማስታወቂያዎችን በራስ-ሰር አይተረጉምም፤ መግለጫዎች በአሰሪው በሰጠው ቋንቋ ሊቆዩ ይችላሉ።",
        ],
      },
      {
        heading: "5. መተማመንና ደህንነት",
        paragraphs: [
          "ሥራዎች በግምገማ ሂደት ውስጥ ያልፋሉ። ሲቪዎች በግል ማከማቻ ውስጥ ይቀመጣሉ፣ ለማውረድም ማረጋገጫ ያስፈልጋል። በሚና ላይ የተመሰረቱ ፈቃዶችና የኦዲት መዝገቦች መለያዎችንና የአስተዳደር ድርጊቶችን ለመጠበቅ ይረዳሉ።",
          "የሥራ ማስታወቂያ ወይም መልእክት አጠራጣሪ ከሆነ ገንዘብ ወይም ሰነዶች አትላኩ። ከታች ባለው የእውቂያ መረጃ ያሳውቁን።",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "6. ቴክኖሎጂ",
        paragraphs: [
          "JobEthiopia በNext.js App Router፣ TypeScript፣ Tailwind CSS፣ PostgreSQL፣ Drizzle ORMና Zod የተገነባ ነው።",
        ],
      },
      {
        heading: "7. ማነጋገሪያ",
        paragraphs: [
          `ጥያቄዎች፣ አስተያየቶችና ስለሥራ ማስታወቂያ ጥያቄዎች ወደ ${LEGAL_OPERATOR.email} ሊላኩ ይችላሉ።`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
  faq: {
    metaTitle: "ተደጋግሞ የሚጠየቁ ጥያቄዎች | JobEthiopia",
    metaDescription:
      "ስለ JobEthiopia መለያዎች፣ ማመልከቻዎች፣ ሲቪዎች፣ ቋንቋዎች፣ ማንቂያዎችና ሪፖርቶች የሚጠየቁ የተለመዱ ጥያቄዎች።",
    heading: "ተደጋግሞ የሚጠየቁ ጥያቄዎች",
    intro: [
      "እነዚህ መልሶች JobEthiopia አሁን እንዴት እንደሚሠራ ያብራራሉ። ስለግላዊነት ዝርዝሮች የግላዊነት መመሪያን፣ ስለመድረክ ደንቦች ደግሞ የአጠቃቀም ውሎችን ይመልከቱ።",
    ],
    sections: [
      {
        heading: "1. ሥራዎችን ለማሰስ መለያ ያስፈልገኛል?",
        paragraphs: [
          "የሕዝብ የሥራ ማስታወቂያዎችን ሳይገቡ ማሰስ ይችላሉ። ሥራዎችን ለማስቀመጥ፣ ለማመልከት፣ ማንቂያዎችን ለመፍጠር፣ ማሳወቂያዎችን ለማስተዳደርና የሙያ መሳሪያዎችን ለመጠቀም መለያ ያስፈልጋል።",
        ],
      },
      {
        heading: "2. ለሥራ እንዴት አመልክታለሁ?",
        paragraphs: [
          "ገብተው የሥራውን መግለጫ ይመርምሩና ማስታወቂያው የሚጠይቀውን መረጃ ያካትተው ማመልከቻ ያስገቡ። የሽፋን ደብዳቤና ሲቪ ማከል ይችላሉ። የማመልከቻ ዝርዝሮችንና ሁኔታን ከመለያዎ ማየት ይችላሉ።",
        ],
      },
      {
        heading: "3. ማመልከቻዬን ማን ይቀበላል?",
        paragraphs: [
          "ማመልከቻዎ ለሥራው ኃላፊነት ላለው ድርጅት ይላካል። አሰሪው ይገመግመዋል፣ እርስዎንም ማነጋገር ይወስናል። JobEthiopia የቅጥር ውሳኔ አያደርግም።",
        ],
      },
      {
        heading: "4. ሲቪዬ የት ነው የሚቀመጠው?",
        paragraphs: [
          "የሚሰቀሉ ፒዲኤፍ ሲቪዎች ሊዋቀር በሚችል የግል S3-ተኳሃኝ ማከማቻ ውስጥ ይቀመጣሉ። ፋይሉ በሕዝብ አቃፊ ውስጥ አይደለም፣ ለማውረድም ማረጋገጫ ያስፈልጋል።",
        ],
      },
      {
        heading: "5. ጣቢያውን በቋንቋዬ መጠቀም እችላለሁ?",
        paragraphs: [
          "በይነገጽ እንግሊዝኛ፣ አማርኛና የኦሮሞ ቋንቋ ይገኛሉ። የበይነገጽ ቋንቋን ሲቀይሩ የሥራ ማስታወቂያዎች በራስ-ሰር አይተረጉሙም።",
        ],
      },
      {
        heading: "6. የሥራ ማንቂያዎች እንዴት ይሠራሉ?",
        paragraphs: [
          "ከመለያዎ ቁልፍ ቃላትን፣ ምድብን፣ ሙያን፣ አካባቢንና የሥራ ዓይነትን ጨምሮ መመዘኛዎችን በመጠቀም የሥራ ማንቂያ መፍጠር ይችላሉ። የማንቂያ ኢሜይሎች መቋረጫ አገናኝ ይዘው ይመጣሉ።",
        ],
      },
      {
        heading: "7. በስልክ መግባት ኤስኤምኤስ ይልካል?",
        paragraphs: [
          "በምርት አካባቢ የኤስኤምኤስ መላክ በአሁኑ ጊዜ የለም። የስልክ ማረጋገጫ ኮድ ሊፈጠርና ሊከማች ቢችልም ለመላክ የተገናኘ አገልግሎት አቅራቢ የለም፤ ስለዚህ የስልክ መግቢያ በምርት አካባቢ አሁን አይሠራም።",
        ],
      },
      {
        heading: "8. አጠራጣሪ ሥራ ወይም የመለያ እርዳታ እንዴት ሪፖርት አደርጋለሁ?",
        paragraphs: [
          "ለአጠራጣሪ እውቂያ ገንዘብ ወይም የግል ሰነዶች አትላኩ። ጉዳዩን ወይም የመለያ እርዳታ ጥያቄዎን ከታች ባለው የኢሜይል አድራሻ ይላኩ።",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

const om: PublicInformationContent = {
  about: {
    metaTitle: "Waa'ee JobEthiopia",
    metaDescription:
      "JobEthiopia maalummaa isaa, namoota tajaajilu, akkamitti hojii, gaaffii, afaan fi amanaa itti fayyadamu hubadhu.",
    heading: "Waa'ee JobEthiopia",
    intro: [
      "JobEthiopia daldala hojii fi guddina ogummaa Itoophiyaati. Namoota hojii barbaadan carraa argamsiisuu fi dhaabbiileen beeksisa hojii maxxansuu fi gaaffiiwwan ilaaluuf gargaara.",
    ],
    sections: [
      {
        heading: "1. Maal gochuu dandeessu",
        paragraphs: ["Maddi tajaajilaa namoota hojii barbaadan fi dhaabbiileef meeshaalee kanneen armaan gadii ni dhiyeessa:"],
        bullets: [
          "hojii cunfaa, ogummaa, iddoo fi dhaabaa hordofuu fi ilaaluu;",
          "hojii kuusuu fi akeeka hojii uumuu;",
          "hojiif gaaffii dhiyabuu, bal'ina fi haala gaaffii ilaaluu;",
          "profile, CV fi kaadhala haguuggii uumuu; fi",
          "madda herregaa fi gaaffii tilmaamaa dhaabaa keessatti argachuu.",
        ],
      },
      {
        heading: "2. JobEthiopia eenu fayyadama?",
        paragraphs: [
          "Namoonni hojii barbaadan galtee uumuu, profile fi jecha icciitii bulchuun, CV PDF ofii kuusuu fi meeshaalee ogummaa fayyadamuu danda'u.",
          "Warra qacaraa galii qacaraa gaafatu, mirkannaa hojjettootaa fudhuun, dashboard bulchuun, hojii uumuu fi cufuu, gaaffiiwwan ilaaluun fi garee bulchuun ni danda'u.",
          "Hojjattoonni hayyama qaban fayyadamtoota, dhaabbiilee fi hojiiwwan ni ilaalu; cunfaa, ogummaa fi iddoo ni bulchu; madda hojii ni to'atu; galcha hojii ni ilaalu.",
        ],
      },
      {
        heading: "3. Akkamitti hojii argattu?",
        paragraphs: [
          "JobEthiopia beeksisa hojii ni agarsiisa, gaaffiiwwan immoo dhaabaa beeksisa kaa'etti ni dabarsa. JobEthiopia yeroo hojii miti; murtee hojii hin godhu; kaa'umsa hojii namootaa gidduutti dhaaba miti.",
          "Gaaffii dhiyabameetti dhaabaan itti gaafatamaa beeksisaa maalummaa namootaa, kaadhala haguuggii fi CV waliin qoodame ni ilaala.",
        ],
      },
      {
        heading: "4. Afaanoota",
        paragraphs: [
          "Fulkaan afaan English, Amaaraa fi Afaan Oromoo ni deegfala. Fulkaa jijjiiruun beeksisa hojii ofiin hin hirka'u; ibsa hojii afaan yeroo hojii kaa'aa kennameetti hafuu danda'a.",
        ],
      },
      {
        heading: "5. Ammannaa fi nageenya",
        paragraphs: [
          "Hojiiwwan adeemsa ilaalaa keessa darbu. CVwwan kuusaa dhuugaa keessa kuufamu, buufachuuf immoo mirkaneessa gaafatu. Hayyama madda irraa darbu fi galiiwwan hojii herregaa herregaa fi gochii bulchuu eeguuf gargaaru.",
          "Beekisa hojii yookaan ergaa shakkaamaa yoo arttaa maallaqa yookaan ragaa hin ergattii. Iddoo quunnamtii armaan gadiitti nutti himi.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
      {
        heading: "6. Teeknooloojii",
        paragraphs: [
          "JobEthiopia Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM fi Zod tiin ijaarame.",
        ],
      },
      {
        heading: "7. Quunnamtii",
        paragraphs: [
          `Gaaffii, yaada fi gaaffii beeksisa hojii ${LEGAL_OPERATOR.email} irratti erguu dandeessu.`,
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
  faq: {
    metaTitle: "Gaaffiiwwan yeroo baay'ee gaafataman | JobEthiopia",
    metaDescription:
      "Gaaffiiwwan baramoo waa'ee herregaa JobEthiopia, gaaffii, CV, afaanootaa, akeeka fi rakkoo hirka'uu.",
    heading: "Gaaffiiwwan yeroo baay'ee gaafataman",
    intro: [
      "Deebiin kunniin akkamitti JobEthiopia amma hojii irra oolu ibsa. Bal'ina dhugaa'insaaf Siyaasa Dhuugaa, seera maddaa immoo Shartii Fayyadamaa ilaalaa.",
    ],
    sections: [
      {
        heading: "1. Hojii ilaaluuf herrega barbaachisa?",
        paragraphs: [
          "Beeksisa hojii ummataa seenaa ta'ee ilaaluu dandeessu. Hojii kuusuu, gaaffii dhiyabuu, akeeka uumuu, hirka'uu bulchuun fi meeshaalee ogummaa fayyadamuu herrega gaafata.",
        ],
      },
      {
        heading: "2. Akkamitti hojiif gaaffii dhiyabu?",
        paragraphs: [
          "Seenaa uumuun beeksisa hojii ilaalaa, gaaffii dhiyabuu fi odoota beeksisin gaafatetti dabaluu. Kaadhala haguuggii fi CV dabaluu dandeessu. Bal'ina fi haala gaaffii herrega keessatti ilaaluu dandeessu.",
        ],
      },
      {
        heading: "3. Gaaffiin koo eenatti dhuga?",
        paragraphs: [
          "Gaaffiin koo dhaabaa beeksisaa itti gaafatametti dhuga. Dhaabaan ni ilaala, yoo barbaade immoo sitti dhufee dubbisa. JobEthiopia murtee hojii hin godhu.",
        ],
      },
      {
        heading: "4. CV koo eessaa kuufama?",
        paragraphs: [
          "CVwwan PDF dhiyabaman kuusaa dhugaa S3-ta'ee kan qindeessuu danda'etti kuufamu. Faayilii iddoo ummataa hin kaa'u, buufachuuf immoo mirkaneessa gaafata.",
        ],
      },
      {
        heading: "5. Madda koo afaanatin fayyadamuu danda'aa?",
        paragraphs: [
          "Fulkaan afaan English, Amaaraa fi Afaan Oromoo ni argama. Fulkaa jijjiiruun beeksisa hojii ofiin hin hirka'u.",
        ],
      },
      {
        heading: "6. Akeekni hojii akkamitti hojii godha?",
        paragraphs: [
          "Herrega keessatti cunfaa, ogummaa, iddoo fi gosa hojii fayyadamuun akeeka hojii uumuu dandeessu. Imeelii akeekaa hirka'uu (unsubscribe) lakkoofsa ni qaba.",
        ],
      },
      {
        heading: "7. Seenaa saataluun SMS ni erga?",
        paragraphs: [
          "Hojii ba'umsaa keessatti ergaa SMS amma hin jiru. Koodiin mirkannaa bilbilaa uumamuu fi kuufamuu danda'a; garuu ergaafaalchi koodii erguuf hin qabamne. Kanaaf seenaa bilbilaa amma hojii irra hin oolu.",
        ],
      },
      {
        heading: "8. Beekisa shakkaamaa yookaan gargaarsa herregaa akkamitti himu?",
        paragraphs: [
          "Namoota shakkaamaa maallaqa yookaan ragaa dhuugaa hin ergattii. Rakkoo yookaan gargaarsa herregaa iddoo imeelii armaan gadiitti ergaa.",
        ],
        links: [emailLink(LEGAL_OPERATOR.email)],
      },
    ],
  },
};

export const publicInformationContent: Record<
  Locale,
  PublicInformationContent
> = {
  en,
  am,
  om,
};

export function getPublicInformationContent(
  locale: Locale,
): PublicInformationContent {
  return publicInformationContent[locale];
}
