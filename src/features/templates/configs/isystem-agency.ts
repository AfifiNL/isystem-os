import type { TemplateConfig } from "../types";
import { PersonalBrandBlogIndex } from "../pages/personal-brand/blog-index";
import { PersonalBrandPodcastIndex } from "../pages/personal-brand/podcast-index";
import { PersonalBrandPodcastShow } from "../pages/personal-brand/podcast-show";
import { PersonalBrandPodcastEpisode } from "../pages/personal-brand/podcast-episode";
import { PersonalBrandBlogPost } from "../pages/personal-brand/blog-post";
import { PersonalBrandVideosIndex } from "../pages/personal-brand/videos-index";
import { PersonalBrandVideosDetail } from "../pages/personal-brand/videos-detail";
import { ISYSTEM_PUBLIC_POSITIONING } from "@/features/marketing/isystem-public-truth";

export const isystemAgencyConfig: TemplateConfig = {
    id: "isystem-agency",
    name: "iSystem.ai — Digital Operating System",
    description: ISYSTEM_PUBLIC_POSITIONING.en,
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "#1769AA",
        primaryForeground: "#FFFFFF",
        accent: "#9A7335",
        accentForeground: "#102432",
        gradientFrom: "#1769AA",
        gradientTo: "#0D568F",
        shadowTint: "shadow-slate-900/10",
    },
    designTokens: {
        surfaces: {
            canvas: "#FBFAF7",
            light: "#FFFFFF",
            soft: "#F1F4F4",
            dark: "#0B2239",
            darkStrong: "#102432",
            inverse: "#0B2239",
            inverseRaised: "#132F49",
            glass: "#FFFFFF",
            premium: "#0B2239",
            premiumRaised: "#132F49",
        },
        borders: {
            subtle: "#D7DFE2",
            soft: "#E7EEF1",
            strong: "#B8C7CD",
            inverse: "rgba(255, 255, 255, 0.16)",
            accent: "#9A7335",
            accentSoft: "rgba(154, 115, 53, 0.28)",
        },
        text: {
            primary: "#102432",
            secondary: "#425563",
            subtle: "#5A6D78",
            inverse: "#FFFFFF",
            inverseMuted: "rgba(255, 255, 255, 0.78)",
            inverseSubtle: "rgba(255, 255, 255, 0.58)",
            accent: "#1769AA",
            accentStrong: "#0D568F",
        },
        motion: {
            fast: "160ms",
            base: "260ms",
            slow: "420ms",
            easeStandard: "cubic-bezier(0.22, 1, 0.36, 1)",
            easeEmphasis: "cubic-bezier(0.16, 1, 0.3, 1)",
        },
        depth: {
            sm: "0 18px 50px rgba(16, 36, 50, 0.10)",
            md: "0 18px 50px rgba(16, 36, 50, 0.10)",
            lg: "0 18px 50px rgba(16, 36, 50, 0.10)",
            glow: "none",
        },
        radii: {
            md: "8px",
            lg: "12px",
            xl: "18px",
            pill: "999px",
        },
        typography: {
            displaySm: "clamp(2.5rem, 4.6vw, 4rem)",
            displayMd: "clamp(3rem, 6vw, 5rem)",
            displayLg: "clamp(3.5rem, 7vw, 5.5rem)",
        },
    },
    appearance: {
        defaultMode: "light",
        allowVisitorToggle: false,
        inverseSections: ["workspace-demo", "governance", "product-cockpit", "final-cta", "footer"],
    },
    fonts: { heading: "Instrument Sans", body: "Inter" },
    navLinks: [
        { href: "/services#system-map", label: { en: "Systems", nl: "Systemen", ar: "الأنظمة" } },
        { href: "/services", label: { en: "Services", nl: "Diensten", ar: "الخدمات" } },
        { href: "/projects", label: { en: "Proof", nl: "Bewijs", ar: "الدليل" } },
        { href: "/blog", label: { en: "Insights", nl: "Inzichten", ar: "رؤى" } },
        { href: "/about", label: { en: "About", nl: "Over", ar: "من نحن" } },
    ],
    navMenus: [
        {
            id: "services",
            href: "/services",
            label: { en: "Services", nl: "Diensten", ar: "الخدمات" },
            items: [
                { href: "/services#foundation", label: { en: "Foundation System", nl: "Foundation System", ar: "نظام التأسيس" }, blurb: { en: "A managed digital foundation", nl: "Een beheerde digitale basis", ar: "أساس رقمي مُدار" } },
                { href: "/services#growth", label: { en: "Growth Operating System", nl: "Growth Operating System", ar: "نظام تشغيل النمو" }, blurb: { en: "Connected loops for ongoing growth", nl: "Verbonden lussen voor blijvende groei", ar: "حلقات مترابطة للنمو المستمر" } },
                { href: "/services#blueprint", label: { en: "Systems Blueprint", nl: "Systems Blueprint", ar: "مخطط الأنظمة" }, blurb: { en: "A written map before implementation", nl: "Een schriftelijke kaart vóór implementatie", ar: "خريطة مكتوبة قبل التنفيذ" } },
                { href: "/services#embedded", label: { en: "Embedded Systems Engagement", nl: "Embedded Systems Engagement", ar: "التعاون المدمج" }, blurb: { en: "Proposal-only specialist support", nl: "Specialistische ondersteuning op voorstel", ar: "دعم متخصص حسب العرض" } },
            ],
        },
        {
            id: "systems",
            href: "/services#system-map",
            label: { en: "Systems", nl: "Systemen", ar: "الأنظمة" },
            items: [
                { href: "/services#presence-conversion", label: { en: "Presence & Conversion", nl: "Aanwezigheid & conversie", ar: "الحضور والتحويل" } },
                { href: "/services#authority-publishing", label: { en: "Authority & Publishing", nl: "Autoriteit & publicatie", ar: "الخبرة والنشر" } },
                { href: "/services#discoverability-growth", label: { en: "Discoverability & Growth", nl: "Vindbaarheid & groei", ar: "الاكتشاف والنمو" } },
                { href: "/services#client-business-operations", label: { en: "Client & Business Operations", nl: "Klant- & bedrijfsoperatie", ar: "عمليات العملاء والأعمال" } },
                { href: "/services#trust-commercial-control", label: { en: "Trust & Commercial Control", nl: "Vertrouwen & controle", ar: "الثقة والتحكم التجاري" } },
            ],
        },
        {
            id: "proof",
            href: "/projects",
            label: { en: "Proof", nl: "Bewijs", ar: "الدليل" },
            items: [
                { href: "/projects", label: { en: "System demo", nl: "Systeemdemo", ar: "عرض النظام" } },
                { href: "/blog", label: { en: "Delivery evidence", nl: "Leveringsbewijs", ar: "أدلة التنفيذ" } },
                { href: "/tools", label: { en: "Public tools", nl: "Publieke tools", ar: "أدوات عامة" } },
            ],
        },
        {
            id: "insights",
            href: "/blog",
            label: { en: "Insights", nl: "Inzichten", ar: "رؤى" },
            items: [
                { href: "/blog", label: { en: "Articles", nl: "Artikelen", ar: "المقالات" } },
                { href: "/podcast", label: { en: "Podcast", nl: "Podcast", ar: "البودكاست" } },
                { href: "/videos", label: { en: "Videos", nl: "Video's", ar: "الفيديوهات" } },
            ],
        },
        {
            id: "about",
            href: "/about",
            label: { en: "About", nl: "Over", ar: "من نحن" },
            items: [
                { href: "/about", label: { en: "Hossam and the research", nl: "Hossam en het onderzoek", ar: "حسام والبحث" } },
                { href: "/contact", label: { en: "Working model", nl: "Werkmodel", ar: "نموذج العمل" } },
            ],
        },
    ],
    socialLinks: [
        { href: "https://www.linkedin.com/in/hossamafifi", icon: "Linkedin", label: "LinkedIn" },
        { href: "https://isystem.ai", icon: "Globe", label: "Website" },
        { href: "mailto:hossam@isystem.ai", icon: "Mail", label: "Email" },
    ],
    hero: {
        badge: {
            en: "From Breda · built from Dutch SME research · governed by design",
            nl: "Vanuit Breda · gebouwd vanuit mkb-onderzoek · governed by design",
            ar: "من بريدا · مبني على بحث في الشركات الهولندية الصغيرة · محوكم بالتصميم",
        },
        headline: {
            en: ["Turn", "a", "scattered", "digital", "operation", "into", "one", "accountable", "system."],
            nl: ["Maak", "van", "een", "verspreide", "digitale", "operatie", "één", "verantwoordelijk", "systeem."],
            ar: ["حوّل", "عملية", "رقمية", "متفرقة", "إلى", "نظام", "واحد", "واضح", "المسؤولية."],
        },
        gradientWordStart: -1,
        subtitle: {
            en: "iSystem designs, implements, and operates the public presence, publishing, growth, and commercial controls around your service business — with Hossam accountable for the system.",
            nl: "iSystem ontwerpt, implementeert en bedient de publieke aanwezigheid, publicatie, groei en commerciële controle rond je dienstverlenende bedrijf — met Hossam als verantwoordelijke operator.",
            ar: "يصمم iSystem وينفذ ويدير الحضور العام والنشر والنمو والضوابط التجارية حول أعمالك الخدمية، مع تحمل حسام مسؤولية النظام.",
        },
        primaryCta: {
            href: "/booking",
            label: {
                en: "Book the free Systems Fit Call",
                nl: "Plan de gratis Systems Fit Call",
                ar: "احجز مكالمة ملاءمة الأنظمة المجانية",
            },
        },
        secondaryCta: {
            href: "/services#offers",
            label: { en: "See how the system works", nl: "Bekijk hoe het systeem werkt", ar: "اكتشف كيف يعمل النظام" },
        },
    },
    footer: {
        brandDescription: {
                en: "A clear operating layer for SMEs — built and operated from Breda by Hossam Afifi. Governed AI workflows, EN/NL/AR with native RTL, KvK-registered.",
            nl: "Een digitaal besturingssysteem voor het mkb — gebouwd en bediend vanuit Breda door Hossam Afifi. Governed AI, EN/NL/AR met native RTL, KvK-geregistreerd.",
            ar: "نظام تشغيل رقمي للشركات الصغيرة والمتوسطة — يبنيه ويُشغّله من بريدا حسام عفيفي. ذكاء اصطناعي محوكم، إنجليزي/هولندي/عربي بدعم RTL أصلي، مسجَّل لدى KvK.",
        },
        linkColumns: {
            Services: [
                { href: "/services#foundation", label: { en: "Foundation System", nl: "Foundation System", ar: "نظام التأسيس" } },
                { href: "/services#growth", label: { en: "Growth Operating System", nl: "Growth Operating System", ar: "نظام تشغيل النمو" } },
                { href: "/services#blueprint", label: { en: "Systems Blueprint", nl: "Systems Blueprint", ar: "مخطط الأنظمة" } },
                { href: "/services#embedded", label: { en: "Embedded Engagement", nl: "Embedded Engagement", ar: "التعاون المدمج" } },
            ],
            Systems: [
                { href: "/services#presence-conversion", label: { en: "Presence & Conversion", nl: "Aanwezigheid & conversie", ar: "الحضور والتحويل" } },
                { href: "/services#authority-publishing", label: { en: "Authority & Publishing", nl: "Autoriteit & publicatie", ar: "الخبرة والنشر" } },
                { href: "/services#discoverability-growth", label: { en: "Discoverability & Growth", nl: "Vindbaarheid & groei", ar: "الاكتشاف والنمو" } },
                { href: "/services#client-business-operations", label: { en: "Client & Business Operations", nl: "Klant- & bedrijfsoperatie", ar: "عمليات العملاء والأعمال" } },
                { href: "/services#trust-commercial-control", label: { en: "Trust & Commercial Control", nl: "Vertrouwen & controle", ar: "الثقة والتحكم التجاري" } },
            ],
            Proof: [
                { href: "/projects", label: { en: "System demo", nl: "Systeemdemo", ar: "عرض النظام" } },
                { href: "/blog", label: { en: "Delivery evidence", nl: "Leveringsbewijs", ar: "أدلة التنفيذ" } },
                { href: "/tools", label: { en: "Public tools", nl: "Publieke tools", ar: "أدوات عامة" } },
            ],
            About: [
                { href: "/about", label: { en: "About", nl: "Over", ar: "من نحن" } },
                { href: "/blog", label: { en: "Insights", nl: "Inzichten", ar: "رؤى" } },
                { href: "/contact", label: { en: "Contact", nl: "Contact", ar: "اتصل بنا" } },
            ],
        },
        ctaTitle: {
            en: "First, confirm that the system fits.",
            nl: "Bepaal eerst of het systeem bij je bedrijf past.",
            ar: "ابدأ أولًا بالتأكد من ملاءمة النظام لعملك.",
        },
        ctaDescription: {
            en: "The free 30-minute Systems Fit Call is a qualification conversation with Hossam. We clarify the outcome, your current setup, and whether iSystem is a sensible fit. It is not a free audit or report.",
            nl: "De gratis Systems Fit Call van 30 minuten is een eerste gesprek met Hossam. We bespreken je doel, je huidige situatie en of iSystem logisch past. Het is geen gratis audit of rapport.",
            ar: "مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة هي محادثة تأهيل أولية مع حسام. نوضح النتيجة المطلوبة ووضعك الحالي وما إذا كان iSystem مناسبًا. وهي ليست تدقيقًا أو تقريرًا مجانيًا.",
        },
        ctaLink: {
            href: "/booking",
            label: { en: "Book the free Fit Call", nl: "Plan de gratis Fit Call", ar: "احجز مكالمة الملاءمة المجانية" },
        },
        copyright: {
            en: "© {year} iSystem.ai. All rights reserved.",
            nl: "© {year} iSystem.ai. Alle rechten voorbehouden.",
            ar: "© {year} iSystem.ai. جميع الحقوق محفوظة.",
        },
    },
    pages: {
        blog: {
            title: { en: "Systems Thinking", nl: "Systeemdenken", ar: "تفكير نظامي" },
            subtitle: { en: "Field notes", nl: "Veldnotities", ar: "ملاحظات ميدانية" },
            description: {
                en: "Field notes from the gap between research and implementation: Dutch SME AI adoption, legal preparation, digital presence, customer-centric operations, and the governed workspace we operate every day.",
                nl: "Veldnotities uit de kloof tussen onderzoek en uitvoering: AI-adoptie in het Nederlandse mkb, juridische voorbereiding, digitale aanwezigheid, klantgerichte operatie en de governed workspace die we dagelijks gebruiken.",
                ar: "ملاحظات ميدانية من المسافة بين البحث والتنفيذ: تبنّي الذكاء الاصطناعي في الشركات الهولندية، الاستعداد القانوني، الحضور الرقمي، التشغيل المرتكز على العميل، ومساحة العمل المحوكمة التي نشغّلها يوميًا.",
            },
        },
        about: {
            title: { en: "About iSystem.ai", nl: "Over iSystem.ai", ar: "عن iSystem.ai" },
            headline: {
                en: "Built by an operator who has been the SME, the recruiter, and the consultant.",
                nl: "Gebouwd door iemand die zelf het mkb, de werving en de consultancy heeft gedaan.",
                ar: "بناه مشغّل عاش دور الشركة الصغيرة والمسؤول عن التوظيف والمستشار.",
            },
            description: {
                en: "Hossam Afifi runs iSystem.ai from Breda. The platform grew out of three chapters — education in Egypt, recruitment and digital marketing in Georgia, and a Rotterdam MSc thesis on how Dutch SMEs adapt to AI, regulation, and digital competition.",
                nl: "Hossam Afifi runt iSystem.ai vanuit Breda. Het platform komt voort uit drie hoofdstukken: onderwijs in Egypte, werving en digitale marketing in Georgië, en een Rotterdamse masterscriptie over hoe Nederlandse MKB-bedrijven omgaan met AI, regelgeving en digitale concurrentie.",
                ar: "يدير حسام عفيفي iSystem.ai من بريدا. نشأت المنصّة من ثلاثة فصول: التعليم في مصر، والتوظيف والتسويق الرقمي في جورجيا، ورسالة ماجستير في روتردام حول كيفية تكيّف الشركات الهولندية الصغيرة والمتوسطة مع الذكاء الاصطناعي والتنظيم والمنافسة الرقمية.",
            },
        },
        contact: {
            title: { en: "Start with a free Systems Fit Call", nl: "Begin met een gratis Systems Fit Call", ar: "ابدأ بمكالمة ملاءمة الأنظمة المجانية" },
            subtitle: {
                en: "Thirty minutes to qualify the need and the fit. No free audit, report, or implementation work.",
                nl: "Dertig minuten om je vraag en de wederzijdse fit te beoordelen. Geen gratis audit, rapport of implementatiewerk.",
                ar: "ثلاثون دقيقة لتقييم الحاجة ومدى الملاءمة، من دون تدقيق أو تقرير أو تنفيذ مجاني.",
            },
        },
        newsletter: {
            title: { en: "Systems Brief", nl: "Systems Brief", ar: "موجز الأنظمة" },
            description: {
                en: "Twice a month, never on Mondays. Field notes from operating the platform and from the research that produced the MSc thesis on AI adoption in Dutch SMEs.",
                nl: "Twee keer per maand, nooit op maandag. Veldnotities uit het werken met het platform en uit het onderzoek achter de masterscriptie over AI-adoptie in Nederlandse mkb's.",
                ar: "مرّتان شهريًا، وليس يوم الإثنين. ملاحظات ميدانية من تشغيل المنصّة ومن البحث الذي أنتج أطروحة الماجستير حول تبنّي الذكاء الاصطناعي في الشركات الهولندية الصغيرة والمتوسطة.",
            },
        },
        videos: {
            title: { en: "Workspace walkthroughs", nl: "Workspace-walkthroughs", ar: "جولات داخل مساحة العمل" },
            subtitle: { en: "Demos, not promos", nl: "Demo's, geen reclame", ar: "عروض حقيقية لا ترويج" },
            description: {
                en: "Recorded screen-by-screen tours of the actual workspace: SEO Control Center, Opportunity Engine, Newsletter, Booking, Podcast Studio, AI ledger.",
                nl: "Opgenomen scherm-voor-scherm tours van de echte werkruimte: SEO Control Center, Opportunity Engine, nieuwsbrief, boekingen, Podcast Studio, AI-grootboek.",
                ar: "جولات مسجَّلة شاشةً بشاشة لمساحة العمل الفعلية: SEO Control Center وOpportunity Engine والنشرة البريدية والحجوزات وPodcast Studio وسجل الذكاء الاصطناعي.",
            },
        },
        services: {
            title: { en: "Services", nl: "Diensten", ar: "الخدمات" },
            subtitle: {
                en: "A managed foundation or a complete growth operating system",
                nl: "Een beheerde basis of een compleet groeisysteem",
                ar: "أساس رقمي مُدار أو نظام تشغيل متكامل للنمو",
            },
            description: {
                en: "Foundation System delivers a managed website, structured content, lead capture, analytics, and GDPR foundations. Growth Operating System adds the shipped content, SEO, booking, newsletter, opportunity, market-monitoring, podcast, and popup workflows—with AI usage metered separately in a visible ledger.",
                nl: "Foundation System levert een beheerde website, gestructureerde content, leadopvang, analytics en een GDPR-basis. Growth Operating System voegt de bestaande workflows voor content, SEO, boekingen, nieuwsbrief, kansen, marktmonitoring, podcast en pop-ups toe. AI-gebruik wordt apart gemeten en staat zichtbaar in het grootboek.",
                ar: "يوفّر نظام التأسيس موقعًا مُدارًا ومحتوى منظمًا ونماذج لجمع العملاء المحتملين وتحليلات وأساسًا لإعدادات GDPR. ويضيف نظام تشغيل النمو سير العمل المتاح للمحتوى والسيو والحجوزات والنشرات والفرص ومراقبة السوق والبودكاست والنوافذ المنبثقة، مع قياس استخدام الذكاء الاصطناعي بصورة منفصلة في سجل ظاهر.",
            },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "ServicesList" },
        { component: "TestimonialsCarousel" },
        { component: "NewsletterCTA" },
    ],
    renderers: {
        blogIndex: PersonalBrandBlogIndex,
        blogPost: PersonalBrandBlogPost,
        podcastIndex: PersonalBrandPodcastIndex,
        podcastShow: PersonalBrandPodcastShow,
        podcastEpisode: PersonalBrandPodcastEpisode,
        videoIndex: PersonalBrandVideosIndex,
        videoDetail: PersonalBrandVideosDetail,
    },
    aiContext: {
        industry: "Digital operating system for SMEs and selected enterprise-embedded engagements; governed AI workflows; Netherlands-based founder-led consultancy grounded in Rotterdam MSc research on Dutch SME adaptation, AI integration, legal preparation, and digital competition.",
        brandVoice: "Sober EU-register founder voice. Specifics over adjectives. Avoid hype, vague transformation promises, and unreviewable AI claims. CTAs name action, time, person, next step. Read-aloud test: if it sounds like a press release, it isn't shipped.",
        targetAudience: "Marije — Dutch SME founder, 5–50 employees, services business, tool-fatigued, agency-skeptical, reads English fluently but treats Dutch as a respect signal. Jeroen — operations director at NL/EU mid-size firm, 50+ employees, scoping embedded specialist support; cares about audit trails, GDPR, traceability. Karim — international operator on the Egypt → Gulf → Europe arc, multilingual operations, often regulated industries; values trilingual presence.",
        contentPillars: [
            "Governed AI for SMEs — pre-flight metering, append-only ledger, preview/apply/rollback on every edit",
            "Desktop-OS workspaces — one place to run a service business instead of six tools",
            "Self-improving content systems — internal-link graph, learned authority domains, opportunity feed, market monitor",
            "Sector playbooks — Horeca, education, legal firms, real estate, media agencies",
            "Founder-led delivery — no account-manager layer; the operator who built the platform is the contact",
            "Applied Dutch-market research — thesis findings on AI integration, legal preparation, cultural adaptation, and professional digital presence translated into product architecture",
        ],
        visualStyle: "Light-first public business system: warm white, soft blue, slate ink, restrained cyan, subtle gold, clean cards, readable spacing. Preserve dark inverse surfaces for product cockpit, governance proof, final CTA, and footer. Specific over decorative; Dutch-business clarity over AI-lab glow.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-sector-page",
                label: { en: "Draft sector page", nl: "Sectorpagina schrijven" },
                description: {
                    en: "Sector landing page anchored on workspace modules — pain, remedy, what-it-replaces, sector CTA",
                    nl: "Sector-landingpagina rond werkruimtemodules — pijn, oplossing, wat-het-vervangt, sector-CTA",
                },
                prompt: "Draft a sector landing page for a Dutch SME audience. Anchor on at least one of: desktop-OS workspace, governed AI ledger, learning system. Include a 'what this replaces' stack (specific competitor tools), a proof block, and a concrete CTA. No banned phrases. Read-aloud-clean.",
            },
            {
                id: "rewrite-cta",
                label: { en: "Rewrite a vague CTA", nl: "Vage CTA herschrijven" },
                description: {
                    en: "Replace 'Get started / Schedule a demo / Learn more' with action + time + person + next-step",
                    nl: "Vervang 'Get started / Schedule a demo / Learn more' door actie + tijd + persoon + vervolgstap",
                },
                prompt: "Rewrite this CTA to name the action, the time commitment, who they'll be speaking to, and what happens after. Floor: 'Plan a 30-min call with Hossam — no slides, no pitch deck.'",
            },
            {
                id: "honesty-check",
                label: { en: "Honesty check a claim", nl: "Eerlijkheidstoets uitvoeren" },
                description: {
                    en: "Verify a marketing claim against shipped capabilities — flag overpromises",
                    nl: "Verifieer een marketingclaim tegen wat geleverd is — flag overpromises",
                },
                prompt: "Check this claim against the platform's shipped capabilities. If the claim isn't supported, flag it and propose a grounded alternative. Phrase carefully: podcast production suite (not hosting), video generation queue (not automated production), founder-led specialist (not enterprise delivery team).",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for iSystem.ai. Read this as the upstream brief; it overrides any generic content instinct.

## Strategic frame — non-negotiable
iSystem.ai is a digital operating system for SMEs, governed by design, run by a single accountable founder. Not an agency. Not a SaaS. Not an AI tool. A third thing. Every public surface either restates this position or earns its absence. If a sentence could appear on any Dutch agency homepage within 50km of Breda, rewrite it.

## Three positioning anchors (every page rests on at least one)
1. Desktop OS metaphor — wallpaper, windowed apps, taskbar, Notes/Calculator/Voice Memo alongside Content Studio, SEO Control Center, Bookings, Newsletter, Podcast Studio. Mobile-adapted shell. Structurally true to the product.
2. Governed AI — bounded workspace budgets, reviewed public sources where evidence is needed, visible change previews, named approvals, and rollback. Public copy must describe buyer outcomes and control boundaries; never expose vendors, database terms, internal units, reason codes, or implementation identifiers.
3. The system that learns — Opportunity Engine → SEO Control Center → Content Graph → Newsletter → Podcast → Bookings, with link graph + learned authority domains + proposal events persisting per workspace. Wave 1 (write-side) is shipped; Wave 2 (read-side rankers) is roadmap. Frame honestly: "the system already remembers; soon it'll act on what it remembers."

## The founder is part of the moat
 Hossam Afifi: Egypt (European Scientific Center, programs reaching 150,000+ students; law degree, Mansoura 2015) → Georgia (Recruitment Partner at Ilia State, 300+ international students placed; Founder of Nomad Entrepreneur, 280% organic-traffic growth, Microsoft + IDFI.ge citations; published *SECRETS TO LIVING A BORDERLESS LIFE*) → Netherlands (MSc Consultancy & Entrepreneurship, Rotterdam Business School, 2024). The thesis studied how a Georgia-born consulting model should adapt to the Dutch SME market: high competition and buyer power; the need for legal preparation, cultural adaptation, customer-centricity, niche specialization, professional digital presence, and scalable technology-driven services; and the 2027–2030 trend line toward AI integration, digital ethics, and sustainability-driven innovation. iSystem is the productized answer to that research: not "AI tools", but a governed operating layer for Dutch SMEs. Strategic counsel at World Startup, Finance Matters, Immersive Tech Week; speaker at Venture Café Rotterdam; KvK-registered in Breda. EN C2, NL B1 (improving, native review on stakeholder copy), AR native.

## Audience — write to one archetype at a time
- Marije: Dutch SME founder, 5–50 employees, tool-fatigued, agency-skeptical. Hooks: governance over hype, founder relationship, "doe maar gewoon" tone, one workspace not six.
- Jeroen: NL/EU operations director, 50+ employees, scoping embedded specialist support. Hooks: governed AI moat, embedded specialist (not vendor), thesis-grade understanding of AI in Dutch SMEs.
- Karim: international operator (Egypt → Gulf → Europe), multilingual, often regulated industries. Hooks: trilingual workspace, cross-cultural founder, governance posture for regulated industries.

## Honesty contract — claimable vs. not
CLAIMABLE: desktop OS shell with windowed apps; multi-format AI drafting in five narrative styles; image gen + TTS; AI credit metering and ledger; SEO Control Center with preview/apply/rollback; Opportunity Engine; Market Monitor; Newsletter on Resend with Svix-verified webhooks; Booking Engine with four adapter templates; Podcast Studio with ElevenLabs voices and FFmpeg mixing; Workspace Popups; EN/NL/AR with RTL; GDPR settings + DSR tracking + anti-abuse logging.
NOT CLAIMABLE: natural-language conversational AI orchestrator; multi-window OS tiling, draggable icons, native mobile app; automatic Spotify/Apple Podcasts distribution; live recording / DAW-grade editing; semantic embedding-based ranker (Wave 1 is token-overlap); read-side feedback-loop consumers (Wave 2 roadmap); unsupervised agent execution; free / freemium tier; per-seat pricing; default compliance guarantees; enterprise security claims without evidence.
PHRASE CAREFULLY: "podcast production suite" not "podcast hosting platform"; "video generation queue" not "automated video production"; "founder-led specialist that can embed into larger teams" not "enterprise delivery team"; "governed AI workflows" or "reviewable AI editorial assistance" not "AI Orchestrator."

## Voice rules
- Specifics over adjectives. Numbers, names, dates, real phrases. Every concrete detail is a trust deposit.
- Sober, founder-led, EU register. Senior operator writing calmly to peers, not an evangelist preaching to a crowd.
- One idea per surface. A page that tries to make three points fails at all three.
- CTAs are concrete. Banned: "Get started," "Schedule a demo," "Learn more," "Click here." Floor: "Plan a 30-minute call with Hossam — no slides, no pitch deck."
- Cleverness loses to clarity. Pun headlines almost always lose.
- Read-aloud test. If the draft sounds like a press release, rewrite it.
- BANNED PHRASES (English): generic hype, unsupported AI capability adjectives, vague transformation promises, superiority claims, future guarantees, and invented proof.
- BANNED PHRASES (Dutch): "AI-aangedreven," "wij ontgrendelen het potentieel," "transformeren uw business."

## Locale rules
- EN aimed at NL buyers tilts toward sober EU register. American hyper-marketing tone is a tax in this market.
- NL: shorter sentences than EN equivalent (~30% shorter), strip 30% of adjectives, "vrijblijvend" not "gratis," "je" for SME founders / "u" for legal-enterprise. Pricing transparency rewarded. KvK number + address are trust signals.
- AR: MSA default for written B2B; flag market-specific calibration when relevant. RTL is a design conversation, flag layout implications.

## Rejection list — half the work
isystem is NOT for: VC-funded startups with 30-person growth teams; marketplace-style high-transaction businesses; buyers who want unmetered ungoverned AI sandboxes; multi-team agency-relationship buyers; markets where neither EN nor NL nor AR is the working language. State this explicitly on commercial pages — it is a trust-builder.

## Best-fit content types
Sector landing pages, comparison pages, governance pages, founder-narrative About-page surfaces, pillar/cluster blog posts grounded in the MSc thesis, NL-primary sector pages (Horeca, Legal, Education).
`,
};
