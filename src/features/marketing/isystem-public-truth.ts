export type IsystemCapabilityStatus = "shipped" | "configured" | "assisted" | "roadmap";

export type IsystemPublicSystemId =
    | "presence-conversion"
    | "authority-publishing"
    | "discoverability-growth"
    | "client-business-operations"
    | "trust-commercial-control";

export interface IsystemPublicSystem {
    id: IsystemPublicSystemId;
    label: {
        en: string;
        nl: string;
        ar: string;
    };
    description: {
        en: string;
        nl: string;
        ar: string;
    };
}

export interface IsystemPublicScopeColumn {
    id: "foundation" | "growth" | "embedded" | "boundary";
    label: {
        en: string;
        nl: string;
        ar: string;
    };
    description: {
        en: string;
        nl: string;
        ar: string;
    };
    items: ReadonlyArray<{
        en: string;
        nl: string;
        ar: string;
    }>;
}

export interface IsystemPublicCapability {
    id: string;
    systemId: IsystemPublicSystemId;
    label: {
        en: string;
        nl: string;
        ar: string;
    };
    publicDescription: {
        en: string;
        nl: string;
        ar: string;
    };
    status: IsystemCapabilityStatus;
    limitation?: {
        en: string;
        nl: string;
        ar: string;
    };
    proofHref?: string;
}

export const ISYSTEM_PUBLIC_POSITIONING = {
    en: "One accountable digital system that turns expertise into demand and connects demand to delivery.",
    nl: "Eén verantwoordelijke digitale systeemlaag die expertise omzet in vraag en vraag verbindt met levering.",
    ar: "نظام رقمي واحد واضح المسؤولية يحوّل الخبرة إلى طلب ويربط الطلب بالتنفيذ.",
} as const;

export const ISYSTEM_PUBLIC_SYSTEMS: readonly IsystemPublicSystem[] = [
    {
        id: "presence-conversion",
        label: { en: "Presence & Conversion", nl: "Aanwezigheid & conversie", ar: "الحضور والتحويل" },
        description: {
            en: "A credible public presence that gives the right visitor a clear next step.",
            nl: "Een geloofwaardige publieke aanwezigheid met een duidelijke volgende stap.",
            ar: "حضور عام موثوق يمنح الزائر المناسب خطوة تالية واضحة.",
        },
    },
    {
        id: "authority-publishing",
        label: { en: "Authority & Publishing", nl: "Autoriteit & publicatie", ar: "الخبرة والنشر" },
        description: {
            en: "A governed publishing loop that turns expertise into useful, reviewable evidence.",
            nl: "Een beheerde publicatielus die expertise omzet in bruikbaar, controleerbaar bewijs.",
            ar: "حلقة نشر محكومة تحول الخبرة إلى أدلة مفيدة وقابلة للمراجعة.",
        },
    },
    {
        id: "discoverability-growth",
        label: { en: "Discoverability & Growth", nl: "Vindbaarheid & groei", ar: "الاكتشاف والنمو" },
        description: {
            en: "Search and audience signals are reviewed before they become growth decisions.",
            nl: "Zoek- en audiencesignalen worden beoordeeld voordat ze groeibeslissingen worden.",
            ar: "تُراجع إشارات البحث والجمهور قبل أن تتحول إلى قرارات نمو.",
        },
    },
    {
        id: "client-business-operations",
        label: { en: "Client & Business Operations", nl: "Klant- & bedrijfsoperatie", ar: "عمليات العملاء والأعمال" },
        description: {
            en: "The operating workflows around enquiries, bookings, delivery, and follow-up.",
            nl: "De werkprocessen rond aanvragen, boekingen, levering en opvolging.",
            ar: "سير العمل حول الاستفسارات والحجوزات والتنفيذ والمتابعة.",
        },
    },
    {
        id: "trust-commercial-control",
        label: { en: "Trust & Commercial Control", nl: "Vertrouwen & commerciële controle", ar: "الثقة والتحكم التجاري" },
        description: {
            en: "Clear boundaries, permissions, records, and commercial facts that can be checked.",
            nl: "Heldere grenzen, rechten, registraties en commerciële feiten die controleerbaar zijn.",
            ar: "حدود وصلاحيات وسجلات وحقائق تجارية واضحة وقابلة للتحقق.",
        },
    },
] as const;

const copy = (
    en: string,
    nl: string,
    ar: string,
): { en: string; nl: string; ar: string } => ({ en, nl, ar });

export const ISYSTEM_PUBLIC_CAPABILITIES: readonly IsystemPublicCapability[] = [
    {
        id: "workspace-shell",
        systemId: "client-business-operations",
        label: copy("Business workspace", "Bedrijfswerkruimte", "مساحة عمل الأعمال"),
        publicDescription: copy(
            "A browser-based workspace that keeps the daily tools, records, and queues in one operating view.",
            "Een browserwerkruimte die dagelijkse tools, dossiers en wachtrijen in één werkoverzicht samenbrengt.",
            "مساحة عمل في المتصفح تجمع الأدوات والسجلات وقوائم العمل اليومية في عرض تشغيلي واحد.",
        ),
        status: "shipped",
    },
    {
        id: "public-presence",
        systemId: "presence-conversion",
        label: copy("Public presence and conversion", "Publieke aanwezigheid en conversie", "الحضور العام والتحويل"),
        publicDescription: copy(
            "Pages, navigation, forms, and conversion paths designed around a buyer decision.",
            "Pagina's, navigatie, formulieren en conversiepaden rond een koopbeslissing.",
            "صفحات وتنقل ونماذج ومسارات تحويل مبنية حول قرار شراء.",
        ),
        status: "shipped",
    },
    {
        id: "page-builder-localization",
        systemId: "presence-conversion",
        label: copy("Page building and localization", "Paginabouw en lokalisatie", "بناء الصفحات وتوطينها"),
        publicDescription: copy(
            "Managed page composition in English, Dutch, and Arabic, including right-to-left layouts.",
            "Beheerde pagina-opbouw in het Engels, Nederlands en Arabisch, inclusief rechts-naar-links lay-outs.",
            "إنشاء صفحات مُدار بالإنجليزية والهولندية والعربية، بما في ذلك تخطيطات من اليمين إلى اليسار.",
        ),
        status: "shipped",
    },
    {
        id: "analytics-lead-capture",
        systemId: "presence-conversion",
        label: copy("Analytics and lead capture", "Analytics en leadopvang", "التحليلات وجمع العملاء المحتملين"),
        publicDescription: copy(
            "Consent-aware forms and event reporting that show which public paths create a useful next step.",
            "Formulieren en eventrapportage met aandacht voor toestemming, zodat zichtbaar wordt welke publieke routes tot een bruikbare vervolgstap leiden.",
            "نماذج وتقارير أحداث تراعي الموافقة وتوضح أي المسارات العامة تقود إلى خطوة تالية مفيدة.",
        ),
        status: "shipped",
    },
    {
        id: "conversion-popups",
        systemId: "presence-conversion",
        label: copy("Conversion popups", "Conversie-pop-ups", "نوافذ التحويل المنبثقة"),
        publicDescription: copy(
            "Timed and exit-intent newsletter or booking prompts, configured around a defined conversion path.",
            "Nieuwsbrief- en boekingsprompts op timing of exit-intent, ingericht rond een duidelijk conversiepad.",
            "دعوات للنشرة أو الحجز بالتوقيت أو عند نية المغادرة، مهيأة حول مسار تحويل محدد.",
        ),
        status: "configured",
    },
    {
        id: "booking-checkout",
        systemId: "client-business-operations",
        label: copy("Booking and checkout", "Boekingen en checkout", "الحجز والدفع"),
        publicDescription: copy(
            "Availability, reservations, and PayPal checkout for the published booking services.",
            "Beschikbaarheid, reserveringen en checkout voor de gepubliceerde boekingsdiensten.",
            "التوفر والحجوزات والدفع للخدمات المنشورة.",
        ),
        status: "shipped",
        limitation: copy(
            "Availability and payment remain subject to the published service configuration.",
            "Beschikbaarheid en betaling volgen de gepubliceerde serviceconfiguratie.",
            "يظل التوفر والدفع خاضعين لإعداد الخدمة المنشور.",
        ),
    },
    {
        id: "content-studio",
        systemId: "authority-publishing",
        label: copy("Content Studio", "Content Studio", "استوديو المحتوى"),
        publicDescription: copy(
            "Structured drafting, review, images, and voice output for articles and campaign assets.",
            "Gestructureerd schrijven, beoordelen, beeld en spraak voor artikelen en campagne-assets.",
            "صياغة ومراجعة وصور ومخرجات صوتية منظمة للمقالات ومواد الحملات.",
        ),
        status: "shipped",
    },
    {
        id: "authority-publishing-loop",
        systemId: "authority-publishing",
        label: copy("Governed publishing loop", "Beheerde publicatielus", "حلقة النشر المحكومة"),
        publicDescription: copy(
            "Draft, review, publish, and improve evidence-backed editorial work.",
            "Redigeer, beoordeel, publiceer en verbeter redactioneel werk met bewijs.",
            "صياغة ومراجعة ونشر وتحسين العمل التحريري المدعوم بالأدلة.",
        ),
        status: "shipped",
    },
    {
        id: "seo-control-center",
        systemId: "discoverability-growth",
        label: copy("SEO Control Center", "SEO Control Center", "مركز تحكم SEO"),
        publicDescription: copy(
            "Reviewable SEO recommendations with preview, apply, and rollback workflows.",
            "Controleerbare SEO-aanbevelingen met preview-, toepas- en terugdraaistromen.",
            "توصيات SEO قابلة للمراجعة مع معاينة وتطبيق وتراجع.",
        ),
        status: "shipped",
    },
    {
        id: "editorial-seo-enhancement",
        systemId: "discoverability-growth",
        label: copy("Editorial SEO improvement", "Redactionele SEO-verbetering", "تحسين السيو التحريري"),
        publicDescription: copy(
            "Reviewable improvements for headings, metadata, internal links, citations, and content structure.",
            "Controleerbare verbeteringen voor koppen, metadata, interne links, bronnen en contentstructuur.",
            "تحسينات قابلة للمراجعة للعناوين والبيانات الوصفية والروابط الداخلية والمصادر وبنية المحتوى.",
        ),
        status: "shipped",
    },
    {
        id: "ai-assisted-workflows",
        systemId: "authority-publishing",
        label: copy("AI-assisted workflows", "AI-ondersteunde workflows", "سير العمل المدعوم بالذكاء الاصطناعي"),
        publicDescription: copy(
            "Metered AI assistance with review, permissions, and an activity record.",
            "AI-ondersteuning met metering, review, rechten en een activiteitenregistratie.",
            "مساعدة ذكاء اصطناعي مع قياس ومراجعة وصلاحيات وسجل نشاط.",
        ),
        status: "shipped",
        limitation: copy(
            "AI output is assisted work and remains subject to human review.",
            "AI-output is ondersteunend werk en blijft onderworpen aan menselijke controle.",
            "مخرجات الذكاء الاصطناعي عمل مساعد وتظل خاضعة للمراجعة البشرية.",
        ),
    },
    {
        id: "newsletter-lifecycle",
        systemId: "authority-publishing",
        label: copy("Newsletter lifecycle", "Nieuwsbriefcyclus", "دورة النشرة البريدية"),
        publicDescription: copy(
            "Consent-aware subscription, confirmation, preference, and unsubscribe flows.",
            "Toestemmingsbewuste inschrijving, bevestiging, voorkeuren en uitschrijving.",
            "تدفقات اشتراك وتأكيد وتفضيلات وإلغاء اشتراك تراعي الموافقة.",
        ),
        status: "shipped",
    },
    {
        id: "podcast-video-production",
        systemId: "authority-publishing",
        label: copy("Podcast and video production", "Podcast- en videoproductie", "إنتاج البودكاست والفيديو"),
        publicDescription: copy(
            "Structured production surfaces for reusable audio and video publishing.",
            "Gestructureerde productieworkflows voor herbruikbare audio- en videopublicatie.",
            "واجهات إنتاج منظمة للنشر الصوتي والمرئي القابل لإعادة الاستخدام.",
        ),
        status: "configured",
    },
    {
        id: "voice-music-library",
        systemId: "authority-publishing",
        label: copy("Voice and music libraries", "Stem- en muziekbibliotheken", "مكتبتا الصوت والموسيقى"),
        publicDescription: copy(
            "Reusable approved voices, intros, beds, and outros for consistent audio production.",
            "Herbruikbare goedgekeurde stemmen, intro's, beds en outro's voor consistente audioproductie.",
            "أصوات ومقدمات وخلفيات ونهايات معتمدة وقابلة لإعادة الاستخدام لإنتاج صوتي متسق.",
        ),
        status: "configured",
    },
    {
        id: "legal-vault",
        systemId: "trust-commercial-control",
        label: copy("Legal and commercial records", "Juridische en commerciële dossiers", "السجلات القانونية والتجارية"),
        publicDescription: copy(
            "Agreements, signing events, invoices, and bookkeeping records with controlled access.",
            "Overeenkomsten, ondertekengebeurtenissen, facturen en boekhouding met gecontroleerde toegang.",
            "اتفاقيات وأحداث توقيع وفواتير وسجلات محاسبية بصلاحيات مضبوطة.",
        ),
        status: "shipped",
    },
    {
        id: "bookkeeping-commercial-ops",
        systemId: "trust-commercial-control",
        label: copy("Invoices and bookkeeping", "Facturen en boekhouding", "الفواتير ومسك الدفاتر"),
        publicDescription: copy(
            "Controlled invoice, receipt, ledger, and Dutch VAT-preparation records inside the workspace.",
            "Beheerde factuur-, bon-, grootboek- en btw-voorbereidingsdossiers in de werkruimte.",
            "سجلات مضبوطة للفواتير والإيصالات ودفتر الحسابات والتحضير لضريبة القيمة المضافة الهولندية داخل مساحة العمل.",
        ),
        status: "shipped",
    },
    {
        id: "gdpr-consent-controls",
        systemId: "trust-commercial-control",
        label: copy("GDPR and consent controls", "GDPR- en toestemmingsbeheer", "ضوابط اللائحة العامة وحماية الموافقة"),
        publicDescription: copy(
            "Consent settings, data-subject request tracking, retention choices, and anti-abuse records.",
            "Toestemmingsinstellingen, DSR-tracking, bewaarkeuzes en anti-misbruikregistratie.",
            "إعدادات الموافقة وتتبع طلبات أصحاب البيانات وخيارات الاحتفاظ وسجلات مكافحة الإساءة.",
        ),
        status: "shipped",
        limitation: copy(
            "The platform supports a compliance posture; the workspace operator retains legal obligations.",
            "Het platform ondersteunt de compliance-inrichting; de werkruimtebeheerder houdt eigen wettelijke verplichtingen.",
            "تدعم المنصة وضع الامتثال، بينما يحتفظ مشغل مساحة العمل بالتزاماته القانونية.",
        ),
    },
    {
        id: "client-work-sla",
        systemId: "client-business-operations",
        label: copy("Client records, work queues, and SLA operations", "Klantdossiers, werkwachtrijen en SLA-operatie", "سجلات العملاء وقوائم العمل وعمليات مستوى الخدمة"),
        publicDescription: copy(
            "A controlled operating layer for client records, assigned work, attention flags, and service deadlines.",
            "Een beheerde operationele laag voor klantdossiers, toegewezen werk, aandachtssignalen en servicedeadlines.",
            "طبقة تشغيل مضبوطة لسجلات العملاء والعمل المسند وإشارات الانتباه ومواعيد الخدمة.",
        ),
        status: "configured",
    },
    {
        id: "partner-portal",
        systemId: "client-business-operations",
        label: copy("Partner portal", "Partnerportal", "بوابة الشركاء"),
        publicDescription: copy(
            "A workspace-scoped client view for the records and actions a partner is allowed to see.",
            "Een werkruimtegebonden klantweergave voor dossiers en acties die een partner mag zien.",
            "عرض عميل مقيد بمساحة العمل للسجلات والإجراءات المسموح للشريك برؤيتها.",
        ),
        status: "shipped",
    },
    {
        id: "public-tools",
        systemId: "discoverability-growth",
        label: copy("Public diagnostic tools", "Publieke diagnostische tools", "أدوات التشخيص العامة"),
        publicDescription: copy(
            "Focused tools that help a visitor understand a problem before a commercial conversation.",
            "Gerichte tools die een bezoeker helpen een probleem te begrijpen vóór een commercieel gesprek.",
            "أدوات مركزة تساعد الزائر على فهم المشكلة قبل المحادثة التجارية.",
        ),
        status: "configured",
        limitation: copy(
            "A tool result is a starting point, not a guaranteed business outcome.",
            "Een toolresultaat is een startpunt, geen gegarandeerd bedrijfsresultaat.",
            "نتيجة الأداة نقطة بداية وليست نتيجة أعمال مضمونة.",
        ),
    },
    {
        id: "opportunity-and-market-signals",
        systemId: "discoverability-growth",
        label: copy("Opportunity and market signals", "Kansen- en marktsignalen", "إشارات الفرص والسوق"),
        publicDescription: copy(
            "Signals for review and prioritisation across the operating system.",
            "Signalen voor beoordeling en prioritering binnen het operating system.",
            "إشارات للمراجعة وتحديد الأولويات داخل نظام التشغيل.",
        ),
        status: "assisted",
    },
    {
        id: "multilingual-public-site",
        systemId: "presence-conversion",
        label: copy("EN/NL/AR public experience", "Publieke ervaring in EN/NL/AR", "تجربة عامة بالإنجليزية والهولندية والعربية"),
        publicDescription: copy(
            "Localized public content with Arabic RTL support and preserved commercial facts.",
            "Gelokaliseerde publieke content met Arabische RTL-ondersteuning en gelijke commerciële feiten.",
            "محتوى عام محلي مع دعم RTL للعربية وحقائق تجارية متسقة.",
        ),
        status: "shipped",
    },
    {
        id: "autonomous-agents",
        systemId: "client-business-operations",
        label: copy("Autonomous AI agents", "Autonome AI-agents", "وكلاء ذكاء اصطناعي مستقلون"),
        publicDescription: copy(
            "Not part of the current public offer.",
            "Geen onderdeel van het huidige publieke aanbod.",
            "ليست جزءًا من العرض العام الحالي.",
        ),
        status: "roadmap",
    },
] as const;

export const ISYSTEM_PUBLIC_SCOPE_COLUMNS: readonly IsystemPublicScopeColumn[] = [
    {
        id: "foundation",
        label: copy("Foundation System", "Foundation System", "نظام التأسيس"),
        description: copy(
            "The managed public and measurement layer a service business needs before adding more operating loops.",
            "De beheerde publieke en meetbare basis voordat een dienstverlener meer operationele lussen toevoegt.",
            "الطبقة العامة وطبقة القياس المُدارتان اللتان تحتاجهما شركة الخدمات قبل إضافة حلقات تشغيل أخرى.",
        ),
        items: [
            copy("Managed website and conversion paths", "Beheerde website en conversiepaden", "موقع مُدار ومسارات تحويل"),
            copy("Structured content and EN/NL/AR localization", "Gestructureerde content en EN/NL/AR-lokalisatie", "محتوى منظم وتوطين بالإنجليزية والهولندية والعربية"),
            copy("Lead capture, analytics, and GDPR foundations", "Leadopvang, analytics en GDPR-basis", "جمع العملاء المحتملين والتحليلات وأساسيات GDPR"),
            copy("Ongoing care, review, and accountable ownership", "Doorlopend beheer, review en duidelijk eigenaarschap", "رعاية ومراجعة مستمرة وملكية واضحة"),
        ],
    },
    {
        id: "growth",
        label: copy("Growth Operating System", "Growth Operating System", "نظام تشغيل النمو"),
        description: copy(
            "Foundation plus the connected publishing, search, audience, booking, and market-signal workflows.",
            "Foundation plus verbonden workflows voor publicatie, zoekverkeer, publiek, boekingen en marktsignalen.",
            "نظام التأسيس إضافة إلى تدفقات مترابطة للنشر والبحث والجمهور والحجز وإشارات السوق.",
        ),
        items: [
            copy("Content Studio and governed AI review", "Content Studio en gecontroleerde AI-review", "استوديو المحتوى ومراجعة الذكاء الاصطناعي المحكومة"),
            copy("SEO Control Center and editorial improvement", "SEO Control Center en redactionele verbetering", "مركز تحكم السيو والتحسين التحريري"),
            copy("Newsletter, booking, checkout, and conversion popups", "Nieuwsbrief, boekingen, checkout en conversie-pop-ups", "النشرة والحجز والدفع ونوافذ التحويل"),
            copy("Opportunity, market-monitoring, podcast, video, voice, and music workflows", "Kansen, marktmonitoring, podcast, video, stem en muziek", "تدفقات الفرص ومراقبة السوق والبودكاست والفيديو والصوت والموسيقى"),
        ],
    },
    {
        id: "embedded",
        label: copy("Separately scoped", "Apart afgesproken", "بنطاق منفصل"),
        description: copy(
            "Work that needs its own diagnosis, agreement, or operating responsibility is priced and documented separately.",
            "Werk met een eigen diagnose, overeenkomst of operationele verantwoordelijkheid krijgt een aparte scope en prijs.",
            "العمل الذي يحتاج تشخيصًا أو اتفاقية أو مسؤولية تشغيلية خاصة يُسعّر ويوثّق بصورة منفصلة.",
        ),
        items: [
            copy("Systems Blueprint: 90-minute session and written map", "Systems Blueprint: werksessie van 90 minuten en schriftelijke kaart", "مخطط الأنظمة: جلسة 90 دقيقة وخريطة مكتوبة"),
            copy("Embedded specialist engagements for defined projects", "Inzet als embedded specialist voor afgebakende projecten", "تعاون متخصص مدمج لمشاريع محددة"),
            copy("Third-party subscriptions, media, and external services", "Externe abonnementen, media en diensten", "الاشتراكات والوسائط والخدمات الخارجية"),
            copy("Metered AI usage beyond the included operating work", "Gemeten AI-gebruik buiten het inbegrepen werk", "استخدام الذكاء الاصطناعي المقاس خارج العمل المشمول"),
        ],
    },
    {
        id: "boundary",
        label: copy("What we do not promise", "Wat we niet beloven", "ما لا نعد به"),
        description: copy(
            "The system is reviewable and operated with you. It is not sold as autonomous or unlimited.",
            "Het systeem is controleerbaar en wordt samen met je bediend. Het wordt niet verkocht als autonoom of onbeperkt.",
            "النظام قابل للمراجعة ويُشغّل معك، ولا يُباع بصفته ذاتيًا أو غير محدود.",
        ),
        items: [
            copy("No autonomous agents acting without review", "Geen autonome agents die zonder review handelen", "لا وكلاء مستقلون يتصرفون دون مراجعة"),
            copy("No unlimited AI or hidden third-party costs", "Geen onbeperkte AI of verborgen externe kosten", "لا ذكاء اصطناعي غير محدود ولا تكاليف خارجية مخفية"),
            copy("No guaranteed rankings, leads, revenue, or compliance outcome", "Geen garantie op rankings, leads, omzet of compliance-uitkomst", "لا ضمان للترتيب أو العملاء المحتملين أو الإيرادات أو نتيجة الامتثال"),
            copy("No multi-team agency or 24/7 enterprise delivery promise", "Geen multi-team agency of 24/7 enterprise-deliverybelofte", "لا وعد بوكالة متعددة الفرق أو تنفيذ مؤسسي على مدار الساعة"),
        ],
    },
] as const;

export type IsystemPublicClaimViolation =
    | "autonomous-ai"
    | "guaranteed-outcome"
    | "replaces-everything"
    | "fully-integrated";

const CLAIM_GUARDRAILS: ReadonlyArray<{
    code: IsystemPublicClaimViolation;
    pattern: RegExp;
}> = [
    { code: "autonomous-ai", pattern: /\bautonomous\s+(?:ai|artificial intelligence)|\bautonomous\s+agents?\b/i },
    { code: "guaranteed-outcome", pattern: /\bguarantee(?:s|d)?\b[^.\n]{0,80}\b(?:result|outcome|growth|roi|revenue|conversion)/i },
    { code: "replaces-everything", pattern: /\b(?:replace|replaces|replacing)\b[^.\n]{0,60}\b(?:every|all|your)\s+(?:tool|software|system|stack)/i },
    { code: "fully-integrated", pattern: /\bfully\s+integrated\b/i },
];

export function findIsystemPublicClaimViolations(copyText: string): IsystemPublicClaimViolation[] {
    return CLAIM_GUARDRAILS
        .filter(({ pattern }) => pattern.test(copyText))
        .map(({ code }) => code);
}

export function getIsystemPublicCapability(id: string): IsystemPublicCapability | undefined {
    return ISYSTEM_PUBLIC_CAPABILITIES.find((capability) => capability.id === id);
}
