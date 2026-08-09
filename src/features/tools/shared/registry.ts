import type { ToolMeta, ToolSlug } from "./types";

/**
 * Tool metadata. Copy is calibrated against the reviewed public brand brief:
 *   - No "AI-powered", no "transform", no generic small-business boilerplate.
 *   - SME / founder / operator framing, sober EU register in EN.
 *   - NL ≈ 30% shorter than EN, "vrijblijvend" not "gratis" where it applies.
 *   - AR is MSA, calm B2B register.
 *
 * NL strings still need a native-speaker review pass before any production
 * locale rollout.
 */
export const TOOL_REGISTRY: Record<ToolSlug, ToolMeta> = {
    "automation-scanner": {
        slug: "automation-scanner",
        category: "automation",
        timeMinutes: 3,
        title: {
            en: "AI Automation Opportunity Scanner",
            nl: "AI-Automatisering Kansenscanner",
            ar: "ماسح فرص الأتمتة بالذكاء الاصطناعي",
        },
        summary: {
            en: "Answer ten questions about your operation. Get a ranked roadmap with hours saved per month, a recommended stack, and an honest readiness score.",
            nl: "Beantwoord tien vragen. Krijg een gerangschikte roadmap met bespaarde uren per maand, een aanbevolen stack en een eerlijke readiness-score.",
            ar: "أجب عن عشرة أسئلة عن عملياتك. احصل على خارطة طريق مرتّبة، ساعات موفّرة شهريًا، مكدّس مقترح، ودرجة جاهزية صريحة.",
        },
        description: {
            en: "Free AI-automation diagnostic for SME founders. 10 inputs, a ranked roadmap, monthly hours saved, and a recommended stack — no sales call required.",
            nl: "Vrijblijvende AI-automatisering diagnose voor MKB-ondernemers. 10 inputs, gerangschikte roadmap, bespaarde uren per maand, aanbevolen stack — geen verkoopgesprek.",
            ar: "أداة تشخيص أتمتة مجانية لمؤسّسي الشركات الصغيرة والمتوسطة. عشر مدخلات، خارطة طريق مرتّبة، ساعات موفّرة، ومكدّس موصى به — دون مكالمة مبيعات.",
        },
        keyword: {
            en: "AI automation audit for SMEs",
            nl: "AI automatisering audit MKB",
            ar: "تدقيق أتمتة بالذكاء الاصطناعي للشركات الصغيرة والمتوسطة",
        },
    },
    "automation-roi-calculator": {
        slug: "automation-roi-calculator",
        category: "automation",
        timeMinutes: 2,
        title: {
            en: "Workflow Automation ROI Calculator",
            nl: "Workflow-automatisering ROI-calculator",
            ar: "حاسبة عائد أتمتة سير العمل",
        },
        summary: {
            en: "Cost out your repetitive work, model automation coverage, see payback in months — not a generic spreadsheet.",
            nl: "Bereken de kosten van handwerk, model je automatiseringsdekking, zie de terugverdientijd in maanden — geen generieke spreadsheet.",
            ar: "احسب تكلفة عملك المتكرّر، اضبط نسبة الأتمتة، شاهد فترة الاسترداد بالأشهر — لا جدول بيانات عامّ.",
        },
        description: {
            en: "Honest automation ROI calculator. Enter task hours, hourly cost, tooling + implementation — see monthly waste, yearly savings, and a real payback figure.",
            nl: "Eerlijke automatiserings-ROI-calculator. Voer taakuren, uurkosten, tooling en implementatie in — zie maandelijkse verspilling, jaarlijkse besparing en echte terugverdientijd.",
            ar: "حاسبة صريحة لعائد الأتمتة. أدخل ساعات المهام، التكلفة بالساعة، الأدوات والتنفيذ — لتعرف الهدر الشهري والوفر السنوي وفترة الاسترداد الحقيقية.",
        },
        keyword: {
            en: "automation ROI calculator",
            nl: "automatisering ROI calculator",
            ar: "حاسبة عائد الأتمتة",
        },
    },
    "ai-stack-recommender": {
        slug: "ai-stack-recommender",
        category: "automation",
        timeMinutes: 2,
        title: {
            en: "AI Tool Stack Recommender",
            nl: "AI-toolstack Aanbeveler",
            ar: "موصي مكدّس أدوات الذكاء الاصطناعي",
        },
        summary: {
            en: "Tell us your sector, team size, and monthly budget. Get three tiers — Starter, Growth, Automation — with monthly cost, setup time, and an honest sequence.",
            nl: "Vertel je sector, teamgrootte en maandbudget. Krijg drie niveaus — Starter, Groei, Automatisering — met maandkosten, setup-tijd en een eerlijke volgorde.",
            ar: "أخبرنا بقطاعك وحجم فريقك وميزانيتك الشهرية. احصل على ثلاث طبقات — مبتدئ، نمو، أتمتة — مع التكلفة الشهرية ووقت الإعداد وترتيب صادق.",
        },
        description: {
            en: "Get a personalised three-tier AI tool stack — Starter, Growth, Automation — with realistic monthly costs and setup-hours. Built for SME operators, not enterprise buyers.",
            nl: "Persoonlijke AI-toolstack in drie niveaus — Starter, Groei, Automatisering — met realistische maandkosten en setup-uren. Gebouwd voor MKB-ondernemers.",
            ar: "مكدّس أدوات ذكاء اصطناعي مخصّص بثلاث طبقات — مبتدئ، نمو، أتمتة — مع تكاليف شهرية واقعية وساعات إعداد. مصمّم لمشغّلي الشركات الصغيرة والمتوسطة.",
        },
        keyword: {
            en: "AI tool stack for SMEs",
            nl: "AI tool stack MKB",
            ar: "مكدّس أدوات الذكاء الاصطناعي للشركات الصغيرة والمتوسطة",
        },
    },
    "ai-visibility-checker": {
        slug: "ai-visibility-checker",
        category: "ai-search",
        timeMinutes: 2,
        requiresUrl: true,
        usesAi: true,
        title: {
            en: "AI Visibility Readiness Checker",
            nl: "AI-zichtbaarheid Readiness Checker",
            ar: "فاحص جاهزية الظهور في الذكاء الاصطناعي",
        },
        summary: {
            en: "Audit a page against the signals ChatGPT, Perplexity, and Google's AI Overviews use to decide who gets cited.",
            nl: "Toets een pagina aan de signalen die ChatGPT, Perplexity en Google AI Overviews gebruiken om te bepalen wie geciteerd wordt.",
            ar: "تدقّق صفحة مقابل الإشارات التي تستخدمها ChatGPT وPerplexity وGoogle AI Overviews لاختيار من يُذكَر.",
        },
        description: {
            en: "Check whether your site gives AI engines the signals they need to cite you. Schema, FAQ density, brand mentions, content depth — graded honestly.",
            nl: "Controleer of je site de signalen geeft die AI-engines nodig hebben om je te citeren. Schema, FAQ-dichtheid, merkvermeldingen, contentdiepte — eerlijk beoordeeld.",
            ar: "تحقّق إن كان موقعك يقدّم لمحرّكات الذكاء الاصطناعي الإشارات اللازمة للاقتباس منه. سكيمات، أسئلة شائعة، ذكر العلامة، عمق المحتوى — تقييم صريح.",
        },
        keyword: {
            en: "AI search visibility checker",
            nl: "AI-zoek zichtbaarheid checker",
            ar: "فاحص ظهور البحث بالذكاء الاصطناعي",
        },
    },
    "support-automation-readiness": {
        slug: "support-automation-readiness",
        category: "support",
        timeMinutes: 2,
        title: {
            en: "Customer Support Automation Readiness",
            nl: "Klantenservice-automatisering Readiness",
            ar: "جاهزية أتمتة دعم العملاء",
        },
        summary: {
            en: "Should you reach for a chatbot, an AI phone agent, or stay human-only? Get a readiness score, a recommended approach, and a realistic ROI estimate.",
            nl: "Chatbot, AI-telefoonagent of toch puur menselijk? Krijg een readiness-score, een aanbevolen aanpak en een realistische ROI-schatting.",
            ar: "هل تتّجه إلى دردشة آلية، أو وكيل ذكاء اصطناعي هاتفي، أم تبقى بشريًا فقط؟ احصل على درجة جاهزية ونهج موصى به وتقدير عائد واقعي.",
        },
        description: {
            en: "Free diagnostic that tells SME operators whether to automate support — and which lever to pull first. Volume, repetition, complexity, channels in, recommendation out.",
            nl: "Vrijblijvende diagnose voor MKB-ondernemers: support automatiseren of niet, en welke hefboom eerst. Volume, repetitie, complexiteit, kanalen in, aanbeveling eruit.",
            ar: "أداة تشخيص مجانية تُخبر مشغّلي الشركات الصغيرة والمتوسطة هل يؤتمتون الدعم — وأي رافعة يبدأون بها. الحجم والتكرار والتعقيد والقنوات داخل، توصية خارج.",
        },
        keyword: {
            en: "customer support automation readiness",
            nl: "klantenservice automatisering readiness",
            ar: "جاهزية أتمتة دعم العملاء",
        },
    },
    "review-response-generator": {
        slug: "review-response-generator",
        category: "growth",
        timeMinutes: 1,
        usesAi: true,
        title: {
            en: "Multilingual Review Response Drafter",
            nl: "Meertalige Review-antwoord Drafter",
            ar: "صائغ ردود التقييمات متعدّد اللغات",
        },
        summary: {
            en: "Paste a Google or Trustpilot review. Get a sober, locale-correct reply in EN, NL, or AR — drafted to be edited, not posted blindly.",
            nl: "Plak een review van Google of Trustpilot. Krijg een nuchter, taal-correct antwoord in NL, EN of AR — bedoeld om aan te passen, niet blind te plaatsen.",
            ar: "ألصق تقييمًا من Google أو Trustpilot. احصل على ردّ هادئ ولغوي صحيح بالعربية أو الإنجليزية أو الهولندية — صياغة للتعديل، لا للنشر مباشرة.",
        },
        description: {
            en: "Free, sober review-response drafter. Trilingual (EN/NL/AR), aware of star rating, and never makes promises you'd regret. Edit before posting.",
            nl: "Vrijblijvende, nuchtere reviewdrafter. Drietalig (NL/EN/AR), houdt rekening met de sterren, doet nooit beloftes waar je spijt van krijgt. Bewerk voor je plaatst.",
            ar: "صائغ ردود مجاني ورصين. ثلاثي اللغة (العربية/الإنجليزية/الهولندية)، يأخذ التقييم النجمي بعين الاعتبار، ولا يقطع وعودًا تندم عليها. عدّل قبل النشر.",
        },
        keyword: {
            en: "multilingual review response drafter",
            nl: "meertalige review antwoord drafter",
            ar: "صائغ ردود تقييمات متعدّد اللغات",
        },
    },
    "gdpr-cookie-scanner": {
        slug: "gdpr-cookie-scanner",
        category: "compliance",
        timeMinutes: 1,
        requiresUrl: true,
        title: {
            en: "GDPR & Cookie Risk Scanner",
            nl: "GDPR & Cookie Risico-scanner",
            ar: "ماسح مخاطر GDPR والكوكيز",
        },
        summary: {
            en: "Enter a URL. We detect 20+ common trackers, the major consent platforms, missing privacy and cookie policies, and flag what the EU regulators actually look for.",
            nl: "Voer een URL in. We detecteren 20+ gangbare trackers, de grote consent-platforms, ontbrekend privacy- en cookiebeleid, en markeren waar EU-toezichthouders op letten.",
            ar: "أدخل رابطًا. نكتشف 20+ من أدوات التتبّع الشائعة ومنصّات الموافقة الكبرى وغياب سياسات الخصوصية والكوكيز ونُشير لما تنظر إليه الجهات الرقابية الأوروبية فعليًا.",
        },
        description: {
            en: "Fast GDPR + cookie scan. Detects 20+ trackers and the main consent platforms, flags missing privacy and cookie policies, and tells you what to fix first.",
            nl: "Snelle GDPR + cookie-scan. Detecteert 20+ trackers en de grote consent-platforms, markeert ontbrekend privacy- en cookiebeleid, en zegt wat eerst opgelost moet worden.",
            ar: "مسح سريع لـ GDPR والكوكيز. يكتشف 20+ من أدوات التتبّع ومنصّات الموافقة الرئيسية، ويُشير لغياب سياسات الخصوصية والكوكيز، ويُخبرك بما يجب إصلاحه أوّلًا.",
        },
        keyword: {
            en: "GDPR cookie scanner",
            nl: "GDPR cookie scanner",
            ar: "ماسح كوكيز GDPR",
        },
    },
    "conversion-audit": {
        slug: "conversion-audit",
        category: "growth",
        timeMinutes: 1,
        requiresUrl: true,
        title: {
            en: "Conversion & Lead-Magnet Audit",
            nl: "Conversie- & Leadmagneet-audit",
            ar: "تدقيق التحويلات ومغناطيس العملاء",
        },
        summary: {
            en: "Audit a landing page for the things that actually move conversion: CTA verbs, trust signals, lead magnets, contact options, AI-readiness — not generic SEO.",
            nl: "Audit een landingspagina op wat conversie écht beïnvloedt: CTA-werkwoorden, vertrouwenssignalen, leadmagnets, contactopties, AI-gereedheid — geen generieke SEO.",
            ar: "تدقيق صفحة هبوط لِما يحرّك التحويل فعلًا: أفعال الدعوة، إشارات الثقة، مغناطيس العملاء، خيارات التواصل، الجاهزية للذكاء الاصطناعي — لا SEO عام.",
        },
        description: {
            en: "Audit a landing page on the signals that move conversion — CTA copy, trust strip, lead magnets, contact paths, AI-readiness — and get a graded fix list.",
            nl: "Audit een landingspagina op de signalen die conversie verhogen — CTA-copy, vertrouwensstrip, leadmagnets, contactpaden, AI-gereedheid — met een beoordeelde fix-lijst.",
            ar: "تدقيق صفحة هبوط على الإشارات التي ترفع التحويل — نسخ الدعوة، شريط الثقة، مغناطيس العملاء، مسارات التواصل، الجاهزية للذكاء الاصطناعي — مع قائمة إصلاحات مرتّبة.",
        },
        keyword: {
            en: "landing page conversion audit",
            nl: "landingspagina conversie audit",
            ar: "تدقيق تحويلات صفحة الهبوط",
        },
    },
    "nl-zzp-agreement-generator": {
        slug: "nl-zzp-agreement-generator",
        category: "compliance",
        timeMinutes: 4,
        title: {
            en: "NL ZZP Service Agreement Generator",
            nl: "NL ZZP Dienstverleningsovereenkomst Generator",
            ar: "مولّد عقد خدمات ZZP الهولندي",
        },
        summary: {
            en: "Generate a Dutch ZZP service agreement with Wet DBA-aware clauses, 21% BTW language, live preview, and print-to-PDF — fully in your browser.",
            nl: "Genereer een ZZP-dienstverleningsovereenkomst met Wet DBA-bewuste clausules, 21% BTW-taal, live voorbeeld en print-naar-PDF — volledig in je browser.",
            ar: "أنشئ عقد خدمات ZZP هولنديًا ببنود تراعي Wet DBA، وعبارات BTW بنسبة 21٪، ومعاينة مباشرة، وطباعة PDF — بالكامل داخل متصفحك.",
        },
        description: {
            en: "Free Dutch ZZP service agreement generator. Wet DBA-aware clauses, 21% BTW language, browser-only preview and print-to-PDF.",
            nl: "Gratis ZZP-overeenkomst generator. Wet DBA-bewuste clausules, 21% BTW-taal, browser-only preview en print-naar-PDF.",
            ar: "مولّد مجاني لعقد خدمات ZZP الهولندي. بنود تراعي Wet DBA، وBTW 21٪، ومعاينة داخل المتصفح وطباعة PDF.",
        },
        keyword: {
            en: "Dutch ZZP service agreement generator",
            nl: "ZZP dienstverleningsovereenkomst generator",
            ar: "مولّد عقد خدمات ZZP هولندي",
        },
    },
};

export const TOOL_SLUGS = Object.keys(TOOL_REGISTRY) as ToolSlug[];

export function getToolMeta(slug: ToolSlug): ToolMeta {
    return TOOL_REGISTRY[slug];
}
