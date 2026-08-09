import type { ToolLocale } from "./types";

/**
 * Trilingual UI strings consumed by tool client components: form labels,
 * common buttons, error messages, status labels. Tool-specific labels
 * (industry options, channel labels) live alongside each tool's client.
 */

export interface ToolClientStrings {
    submit: string;
    submitting: string;
    invalidInput: string;
    networkError: string;
    rateLimitTitle: string;
    industry: string;
    teamSize: string;
    monthlyBudget: string;
    techComfort: string;
    techLow: string;
    techMedium: string;
    techHigh: string;
    optional: string;
    yes: string;
    no: string;
    url: string;
    urlPlaceholder: string;
    brandName: string;
    industryLabel: string;
    location: string;
    locationPlaceholder: string;
    runCheck: string;
    runAudit: string;
    runScan: string;
    scanning: string;
    auditing: string;
    computing: string;
    drafting: string;
    calculating: string;
    generatingRoadmap: string;
    generateRoadmap: string;
    calculate: string;
    recommendStack: string;
    buildingStack: string;
    checkReadiness: string;
    generateReply: string;
    runAiVisibilityCheck: string;
    cached: string;
    addTask: string;
    removeTask: string;
    taskName: string;
    hoursPerWeek: string;
    eurPerHour: string;
    reworkPercent: string;
    toolingCostEurMonth: string;
    implementationEur: string;
    coverage: string;
    repetitiveTasks: string;
    monthlyInquiries: string;
    avgResponseHours: string;
    repeatedQuestions: string;
    channelsInUse: string;
    complexity: string;
    complexityLow: string;
    complexityMedium: string;
    complexityHigh: string;
    supportTeamSize: string;
    agentCostMonthly: string;
    hasFaq: string;
    hasHelpdesk: string;
    reviewText: string;
    reviewTextPlaceholder: string;
    rating: string;
    language: string;
    tone: string;
    toneWarm: string;
    toneProfessional: string;
    toneApologetic: string;
    toneDirect: string;
    businessName: string;
    businessType: string;
    businessTypePlaceholder: string;
    reviewerName: string;
    copyReply: string;
    copied: string;
    suggestedReply: string;
    aiSource: string;
    templateSource: string;
    proTips: string;
    monthlyLeads: string;
    monthlyLeadsHelper: string;
    avgHourlyCost: string;
    avgHourlyCostHelper: string;
    repetitiveHours: string;
    repetitiveHoursHelper: string;
    monthlyCustomerInquiries: string;
    monthlyCustomerInquiriesHelper: string;
    repeatedQuestionsPercent: string;
    repeatedQuestionsHelper: string;
    recurringTasks: string;
    recurringTasksHelper: string;
    currentTools: string;
    currentToolsHelper: string;
    biggestPainPoint: string;
    painPoints: string;
    perTaskBreakdown: string;
    recommendedLevel: string;
    paybackIn: (months: number, coverage: number) => string;
    paybackImpossible: string;
    topAutomations: string;
    rankedBySavings: string;
    yourRoadmap: string;
    yourBusinessCase: string;
    yourStack: string;
    yourAiVisibility: string;
    yourSupportReadiness: string;
    yourGdprScan: string;
    yourConversionAudit: string;
    bookFreeAudit: string;
    runDifferent: string;
    starter: string;
    growth: string;
    automationTier: string;
    total: string;
    setupHours: string;
    whatWeChecked: string;
    topRecommendations: string;
    suggestedFixes: string;
    samplePrompts: string;
    samplePromptsBody: string;
    checks: string;
    grade: string;
    score: string;
    riskBanner: string;
    riskTrackers: string;
    consentRequired: string;
    consentOptional: string;
    findingsFixes: string;
    findingsClean: string;
    policiesPrivacy: string;
    policiesCookies: string;
    policiesTerms: string;
    trackersHeading: string;
    trackersClean: string;
    whyRecommendation: string;
    pickAtLeastOne: string;
    selectChannel: string;
    urlToCheck: string;
    websiteUrlToScan: string;
    landingPageUrl: string;
    monthlySoftwareBudget: string;
    aiAssessment: string;
    citationReadiness: string;
    readiness: string;
    checksTotalHint: string;
    topFixes: string;
    conversionSignals: string;
    ctaStrength: string;
    trustSignals: string;
    leadMagnets: string;
    detectedLeadMagnets: string;
    cookieBanner: string;
    trackersDetected: string;
    policiesHeading: string;
    noKnownTrackers: string;
}

export const TOOL_CLIENT_STRINGS: Record<ToolLocale, ToolClientStrings> = {
    en: {
        submit: "Submit",
        submitting: "Submitting…",
        invalidInput: "Some inputs are invalid.",
        networkError: "Network error. Try again.",
        rateLimitTitle: "Daily limit reached",
        industry: "Industry",
        teamSize: "Team size",
        monthlyBudget: "Monthly software budget",
        techComfort: "Tech comfort",
        techLow: "Low",
        techMedium: "Medium",
        techHigh: "High",
        optional: "optional",
        yes: "Yes",
        no: "No",
        url: "URL",
        urlPlaceholder: "https://your-site.com",
        brandName: "Brand name",
        industryLabel: "Industry",
        location: "Location",
        locationPlaceholder: "Amsterdam, NL",
        runCheck: "Run check",
        runAudit: "Run audit",
        runScan: "Run scan",
        scanning: "Scanning…",
        auditing: "Auditing…",
        computing: "Computing…",
        drafting: "Drafting…",
        calculating: "Calculating…",
        generatingRoadmap: "Generating roadmap…",
        generateRoadmap: "Generate my automation roadmap",
        calculate: "Calculate ROI",
        recommendStack: "Recommend my stack",
        buildingStack: "Building your stack…",
        checkReadiness: "Check readiness",
        generateReply: "Generate reply",
        runAiVisibilityCheck: "Run AI visibility check",
        cached: "Cached scan",
        addTask: "Add task",
        removeTask: "Remove task",
        taskName: "Task name",
        hoursPerWeek: "h / wk",
        eurPerHour: "€ / h",
        reworkPercent: "Rework %",
        toolingCostEurMonth: "Tooling cost (€/month)",
        implementationEur: "Implementation (€)",
        coverage: "Automation coverage",
        repetitiveTasks: "Repetitive tasks",
        monthlyInquiries: "Monthly inquiries",
        avgResponseHours: "Avg response time (hours)",
        repeatedQuestions: "Repeated questions",
        channelsInUse: "Channels in use",
        complexity: "Inquiry complexity",
        complexityLow: "Low",
        complexityMedium: "Medium",
        complexityHigh: "High",
        supportTeamSize: "Support team size",
        agentCostMonthly: "Avg agent cost (€/mo)",
        hasFaq: "We already have a public FAQ",
        hasHelpdesk: "We use a helpdesk (Zendesk, HubSpot…)",
        reviewText: "Review text",
        reviewTextPlaceholder: "Paste the customer's review here…",
        rating: "Rating",
        language: "Language",
        tone: "Tone",
        toneWarm: "Warm",
        toneProfessional: "Pro",
        toneApologetic: "Apol",
        toneDirect: "Direct",
        businessName: "Your business name",
        businessType: "Business type",
        businessTypePlaceholder: "dental clinic, agency, restaurant…",
        reviewerName: "Reviewer first name",
        copyReply: "Copy reply",
        copied: "Copied",
        suggestedReply: "Suggested reply",
        aiSource: "AI-generated · review before posting",
        templateSource: "Template fallback · AI temporarily unavailable",
        proTips: "Pro tips for this rating",
        monthlyLeads: "Monthly leads",
        monthlyLeadsHelper: "Inbound enquiries / month",
        avgHourlyCost: "Avg hourly cost (€)",
        avgHourlyCostHelper: "Fully-loaded cost of your team's time",
        repetitiveHours: "Repetitive hours / week",
        repetitiveHoursHelper: "Across the whole team",
        monthlyCustomerInquiries: "Monthly customer inquiries",
        monthlyCustomerInquiriesHelper: "Support + sales tickets combined",
        repeatedQuestionsPercent: "Repeated-questions percentage",
        repeatedQuestionsHelper: "Share of inquiries that ask the same thing",
        recurringTasks: "Recurring tasks (pick at least one)",
        recurringTasksHelper: "What eats your team's time",
        currentTools: "Current tools (comma-separated)",
        currentToolsHelper: "What you already use",
        biggestPainPoint: "Biggest pain point",
        painPoints: "Pain points",
        perTaskBreakdown: "Per-task breakdown",
        recommendedLevel: "Recommended level",
        paybackIn: (m, c) => `Implementation pays back in ~${m} months at ${c}% coverage.`,
        paybackImpossible: "Your tooling cost exceeds projected savings — start with a single high-impact task and re-run.",
        topAutomations: "Top automations",
        rankedBySavings: "Ranked by estimated savings",
        yourRoadmap: "Your roadmap",
        yourBusinessCase: "Business case",
        yourStack: "Your stack",
        yourAiVisibility: "Your AI visibility",
        yourSupportReadiness: "Support readiness",
        yourGdprScan: "GDPR risk scan",
        yourConversionAudit: "Conversion audit",
        bookFreeAudit: "Book the free Systems Fit Call",
        runDifferent: "Re-run with different inputs",
        starter: "Starter",
        growth: "Growth",
        automationTier: "Automation",
        total: "Total",
        setupHours: "setup",
        whatWeChecked: "What we checked",
        topRecommendations: "Top recommendations",
        suggestedFixes: "Suggested fixes",
        samplePrompts: "Sample AI prompts to test",
        samplePromptsBody: "Try these in ChatGPT, Perplexity, and Google AI Overviews. See whether you're mentioned and which competitors show up.",
        checks: "Checks",
        grade: "Grade",
        score: "Score",
        riskBanner: "Cookie banner",
        riskTrackers: "Trackers detected",
        consentRequired: "Consent required",
        consentOptional: "Essential / optional",
        findingsFixes: "Findings & fixes",
        findingsClean: "No findings — looks clean.",
        policiesPrivacy: "Privacy policy",
        policiesCookies: "Cookie policy",
        policiesTerms: "Terms of service",
        trackersHeading: "Trackers detected",
        trackersClean: "No known third-party trackers detected.",
        whyRecommendation: "Why this recommendation",
        pickAtLeastOne: "Pick at least one option.",
        selectChannel: "Select at least one support channel.",
        urlToCheck: "URL to check",
        websiteUrlToScan: "Website URL to scan",
        landingPageUrl: "Landing page URL",
        monthlySoftwareBudget: "Monthly software budget",
        aiAssessment: "AI assessment",
        citationReadiness: "Citation readiness",
        readiness: "Readiness",
        checksTotalHint: "Total signals audited",
        topFixes: "Top fixes",
        conversionSignals: "Conversion signals",
        ctaStrength: "CTA strength",
        trustSignals: "Trust signals",
        leadMagnets: "Lead magnets",
        detectedLeadMagnets: "Detected lead magnets",
        cookieBanner: "Cookie banner",
        trackersDetected: "Trackers detected",
        policiesHeading: "Policy links",
        noKnownTrackers: "No known third-party trackers detected.",
    },
    nl: {
        submit: "Verzend",
        submitting: "Verzenden…",
        invalidInput: "Enkele invoer is ongeldig.",
        networkError: "Netwerkfout. Probeer opnieuw.",
        rateLimitTitle: "Daglimiet bereikt",
        industry: "Sector",
        teamSize: "Teamgrootte",
        monthlyBudget: "Maandelijks software­budget",
        techComfort: "Tech-comfort",
        techLow: "Laag",
        techMedium: "Gemiddeld",
        techHigh: "Hoog",
        optional: "optioneel",
        yes: "Ja",
        no: "Nee",
        url: "URL",
        urlPlaceholder: "https://jouw-site.nl",
        brandName: "Merknaam",
        industryLabel: "Sector",
        location: "Locatie",
        locationPlaceholder: "Amsterdam, NL",
        runCheck: "Voer check uit",
        runAudit: "Voer audit uit",
        runScan: "Voer scan uit",
        scanning: "Scannen…",
        auditing: "Auditen…",
        computing: "Berekenen…",
        drafting: "Concept maken…",
        calculating: "Berekenen…",
        generatingRoadmap: "Roadmap genereren…",
        generateRoadmap: "Genereer mijn automatiseringsroadmap",
        calculate: "Bereken ROI",
        recommendStack: "Beveel mijn stack aan",
        buildingStack: "Stack bouwen…",
        checkReadiness: "Check readiness",
        generateReply: "Genereer antwoord",
        runAiVisibilityCheck: "Start AI-zichtbaarheidscheck",
        cached: "Cache-scan",
        addTask: "Taak toevoegen",
        removeTask: "Taak verwijderen",
        taskName: "Taaknaam",
        hoursPerWeek: "u / wk",
        eurPerHour: "€ / u",
        reworkPercent: "Rework %",
        toolingCostEurMonth: "Toolingkosten (€/maand)",
        implementationEur: "Implementatie (€)",
        coverage: "Automatiseringsdekking",
        repetitiveTasks: "Repetitieve taken",
        monthlyInquiries: "Vragen per maand",
        avgResponseHours: "Gem. responstijd (uren)",
        repeatedQuestions: "Herhaalde vragen",
        channelsInUse: "Kanalen in gebruik",
        complexity: "Complexiteit vragen",
        complexityLow: "Laag",
        complexityMedium: "Gemiddeld",
        complexityHigh: "Hoog",
        supportTeamSize: "Support-teamgrootte",
        agentCostMonthly: "Gem. kosten agent (€/mnd)",
        hasFaq: "We hebben al een publieke FAQ",
        hasHelpdesk: "We gebruiken een helpdesk (Zendesk, HubSpot…)",
        reviewText: "Reviewtekst",
        reviewTextPlaceholder: "Plak de review van de klant hier…",
        rating: "Beoordeling",
        language: "Taal",
        tone: "Tone",
        toneWarm: "Warm",
        toneProfessional: "Pro",
        toneApologetic: "Apol",
        toneDirect: "Direct",
        businessName: "Bedrijfsnaam",
        businessType: "Type bedrijf",
        businessTypePlaceholder: "tandarts, agency, restaurant…",
        reviewerName: "Voornaam reviewer",
        copyReply: "Kopieer antwoord",
        copied: "Gekopieerd",
        suggestedReply: "Suggestie",
        aiSource: "AI-gegenereerd · check voor je post",
        templateSource: "Template-fallback · AI tijdelijk niet beschikbaar",
        proTips: "Pro-tips voor deze score",
        monthlyLeads: "Leads per maand",
        monthlyLeadsHelper: "Inbound aanvragen / maand",
        avgHourlyCost: "Gem. uurkosten (€)",
        avgHourlyCostHelper: "Fully-loaded kosten team",
        repetitiveHours: "Repetitieve uren / week",
        repetitiveHoursHelper: "Over het hele team",
        monthlyCustomerInquiries: "Klantvragen per maand",
        monthlyCustomerInquiriesHelper: "Support + sales samen",
        repeatedQuestionsPercent: "% herhaalde vragen",
        repeatedQuestionsHelper: "Deel van vragen dat hetzelfde herhaalt",
        recurringTasks: "Terugkerende taken (kies minstens één)",
        recurringTasksHelper: "Wat tijd opslokt",
        currentTools: "Huidige tools (komma-gescheiden)",
        currentToolsHelper: "Wat je al gebruikt",
        biggestPainPoint: "Grootste pijnpunt",
        painPoints: "Pijnpunten",
        perTaskBreakdown: "Per-taak overzicht",
        recommendedLevel: "Aanbevolen niveau",
        paybackIn: (m, c) => `Implementatie verdient zich terug in ~${m} maanden bij ${c}% dekking.`,
        paybackImpossible: "Toolingkosten overstijgen verwachte besparing — begin met één taak met hoge impact en herdraai.",
        topAutomations: "Top automatiseringen",
        rankedBySavings: "Gerangschikt op geschatte besparing",
        yourRoadmap: "Jouw roadmap",
        yourBusinessCase: "Businesscase",
        yourStack: "Jouw stack",
        yourAiVisibility: "Jouw AI-zichtbaarheid",
        yourSupportReadiness: "Support readiness",
        yourGdprScan: "GDPR-scan",
        yourConversionAudit: "Conversie-audit",
        bookFreeAudit: "Plan de gratis Systems Fit Call",
        runDifferent: "Opnieuw met andere invoer",
        starter: "Starter",
        growth: "Groei",
        automationTier: "Automatisering",
        total: "Totaal",
        setupHours: "setup",
        whatWeChecked: "Wat we gecheckt hebben",
        topRecommendations: "Top aanbevelingen",
        suggestedFixes: "Voorgestelde fixes",
        samplePrompts: "Voorbeeldprompts om te testen",
        samplePromptsBody: "Test deze in ChatGPT, Perplexity en Google AI Overviews. Kijk of je genoemd wordt en welke concurrenten verschijnen.",
        checks: "Checks",
        grade: "Cijfer",
        score: "Score",
        riskBanner: "Cookiebanner",
        riskTrackers: "Trackers gedetecteerd",
        consentRequired: "Consent vereist",
        consentOptional: "Essentieel / optioneel",
        findingsFixes: "Bevindingen & fixes",
        findingsClean: "Geen bevindingen — schoon.",
        policiesPrivacy: "Privacybeleid",
        policiesCookies: "Cookiebeleid",
        policiesTerms: "Algemene voorwaarden",
        trackersHeading: "Trackers gedetecteerd",
        trackersClean: "Geen bekende third-party trackers gevonden.",
        whyRecommendation: "Waarom deze aanbeveling",
        pickAtLeastOne: "Kies minstens één optie.",
        selectChannel: "Kies minstens één supportkanaal.",
        urlToCheck: "URL om te checken",
        websiteUrlToScan: "Website-URL om te scannen",
        landingPageUrl: "Landingspagina-URL",
        monthlySoftwareBudget: "Maandelijks softwarebudget",
        aiAssessment: "AI-beoordeling",
        citationReadiness: "Citation-readiness",
        readiness: "Readiness",
        checksTotalHint: "Totaal aantal signalen geaudit",
        topFixes: "Top fixes",
        conversionSignals: "Conversiesignalen",
        ctaStrength: "CTA-sterkte",
        trustSignals: "Trust-signalen",
        leadMagnets: "Lead magnets",
        detectedLeadMagnets: "Gedetecteerde lead magnets",
        cookieBanner: "Cookiebanner",
        trackersDetected: "Trackers gedetecteerd",
        policiesHeading: "Policy-links",
        noKnownTrackers: "Geen bekende third-party trackers gevonden.",
    },
    ar: {
        submit: "إرسال",
        submitting: "جارٍ الإرسال…",
        invalidInput: "بعض المدخلات غير صحيحة.",
        networkError: "خطأ في الشبكة. حاول مجددًا.",
        rateLimitTitle: "بلغت الحد اليومي",
        industry: "القطاع",
        teamSize: "حجم الفريق",
        monthlyBudget: "ميزانية البرامج الشهرية",
        techComfort: "الراحة التقنية",
        techLow: "منخفضة",
        techMedium: "متوسطة",
        techHigh: "عالية",
        optional: "اختياري",
        yes: "نعم",
        no: "لا",
        url: "الرابط",
        urlPlaceholder: "https://your-site.com",
        brandName: "اسم العلامة",
        industryLabel: "القطاع",
        location: "الموقع",
        locationPlaceholder: "أمستردام، هولندا",
        runCheck: "شغّل الفحص",
        runAudit: "شغّل التدقيق",
        runScan: "شغّل المسح",
        scanning: "جارٍ المسح…",
        auditing: "جارٍ التدقيق…",
        computing: "جارٍ الحساب…",
        drafting: "جارٍ الصياغة…",
        calculating: "جارٍ الحساب…",
        generatingRoadmap: "جارٍ توليد الخارطة…",
        generateRoadmap: "ولّد خارطة الأتمتة",
        calculate: "احسب العائد",
        recommendStack: "أوصِ بمكدّسي",
        buildingStack: "جارٍ بناء المكدّس…",
        checkReadiness: "تحقّق من الجاهزية",
        generateReply: "ولّد ردًا",
        runAiVisibilityCheck: "شغّل فحص الظهور",
        cached: "نتيجة مخزّنة",
        addTask: "أضف مهمة",
        removeTask: "احذف المهمة",
        taskName: "اسم المهمة",
        hoursPerWeek: "س / أسبوع",
        eurPerHour: "€ / ساعة",
        reworkPercent: "إعادة عمل %",
        toolingCostEurMonth: "تكلفة الأدوات (€/شهر)",
        implementationEur: "تكلفة التنفيذ (€)",
        coverage: "تغطية الأتمتة",
        repetitiveTasks: "مهام متكرّرة",
        monthlyInquiries: "استفسارات / شهر",
        avgResponseHours: "متوسط الردّ (ساعات)",
        repeatedQuestions: "أسئلة متكرّرة",
        channelsInUse: "القنوات المستخدمة",
        complexity: "تعقيد الاستفسار",
        complexityLow: "منخفض",
        complexityMedium: "متوسط",
        complexityHigh: "عالي",
        supportTeamSize: "حجم فريق الدعم",
        agentCostMonthly: "تكلفة الوكيل (€/شهر)",
        hasFaq: "لدينا صفحة أسئلة شائعة عامّة",
        hasHelpdesk: "نستخدم Helpdesk (Zendesk، HubSpot…)",
        reviewText: "نصّ التقييم",
        reviewTextPlaceholder: "ألصق تقييم العميل هنا…",
        rating: "التقييم",
        language: "اللغة",
        tone: "النبرة",
        toneWarm: "ودّي",
        toneProfessional: "مهني",
        toneApologetic: "اعتذار",
        toneDirect: "مباشر",
        businessName: "اسم النشاط",
        businessType: "نوع النشاط",
        businessTypePlaceholder: "عيادة أسنان، وكالة، مطعم…",
        reviewerName: "اسم المقيّم الأول",
        copyReply: "انسخ الردّ",
        copied: "تم النسخ",
        suggestedReply: "الردّ المقترح",
        aiSource: "مُولَّد بالذكاء الاصطناعي · راجع قبل النشر",
        templateSource: "قالب بديل · الذكاء الاصطناعي غير متاح",
        proTips: "نصائح احترافية لهذا التقييم",
        monthlyLeads: "العملاء المحتملون شهريًا",
        monthlyLeadsHelper: "الاستفسارات الواردة / شهر",
        avgHourlyCost: "متوسط تكلفة الساعة (€)",
        avgHourlyCostHelper: "التكلفة الشاملة لوقت الفريق",
        repetitiveHours: "ساعات متكرّرة / أسبوع",
        repetitiveHoursHelper: "للفريق كاملاً",
        monthlyCustomerInquiries: "استفسارات العملاء شهريًا",
        monthlyCustomerInquiriesHelper: "الدعم والمبيعات معًا",
        repeatedQuestionsPercent: "نسبة الأسئلة المتكرّرة",
        repeatedQuestionsHelper: "نسبة الاستفسارات التي تطرح الأمر نفسه",
        recurringTasks: "مهام متكرّرة (اختر واحدة على الأقل)",
        recurringTasksHelper: "ما يستنزف وقت الفريق",
        currentTools: "الأدوات الحالية (مفصولة بفواصل)",
        currentToolsHelper: "ما تستخدمه حاليًا",
        biggestPainPoint: "أكبر نقطة ألم",
        painPoints: "نقاط الألم",
        perTaskBreakdown: "تفصيل لكل مهمة",
        recommendedLevel: "المستوى الموصى به",
        paybackIn: (m, c) => `يسترد التنفيذ خلال ~${m} شهرًا عند تغطية ${c}%.`,
        paybackImpossible: "تكلفة الأدوات تفوق الوفر المتوقّع — ابدأ بمهمة واحدة عالية الأثر ثم أعد التشغيل.",
        topAutomations: "أعلى الأتمتات",
        rankedBySavings: "مرتّبة بحسب الوفر المقدّر",
        yourRoadmap: "خارطتك",
        yourBusinessCase: "دراسة الجدوى",
        yourStack: "مكدّسك",
        yourAiVisibility: "ظهورك في الذكاء الاصطناعي",
        yourSupportReadiness: "جاهزية الدعم",
        yourGdprScan: "مسح GDPR",
        yourConversionAudit: "تدقيق التحويلات",
        bookFreeAudit: "احجز مكالمة ملاءمة الأنظمة المجانية",
        runDifferent: "أعد التشغيل بمدخلات مختلفة",
        starter: "المبتدئ",
        growth: "النمو",
        automationTier: "الأتمتة",
        total: "الإجمالي",
        setupHours: "إعداد",
        whatWeChecked: "ما فحصناه",
        topRecommendations: "أهم التوصيات",
        suggestedFixes: "الإصلاحات المقترحة",
        samplePrompts: "أمثلة مطالبات للاختبار",
        samplePromptsBody: "جرّبها في ChatGPT وPerplexity وGoogle AI Overviews. لاحظ هل يُذكر اسمك ومن يظهر من المنافسين.",
        checks: "الفحوصات",
        grade: "التقدير",
        score: "النتيجة",
        riskBanner: "بانر الكوكيز",
        riskTrackers: "أدوات تتبّع مكتشَفة",
        consentRequired: "تحتاج موافقة",
        consentOptional: "أساسية / اختيارية",
        findingsFixes: "النتائج والإصلاحات",
        findingsClean: "لا نتائج — يبدو نظيفًا.",
        policiesPrivacy: "سياسة الخصوصية",
        policiesCookies: "سياسة الكوكيز",
        policiesTerms: "الشروط",
        trackersHeading: "أدوات تتبّع مكتشَفة",
        trackersClean: "لم يتم اكتشاف أدوات تتبّع طرف ثالث معروفة.",
        whyRecommendation: "لماذا هذه التوصية",
        pickAtLeastOne: "اختر خيارًا واحدًا على الأقل.",
        selectChannel: "اختر قناة دعم واحدة على الأقل.",
        urlToCheck: "الرابط المراد فحصه",
        websiteUrlToScan: "رابط الموقع للمسح",
        landingPageUrl: "رابط صفحة الهبوط",
        monthlySoftwareBudget: "ميزانية البرامج الشهرية",
        aiAssessment: "تقييم الذكاء الاصطناعي",
        citationReadiness: "جاهزية الاقتباس",
        readiness: "الجاهزية",
        checksTotalHint: "إجمالي الإشارات التي تم تدقيقها",
        topFixes: "أهم الإصلاحات",
        conversionSignals: "إشارات التحويل",
        ctaStrength: "قوة دعوة الإجراء",
        trustSignals: "إشارات الثقة",
        leadMagnets: "مغناطيسات العملاء المحتملين",
        detectedLeadMagnets: "مغناطيسات مكتشفة للعملاء المحتملين",
        cookieBanner: "بانر الكوكيز",
        trackersDetected: "أدوات تتبّع مكتشفة",
        policiesHeading: "روابط السياسات",
        noKnownTrackers: "لم يتم اكتشاف أدوات تتبع طرف ثالث معروفة.",
    },
};

export function getToolClientStrings(locale: ToolLocale): ToolClientStrings {
    return TOOL_CLIENT_STRINGS[locale];
}
