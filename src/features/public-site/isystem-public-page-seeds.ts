import type { PublicPagePuckDataV2, PublicPagePuckBlock } from "./public-page-contract";
import { getIsystemPublicBlockDefaults } from "./isystem-public-copy";

const block = (type: string, id: string, props: Record<string, unknown> = {}): PublicPagePuckBlock => ({
    type,
    props: { id, ...getIsystemPublicBlockDefaults(type), ...props },
});

export function createIsystemPublicPageData(pageKind: "home" | "services" | "about" | "contact" | "system-proof"): PublicPagePuckDataV2 {
    const common: PublicPagePuckDataV2["root"]["props"] = {
        title: pageKind === "home" ? "iSystem.ai — Digital Operating System" : `iSystem.ai ${pageKind}`,
        locale: "en",
        pageKind,
        pageIntent: pageKind === "home" ? "buyer-outcome" : `${pageKind}-decision`,
        presetId: pageKind === "home" ? "home" : pageKind === "services" ? "offer" : pageKind,
        themeVariant: pageKind === "system-proof" ? "proof" : "default",
        chromeMode: "default",
        metadata: {
            seoTitle: pageKind === "home" ? "iSystem.ai — One accountable digital system" : undefined,
            seoDescription: "Founder-led digital operating systems for Dutch service SMEs: website, content, SEO, newsletter, booking, client operations, governed AI, legal records, and commercial control.",
            pageIntent: pageKind === "home" ? "buyer-outcome" : `${pageKind}-decision`,
        },
    };

    const home: PublicPagePuckBlock[] = [
        block("OutcomeHero", "home-outcome-hero", {
            eyebrow: {
                en: "Founder-led digital systems for Dutch service SMEs",
                nl: "Founder-led digitale systemen voor Nederlandse dienstverleners",
                ar: "أنظمة رقمية يقودها المؤسس للشركات الخدمية الهولندية",
            },
            headline: {
                en: "Run the public, growth, and client side of the business as one system.",
                nl: "Beheer de publieke, groei- en klantkant van je bedrijf als één systeem.",
                ar: "شغّل الجانب العام والنمو وعمليات العملاء في عملك كنظام واحد.",
            },
            subtitle: {
                en: "iSystem brings your website, content, SEO, newsletter, booking, client workflows, governed AI, and commercial records into one managed workspace — with Hossam accountable for the operating layer.",
                nl: "iSystem brengt je website, content, SEO, nieuwsbrief, boekingen, klantwerk, gecontroleerde AI en commerciële dossiers samen in één beheerde werkruimte — met Hossam als aanspreekpunt.",
                ar: "يجمع iSystem موقعك ومحتواك والسيو والنشرة والحجوزات وتدفقات العملاء والذكاء الاصطناعي المحكوم والسجلات التجارية في مساحة عمل مُدارة واحدة، مع تحمّل حسام مسؤولية طبقة التشغيل.",
            },
            primaryCtaLabel: { en: "Book the free Systems Fit Call", nl: "Plan de gratis Systems Fit Call", ar: "احجز مكالمة ملاءمة الأنظمة المجانية" },
            primaryCtaHref: "/booking",
            secondaryCtaLabel: { en: "See how the system works", nl: "Bekijk hoe het systeem werkt", ar: "اكتشف كيف يعمل النظام" },
            secondaryCtaHref: "/services#system-map",
            commercialLine: { en: "Foundation €3,900 + €249/month · Growth €7,500 + €699/month · excl. VAT, external services, and metered AI.", nl: "Foundation €3.900 + €249/maand · Growth €7.500 + €699/maand · excl. btw, externe diensten en gemeten AI.", ar: "نظام التأسيس €3,900 + €249 شهريًا · نظام النمو €7,500 + €699 شهريًا · لا تشمل ضريبة القيمة المضافة والخدمات الخارجية والذكاء الاصطناعي المقاس." },
        }),
        block("ProblemRecognition", "home-recognition", {
            eyebrow: { en: "Recognition", nl: "Herkenning", ar: "المشكلة" },
            title: { en: "The problem is rarely one missing tool.", nl: "Het probleem is zelden één ontbrekende tool.", ar: "المشكلة نادرًا ما تكون أداة واحدة مفقودة." },
        }),
        block("SystemMap", "home-system-map", {
            eyebrow: { en: "The system map", nl: "De systeemkaart", ar: "خريطة النظام" },
            title: { en: "Five connected systems. One accountable operating layer.", nl: "Vijf verbonden systemen. Eén verantwoordelijke operationele laag.", ar: "خمسة أنظمة مترابطة. طبقة تشغيل واحدة واضحة المسؤولية." },
            description: { en: "From the website and content to bookings, client work, legal records, and follow-up: each capability has a place and an owner.", nl: "Van website en content tot boekingen, klantwerk, juridische dossiers en opvolging: elk onderdeel heeft een plek en een eigenaar.", ar: "من الموقع والمحتوى إلى الحجوزات وعمل العملاء والسجلات القانونية والمتابعة: لكل قدرة مكان ومالك واضح." },
        }),
        block("OperatingLoop", "home-working-proof", {
            eyebrow: { en: "Working proof", nl: "Werkend bewijs", ar: "دليل عملي" },
            title: { en: "A visible chain from evidence to delivery.", nl: "Een zichtbare keten van bewijs naar levering.", ar: "سلسلة واضحة من الدليل إلى التنفيذ." },
        }),
        block("OfferComparison", "home-offer-comparison", {
            eyebrow: { en: "The offer", nl: "Het aanbod", ar: "العرض" },
            title: { en: "Choose the operating shape that matches the work.", nl: "Kies de operationele vorm die bij het werk past.", ar: "اختر شكل التشغيل الذي يناسب العمل." },
        }),
        block("MethodTimeline", "home-method", { eyebrow: { en: "The method", nl: "De methode", ar: "المنهج" } }),
        block("FeatureStatusMatrix", "home-capability-status", {
            eyebrow: { en: "Selected capabilities", nl: "Geselecteerde onderdelen", ar: "قدرات مختارة" },
            title: { en: "The operating capabilities buyers ask about first.", nl: "De operationele onderdelen waar kopers het eerst naar vragen.", ar: "القدرات التشغيلية التي يسأل عنها المشترون أولًا." },
            capabilityIds: [
                "public-presence",
                "content-studio",
                "seo-control-center",
                "newsletter-lifecycle",
                "booking-checkout",
                "opportunity-and-market-signals",
                "ai-assisted-workflows",
                "legal-vault",
            ],
        }),
        block("FounderWorkingModel", "home-founder", { eyebrow: { en: "Founder working model", nl: "Founder-led werken", ar: "نموذج عمل المؤسس" } }),
        block("FitAndNonFit", "home-fit", { fitEyebrow: { en: "Good fit", nl: "Goede fit", ar: "ملاءمة جيدة" }, nonFitEyebrow: { en: "Not a fit", nl: "Geen fit", ar: "ليست ملاءمة" } }),
        block("QuestionAccordion", "home-faq", { eyebrow: { en: "Questions", nl: "Vragen", ar: "الأسئلة" } }),
        block("FinalDecisionCta", "home-final-cta", { eyebrow: { en: "The next decision", nl: "De volgende beslissing", ar: "القرار التالي" } }),
    ];

    const services: PublicPagePuckBlock[] = [
        block("OutcomeHero", "services-outcome-hero", {
            eyebrow: { en: "Services", nl: "Diensten", ar: "الخدمات" },
            headline: { en: "The services behind one managed business workspace.", nl: "De diensten achter één beheerde bedrijfswerkruimte.", ar: "الخدمات التي تقف خلف مساحة عمل مُدارة واحدة." },
            subtitle: { en: "Start with a managed Foundation or connect the full Growth system across publishing, search, booking, client operations, and commercial control.", nl: "Start met een beheerde Foundation of verbind het volledige Growth-systeem voor publicatie, zoeken, boekingen, klantwerk en commerciële controle.", ar: "ابدأ بنظام تأسيس مُدار أو اربط نظام النمو الكامل عبر النشر والبحث والحجز وعمليات العملاء والتحكم التجاري." },
            secondaryCtaLabel: { en: "Review every service", nl: "Bekijk alle diensten", ar: "راجع جميع الخدمات" },
            secondaryCtaHref: "/services#system-map",
            showEvidence: false,
        }),
        block("ServiceArchitecture", "services-system-architecture", {
            eyebrow: { en: "Five systems", nl: "Vijf systemen", ar: "خمسة أنظمة" },
            title: { en: "Every service has a place in the operating system.", nl: "Elke dienst heeft een plek in het operating system.", ar: "لكل خدمة مكان في نظام التشغيل." },
            description: { en: "Review the complete scope: public presence, publishing and media, discoverability, bookings and client work, governed AI, GDPR, legal records, and bookkeeping.", nl: "Bekijk de volledige scope: publieke aanwezigheid, publicatie en media, vindbaarheid, boekingen en klantwerk, gecontroleerde AI, GDPR, juridische dossiers en boekhouding.", ar: "راجع النطاق الكامل: الحضور العام والنشر والوسائط والاكتشاف والحجوزات وعمل العملاء والذكاء الاصطناعي المحكوم وGDPR والسجلات القانونية ومسك الدفاتر." },
        }),
        block("OperatingLoop", "services-operating-loop", {
            eyebrow: { en: "How the parts connect", nl: "Hoe de onderdelen verbinden", ar: "كيف تتصل الأجزاء" },
            title: { en: "One chain from expertise to demand, delivery, and a usable record.", nl: "Eén keten van expertise naar vraag, levering en een bruikbaar dossier.", ar: "سلسلة واحدة من الخبرة إلى الطلب والتنفيذ وسجل قابل للاستخدام." },
        }),
        block("OfferComparison", "services-offer-comparison"),
        block("ScopeBoundary", "services-scope-boundary", {
            eyebrow: { en: "Scope and boundaries", nl: "Scope en grenzen", ar: "النطاق والحدود" },
            title: { en: "Know what is included before the work begins.", nl: "Weet vóór de start wat wel en niet is inbegrepen.", ar: "اعرف ما هو مشمول قبل بدء العمل." },
        }),
        block("MethodTimeline", "services-method", {
            eyebrow: { en: "From fit to operation", nl: "Van fit naar operatie", ar: "من الملاءمة إلى التشغيل" },
            title: { en: "Diagnose only as far as the next responsible decision requires.", nl: "Onderzoek alleen zo ver als nodig is voor de volgende verantwoorde beslissing.", ar: "شخّص بالقدر الذي يتطلبه القرار المسؤول التالي." },
        }),
        block("FounderWorkingModel", "services-founder", {
            eyebrow: { en: "Direct accountability", nl: "Directe verantwoordelijkheid", ar: "مسؤولية مباشرة" },
        }),
        block("QuestionAccordion", "services-faq", {
            eyebrow: { en: "Service questions", nl: "Vragen over de diensten", ar: "أسئلة حول الخدمات" },
            title: { en: "Commercial facts before a proposal.", nl: "Commerciële feiten vóór een voorstel.", ar: "الحقائق التجارية قبل العرض." },
        }),
        block("FinalDecisionCta", "services-final-cta"),
    ];

    const about: PublicPagePuckBlock[] = [
        block("OutcomeHero", "about-outcome-hero", {
            eyebrow: { en: "About iSystem.ai", nl: "Over iSystem.ai", ar: "عن iSystem.ai" },
            headline: { en: "Built from operating experience and Dutch SME research.", nl: "Gebouwd vanuit operationele ervaring en onderzoek naar het Nederlandse mkb.", ar: "مبني على خبرة تشغيلية وبحث في الشركات الهولندية الصغيرة والمتوسطة." },
            subtitle: { en: "Hossam Afifi built iSystem after running education, recruitment, publishing, and consulting work across Egypt, Georgia, and the Netherlands. His Rotterdam MSc thesis examined AI adoption in Dutch SMEs; this workspace is the implementation response.", nl: "Hossam Afifi bouwde iSystem na werk in onderwijs, recruitment, publicatie en consultancy in Egypte, Georgië en Nederland. Zijn Rotterdamse masterscriptie onderzocht AI-adoptie in het Nederlandse mkb; deze werkruimte is het praktische antwoord.", ar: "بنى حسام عفيفي iSystem بعد عمله في التعليم والتوظيف والنشر والاستشارات في مصر وجورجيا وهولندا. درست رسالة الماجستير في روتردام تبنّي الذكاء الاصطناعي في الشركات الهولندية؛ ومساحة العمل هذه هي الاستجابة العملية." },
            showEvidence: false,
            showCommercial: false,
        }),
        block("FounderWorkingModel", "about-founder", { eyebrow: { en: "Founder working model", nl: "Founder-led werken", ar: "نموذج عمل المؤسس" } }),
        block("FeatureStatusMatrix", "about-status", {
            eyebrow: { en: "Governed by design", nl: "Beheerst vanuit het ontwerp", ar: "محوكم بالتصميم" },
            title: { en: "The controls behind the founder-led model.", nl: "De controle achter het founder-led model.", ar: "الضوابط وراء النموذج الذي يقوده المؤسس." },
            capabilityIds: [
                "ai-assisted-workflows",
                "gdpr-consent-controls",
                "legal-vault",
                "bookkeeping-commercial-ops",
                "multilingual-public-site",
                "partner-portal",
            ],
        }),
        block("FinalDecisionCta", "about-final-cta"),
    ];

    const contact: PublicPagePuckBlock[] = [
        block("OutcomeHero", "contact-outcome-hero", {
            eyebrow: { en: "Start with fit", nl: "Begin met fit", ar: "ابدأ بالملاءمة" },
            headline: { en: "Start with the right operating question.", nl: "Begin met de juiste operationele vraag.", ar: "ابدأ بسؤال التشغيل الصحيح." },
            subtitle: { en: "Tell Hossam where the operation loses clarity. The free Fit Call determines whether iSystem is the responsible next step.", nl: "Vertel Hossam waar de operatie helderheid verliest. De gratis Fit Call bepaalt of iSystem de verantwoorde volgende stap is.", ar: "أخبر حسام أين تفقد العملية وضوحها. تحدد مكالمة الملاءمة المجانية ما إذا كان iSystem هو الخطوة التالية المسؤولة." },
            showEvidence: false,
            showCommercial: false,
        }),
        block("ContactExperience", "contact-experience", {
            title: { en: "One conversation before any proposal.", nl: "Eén gesprek vóór ieder voorstel.", ar: "محادثة واحدة قبل أي عرض." },
        }),
        block("FitAndNonFit", "contact-fit"),
    ];

    const systemProof: PublicPagePuckBlock[] = [
        block("OutcomeHero", "system-proof-hero", { eyebrow: { en: "System proof fixture", nl: "Systeem-bewijsfixture", ar: "مثال دليل النظام" }, headline: { en: "Evidence, status, and the next decision in one view.", nl: "Bewijs, status en de volgende beslissing in één overzicht.", ar: "الدليل والحالة والقرار التالي في عرض واحد." } }),
        block("SystemMap", "system-proof-map"),
        block("OperatingLoop", "system-proof-loop"),
        block("FeatureStatusMatrix", "system-proof-status", { showRoadmap: true }),
        block("FinalDecisionCta", "system-proof-cta"),
    ];

    return {
        schemaVersion: 2,
        root: { props: common },
        content: pageKind === "home" ? home : pageKind === "services" ? services : pageKind === "about" ? about : pageKind === "contact" ? contact : systemProof,
        zones: {},
    };
}

export function createIsystemCaseStudyPageData(): PublicPagePuckDataV2 {
    return {
        schemaVersion: 2,
        root: {
            props: {
                title: "Case study — legal firm migration",
                locale: "en",
                pageKind: "case-study",
                pageIntent: "case-study",
                presetId: "case",
                themeVariant: "proof",
                chromeMode: "default",
                metadata: {
                    seoTitle: "Case study — legal firm migration | iSystem.ai",
                    seoDescription: "A structural case study about migrating bilingual legal publishing, intake, and governance onto one accountable workspace.",
                    noindex: true,
                },
            },
        },
        content: [
            block("OutcomeHero", "legal-case-hero", {
                eyebrow: { en: "Case study · evidence in preparation", nl: "Case study · bewijs in voorbereiding", ar: "دراسة حالة · الدليل قيد الإعداد" },
                headline: { en: "Migrating a regional law firm onto one governed workspace.", nl: "Een regionaal advocatenkantoor migreren naar één beheerde werkruimte.", ar: "نقل مكتب محاماة إقليمي إلى مساحة عمل محكومة واحدة." },
                subtitle: { en: "The public record is limited to the structural deployment. Client identity and commercial outcomes remain private until permissioned evidence is approved.", nl: "Het publieke record blijft beperkt tot de structurele implementatie. Cliëntidentiteit en commerciële resultaten blijven privé totdat bewijs is goedgekeurd.", ar: "يقتصر السجل العام على التنفيذ الهيكلي. تظل هوية العميل والنتائج التجارية خاصة حتى اعتماد الدليل المصرح به." },
            }),
            block("OutcomeCaseStudy", "legal-case-outcome", {
                eyebrow: { en: "Baseline · intervention · status", nl: "Nulmeting · interventie · status", ar: "الخط الأساسي · التدخل · الحالة" },
                title: { en: "The verifiable outcome is structural, not an invented ROI claim.", nl: "Het verifieerbare resultaat is structureel, geen verzonnen ROI-claim.", ar: "النتيجة القابلة للتحقق هيكلية وليست ادعاء عائد استثماري مختلق." },
                description: { en: "29 long-form articles, bilingual structure, an internal-link graph, GDPR posture, and a public intake portal are the recorded deployment elements. Traffic, revenue, and lead attribution are not published without permission.", nl: "29 lange artikelen, tweetalige structuur, een interne-linkgraaf, GDPR-instellingen en een publieke intakeportal zijn de vastgelegde implementatie-elementen. Verkeer, omzet en lead-attributie worden niet zonder toestemming gepubliceerd.", ar: "29 مقالًا مطولًا وبنية ثنائية اللغة ورسم روابط داخلية ووضع GDPR وبوابة استقبال عامة هي عناصر التنفيذ المسجلة. لا تُنشر حركة المرور أو الإيرادات أو إسناد العملاء المحتملين دون إذن." },
            }),
            block("ProofLedger", "legal-case-proof-ledger", {
                eyebrow: { en: "Evidence ledger", nl: "Bewijsledger", ar: "سجل الأدلة" },
                title: { en: "Source, date, limitation, next review.", nl: "Bron, datum, beperking, volgende review.", ar: "المصدر والتاريخ والحدود والمراجعة التالية." },
            }),
            block("FinalDecisionCta", "legal-case-cta"),
        ],
        zones: {},
    };
}

/**
 * Proof-index fallback used while permissioned client evidence is being
 * prepared. It keeps the public route honest and prevents another template's
 * case-study catalogue from leaking into the iSystem fork.
 */
export function createIsystemProofIndexPageData(): PublicPagePuckDataV2 {
    return {
        schemaVersion: 2,
        root: {
            props: {
                title: "Proof in preparation",
                locale: "en",
                pageKind: "projects",
                pageIntent: "proof-readiness",
                presetId: "projects",
                themeVariant: "proof",
                chromeMode: "default",
                metadata: {
                    seoTitle: "Proof in preparation | iSystem.ai",
                    seoDescription: "iSystem publishes delivery evidence only when the source, date, permission, and limitation are clear.",
                    noindex: true,
                    pageIntent: "proof-readiness",
                },
            },
        },
        content: [
            block("OutcomeHero", "proof-index-hero", {
                eyebrow: { en: "Proof · evidence in preparation", nl: "Bewijs · bewijs in voorbereiding", ar: "الدليل · الدليل قيد الإعداد" },
                headline: { en: "We publish delivery evidence when the record is ready to stand behind.", nl: "We publiceren leveringsbewijs zodra het dossier klaar is om ervoor te staan.", ar: "ننشر أدلة التنفيذ عندما يصبح السجل جاهزًا لتحمّل المسؤولية عنه." },
                subtitle: { en: "Client identity, commercial outcomes, and performance metrics stay private until the evidence is dated, permissioned, and reviewable. This page is deliberately transparent while that record is being prepared.", nl: "Cliëntidentiteit, commerciële uitkomsten en prestatiemetrics blijven privé totdat het bewijs gedateerd, geautoriseerd en controleerbaar is. Deze pagina blijft bewust transparant terwijl het dossier wordt voorbereid.", ar: "تبقى هوية العميل والنتائج التجارية ومقاييس الأداء خاصة حتى يصبح الدليل مؤرخًا ومصرحًا به وقابلًا للمراجعة. تظل هذه الصفحة شفافة عمدًا أثناء إعداد السجل." },
                primaryCtaLabel: { en: "Book the free Systems Fit Call", nl: "Plan de gratis Systems Fit Call", ar: "احجز مكالمة ملاءمة الأنظمة المجانية" },
                primaryCtaHref: "/booking",
                secondaryCtaLabel: { en: "See how the system works", nl: "Bekijk hoe het systeem werkt", ar: "اكتشف كيف يعمل النظام" },
                secondaryCtaHref: "/services#system-map",
            }),
            block("DemoEvidenceGrid", "proof-index-record", {
                eyebrow: { en: "Evidence standard", nl: "Bewijsstandaard", ar: "معيار الدليل" },
                title: { en: "Source · date · permission · limitation", nl: "Bron · datum · toestemming · beperking", ar: "المصدر · التاريخ · الإذن · الحدود" },
                description: { en: "A case study belongs in the public proof layer only when its baseline, intervention, evidence source, owner, and limitations can be named. Until then, the honest status is evidence in preparation — never an invented metric or anonymous success story presented as finished proof.", nl: "Een case study hoort pas in de publieke bewijslayer wanneer nulmeting, interventie, bron, eigenaar en beperkingen benoemd kunnen worden. Tot die tijd is de eerlijke status bewijs in voorbereiding — nooit een verzonnen metric of anoniem succesverhaal als afgerond bewijs.", ar: "لا تنتمي دراسة الحالة إلى طبقة الدليل العامة إلا عندما يمكن تسمية خط الأساس والتدخل ومصدر الدليل والمالك والحدود. وحتى ذلك الحين تكون الحالة بصراحة قيد إعداد الدليل — لا مقياسًا مختلقًا ولا قصة نجاح مجهولة تُقدَّم كدليل مكتمل." },
            }),
            block("ProofLedger", "proof-index-ledger", {
                eyebrow: { en: "Current status", nl: "Huidige status", ar: "الحالة الحالية" },
                title: { en: "Public proof is pending permissioned evidence.", nl: "Publiek bewijs wacht op geautoriseerde evidence.", ar: "الدليل العام ينتظر الأدلة المصرح بها." },
                description: { en: "The system demo, public tools, and source-backed editorial notes remain available as inspectable surfaces. Client-specific outcomes will be added only after the owner approves what can be published.", nl: "De systeemdemo, publieke tools en bron-gedragen redactionele notities blijven als inspecteerbare oppervlakken beschikbaar. Cliëntspecifieke resultaten worden pas toegevoegd nadat de eigenaar heeft goedgekeurd wat gepubliceerd mag worden.", ar: "يبقى عرض النظام والأدوات العامة والملاحظات التحريرية المدعومة بالمصادر متاحًا كأسطح قابلة للفحص. ولن تُضاف نتائج خاصة بالعملاء إلا بعد موافقة المالك على ما يمكن نشره." },
            }),
            block("FinalDecisionCta", "proof-index-cta"),
        ],
        zones: {},
    };
}
