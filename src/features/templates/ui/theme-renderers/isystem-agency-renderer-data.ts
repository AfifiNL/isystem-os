import type { Json } from "@/shared/lib/supabase/database.types";
import {
    getLocaleValue,
    getRichTextLocaleValue,
    translateListItem,
    type AboutBlockProps,
    type CommitmentBlockProps,
    type ContactBlockProps,
    type CorePageKind,
    type FoundationBlockProps,
    type HeroBlockProps,
    type LocaleField,
    type LocaleListItem,
    type MethodologyBlockProps,
    type RichLocaleField,
    type ServiceItem,
    type ServicesShowcaseBlockProps,
    type StatsBlockProps,
} from "@/features/builder/facility-services-page-data";
import { isPublicBuilderData, normalizePublicBuilderData, type PublicBuilderData } from "@/features/builder/puck.config";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { pickLocaleText, pickLocaleTextList } from "@/shared/lib/i18n/resolve";

type PuckBlock = PublicBuilderData["content"][number];

// Pick one of three localized strings. Used for inline copy that isn't worth
// promoting to a LocaleText literal (deeply nested fallback strings inside
// renderer data builders).
function pick3(locale: Locale, en: string, nl: string, ar: string): string {
    if (locale === "nl") return nl;
    if (locale === "ar") return ar;
    return en;
}

// Builder-layer now supports ar natively (ar/richAr fields on LocaleField),
// so just pass the locale through. getLocaleValue/getRichTextLocaleValue
// fall back to en when ar is absent on a given field.
function getSupportedLocale(locale: Locale): "en" | "nl" | "ar" {
    return locale;
}

function sanitizeCoreVisualLayout(pageKind: CorePageKind, visualLayout: Json | null | undefined) {
    if (!isPublicBuilderData(visualLayout)) {
        return null;
    }

    try {
        return normalizePublicBuilderData(visualLayout, pageKind);
    } catch (err) {
        console.error(`[isystem-agency-renderer-data] normalizePublicBuilderData failed for pageKind=${pageKind}:`, err);
        return null;
    }
}

function extractBlock<T>(visualLayout: Json | null | undefined, pageKind: CorePageKind, blockType: string) {
    try {
        const data = sanitizeCoreVisualLayout(pageKind, visualLayout);
        if (!data || !Array.isArray(data.content)) {
            return null;
        }
        const block = data.content.find((item) => item?.type === blockType) as PuckBlock | undefined;
        if (!block?.props || typeof block.props !== "object") {
            return null;
        }
        return block.props as T | null;
    } catch (err) {
        console.error(`[isystem-agency-renderer-data] extractBlock failed for blockType=${blockType}:`, err);
        return null;
    }
}

function resolveField(locale: Locale, field: LocaleField | null | undefined, fallback: string) {
    if (!field) {
        return fallback;
    }

    const value = getLocaleValue(getSupportedLocale(locale), field).trim();
    return value.length > 0 ? value : fallback;
}

function resolveRichText(locale: Locale, field: LocaleField | RichLocaleField | null | undefined, fallback: string) {
    if (!field) {
        return fallback;
    }

    const value = getRichTextLocaleValue(getSupportedLocale(locale), field).trim();
    return value.length > 0 ? value : fallback;
}

function resolveListItems(locale: Locale, items: LocaleListItem[] | null | undefined, fallback: string[]) {
    if (!Array.isArray(items)) {
        return fallback;
    }

    const translated = items
        .filter((item) => item && typeof item === "object")
        .map((item) => translateListItem(getSupportedLocale(locale), item).trim())
        .filter((item) => item.length > 0);

    return translated.length > 0 ? translated : fallback;
}

function resolveServiceItems(locale: Locale, items: ServiceItem[] | null | undefined, fallback: Array<{ title: string; description: string; features: string[] }>) {
    if (!Array.isArray(items)) {
        return fallback;
    }

    const translated = items
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
            title: resolveField(locale, item.title, ""),
            description: resolveRichText(locale, item.description, ""),
            features: resolveListItems(locale, item.features, []),
        }))
        .filter((item) => item.title.length > 0 || item.description.length > 0 || item.features.length > 0);

    return translated.length > 0 ? translated : fallback;
}

export function buildIsystemHomePageData(config: TemplateConfig, locale: Locale, visualLayout?: Json | null) {
    const hero = extractBlock<HeroBlockProps>(visualLayout, "home", "HeroBlock");
    const stats = extractBlock<StatsBlockProps>(visualLayout, "home", "StatsBlock");
    const foundation = extractBlock<FoundationBlockProps>(visualLayout, "home", "FoundationBlock");
    const about = extractBlock<AboutBlockProps>(visualLayout, "home", "AboutBlock");
    const services = extractBlock<ServicesShowcaseBlockProps>(visualLayout, "home", "ServicesShowcaseBlock");
    const methodology = extractBlock<MethodologyBlockProps>(visualLayout, "home", "MethodologyBlock");
    const methodologySteps = methodology?.steps ?? [];

    const trustBadgesFallback = pick3(
        locale,
        "Rotterdam MSc research → product architecture|Governed AI: metered, reviewable, reversible|EN · NL · AR — RTL by design",
        "Rotterdamse masterscriptie → productarchitectuur|Governed AI: gemeten, controleerbaar, terug te draaien|EN · NL · AR — RTL ingebouwd",
        "بحث ماجستير في روتردام ← بنية المنتج|ذكاء اصطناعي محوكم: مُقاس وقابل للمراجعة والتراجع|إنجليزي · هولندي · عربي — دعم RTL مدمج",
    ).split("|");

    const homeServicesFallback = pick3(locale,
        "Production|The thesis pointed to professional digital presence as table stakes in the Dutch market. Content Studio turns that into governed blog, social, image, and TTS workflows with verified facts and rollback.||Growth|Dutch SMEs compete in a high-buyer-power market. SEO Control Center, Opportunity Engine, and Market Monitor make niche positioning and customer-centric content operational, not occasional.||Operations|Legal preparation and regulatory pressure showed up clearly in the research. Bookings, Newsletter, Client/SLA records, GDPR settings, popups, and portal workflows keep the operating layer inside one auditable workspace.",
        "Productie|De scriptie liet zien dat een professionele digitale aanwezigheid in Nederland geen luxe is. Content Studio vertaalt dat naar governed workflows voor blog, social, beeld en TTS, met fact-check en rollback.||Groei|Nederlandse MKB-bedrijven werken in een markt met sterke kopersmacht. SEO Control Center, Opportunity Engine en Market Monitor maken nichepositionering en klantgerichte content operationeel, niet incidenteel.||Operatie|Juridische voorbereiding en regeldruk kwamen duidelijk terug in het onderzoek. Boekingen, nieuwsbrief, cliënt/SLA-dossiers, GDPR-instellingen, popups en portal-workflows blijven in één controleerbare workspace.",
        "الإنتاج|أظهر البحث أن الحضور الرقمي المهني في السوق الهولندي لم يعد رفاهية. يحوّل Content Studio ذلك إلى سير عمل محوكمة للمدونة والمنشورات والصور والتعليق الصوتي مع تحقق وعودة.||النمو|تعمل الشركات الهولندية الصغيرة في سوق ذي قوة شراء مرتفعة. يجعل SEO Control Center وOpportunity Engine وMarket Monitor التخصص والمحتوى المرتكز على العميل عملًا تشغيليًا لا نشاطًا عابرًا.||التشغيل|ظهر الاستعداد القانوني والضغط التنظيمي بوضوح في البحث. تبقى الحجوزات والنشرة وسجلات العملاء وSLA وإعدادات GDPR والنوافذ وبوابة العملاء داخل مساحة واحدة قابلة للتدقيق.",
    ).split("||").map((entry) => {
        const [title, description] = entry.split("|");
        return { title: title ?? "", description: description ?? "", features: [] as string[] };
    });

    const whyPointsFallback = pick3(locale,
        "Workspace, not dashboard. Wallpaper, windowed apps, taskbar, productivity utilities — the place you run your business, not another admin tab.|Governed AI. Bounded budgets, reviewable changes, named approvals, and rollback before public or operational edits are accepted.|A system that learns. Internal-link history, reviewed authority sources, opportunities, and market signals help the workspace retain useful business context over time.",
        "Werkruimte, geen dashboard. Wallpaper, vensterapps, taakbalk, productiviteitstools — de plek waar u werkt, niet zomaar een admin-tab.|Governed AI. Begrensde budgetten, controleerbaar gebruik, benoemde goedkeuringen en rollback voordat publieke of operationele wijzigingen worden geaccepteerd.|Een systeem dat leert. Interne-linkgraaf, geleerde autoriteitsdomeinen, opportunity-feed, marktsignalen — de werkruimte wordt scherper in úw vak.",
        "مساحة عمل، لا لوحة قيادة. خلفية وتطبيقات بنوافذ وشريط مهام وأدوات إنتاجية — المكان الذي تدير منه عملك، لا تبويب إداري آخر.|ذكاء اصطناعي محوكم. ميزانيات محددة، واستخدام قابل للمراجعة، وموافقات واضحة، وإمكانية تراجع قبل اعتماد أي تعديل عام أو تشغيلي.|نظام يتعلّم. رسم بياني للروابط الداخلية، نطاقات سلطة مكتسبة، تيار فرص، إشارات السوق — تصبح مساحة العمل أكثر دقة في مجالك بمرور الوقت.",
    ).split("|");

    const methodologyDefaultFallback = pick3(locale,
        "Fit||Start with a free 30-minute Systems Fit Call. We qualify the need and mutual fit; no audit or written report is included.|||Blueprint||When the situation needs deeper analysis, the €490 Systems Blueprint maps the system, orders the priorities, and ends with a fixed proposal. It is fully credited to implementation when contracted within 30 days.|||Implement and operate||Choose the €3,900 Foundation System or €7,500 Growth Operating System. Hossam implements it, remains accountable after launch, and operates the agreed care cadence.",
        "Fit||Begin met een gratis Systems Fit Call van 30 minuten. We beoordelen de vraag en de wederzijdse fit; de call bevat geen audit of geschreven rapport.|||Blueprint||Is diepere analyse nodig, dan brengt de Systems Blueprint van €490 het systeem in kaart, zet de prioriteiten op volgorde en sluit af met een vaste offerte. Bij een implementatiecontract binnen 30 dagen wordt €490 volledig verrekend.|||Implementeren en beheren||Kies het Foundation System van €3.900 of het Growth Operating System van €7.500. Hossam implementeert het systeem, blijft na livegang verantwoordelijk en voert de afgesproken zorg uit.",
        "الملاءمة||ابدأ بمكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة. نقيّم الحاجة ومدى الملاءمة المتبادلة، ولا تشمل المكالمة تدقيقًا أو تقريرًا مكتوبًا.|||خارطة الأنظمة||عندما يحتاج الوضع إلى تحليل أعمق، ترسم خارطة الأنظمة بقيمة €490 النظام وترتّب الأولويات وتنتهي بعرض ثابت. تُحتسب قيمتها كاملة ضمن التنفيذ عند التعاقد خلال 30 يومًا.|||التنفيذ والتشغيل||اختر نظام التأسيس بقيمة €3,900 أو نظام تشغيل النمو بقيمة €7,500. ينفّذ حسام النظام ويظل مسؤولًا عنه بعد الإطلاق ويدير دورة الرعاية المتفق عليها.",
    ).split("|||").map((entry, idx) => {
        const [title, description] = entry.split("||");
        const stepNumber = String(idx + 1).padStart(2, "0");
        return { id: `step-${idx + 1}`, stepNumber, title: { en: title ?? "", nl: title ?? "", ar: title ?? "" } as LocaleField, description: { en: description ?? "", nl: description ?? "", ar: description ?? "" } as LocaleField };
    });

    return {
        badge: resolveField(locale, hero?.eyebrow, pickLocaleText(config.hero.badge, locale)),
        titleLineOne: resolveField(locale, hero?.titleLineOne, pickLocaleTextList(config.hero.headline, locale)[0] ?? ""),
        titleLineTwo: resolveField(locale, hero?.titleLineTwo, pickLocaleTextList(config.hero.headline, locale).slice(1).join(" ")),
        subtitle: resolveRichText(locale, hero?.subtitle, pickLocaleText(config.hero.subtitle, locale)),
        primaryCta: {
            label: resolveField(locale, hero?.primaryCta, pickLocaleText(config.hero.primaryCta.label, locale)),
            href: hero?.primaryHref?.trim() || config.hero.primaryCta.href,
        },
        secondaryCta: {
            label: resolveField(locale, hero?.secondaryCta, pickLocaleText(config.hero.secondaryCta.label, locale)),
            href: hero?.secondaryHref?.trim() || config.hero.secondaryCta.href,
        },
        trustBadges: resolveListItems(locale, hero?.trustBadges, trustBadgesFallback),
        stats: (Array.isArray(stats?.items) ? stats.items : [])
            .filter((item) => item && typeof item === "object")
            .map((item) => ({ value: String(item.value ?? ""), label: resolveField(locale, item.label, "") }))
            .filter((item) => item.value.trim().length > 0 && item.label.length > 0),
        operatingModelTitle: resolveField(locale, foundation?.title, pick3(locale, "What this actually is", "Wat dit feitelijk is", "ما هذا فعليًا")),
        operatingModelDescription: resolveRichText(
            locale,
            foundation?.description,
            pick3(locale,
                "iSystem.ai is a single workspace where a service business runs its public site, content, SEO, newsletter, podcast, bookings, GDPR, and analytics — without stitching together six separate tools. Built around a desktop OS metaphor, governed by an AI credit ledger, operated from Breda by Hossam Afifi.",
                "iSystem.ai is één werkruimte waarin een servicebedrijf de eigen website, content, SEO, nieuwsbrief, podcast, boekingen, GDPR en analytics draait. Gebouwd rond een desktop-OS-metafoor, beheerd via een AI-creditgrootboek, vanuit Breda door Hossam Afifi.",
                "‏iSystem.ai مساحة عمل واحدة يُدير من خلالها عملٌ خدمي موقعَه العام ومحتواه والسيو والنشرة البريدية والبودكاست والحجوزات وGDPR والتحليلات. مبنيّة حول استعارة نظام تشغيل سطح المكتب، محوكمة بسجل أرصدة ذكاء اصطناعي، تُدار من بريدا بواسطة حسام عفيفي.",
            ),
        ),
        operatingModelSupportLine: resolveRichText(
            locale,
            foundation?.supportLine,
            pick3(locale,
                "Research base: Rotterdam MSc work on Dutch SME adaptation — AI integration, legal preparation, cultural fit, and scalable digital services. Execution base: KvK-registered in Breda, built and operated by the same person.",
                "Onderzoeksbasis: Rotterdamse MSc over aanpassing aan de Nederlandse MKB-markt — AI-integratie, juridische voorbereiding, culturele fit en schaalbare digitale diensten. Uitvoering: KvK-geregistreerd in Breda, gebouwd en beheerd door dezelfde persoon.",
                "قاعدة البحث: ماجستير روتردام حول تكيّف الشركات الصغيرة مع السوق الهولندية — تكامل الذكاء الاصطناعي، الاستعداد القانوني، الملاءمة الثقافية، والخدمات الرقمية القابلة للتوسع. قاعدة التنفيذ: مسجّل في بريدا ويبنيه ويشغّله الشخص نفسه.",
            ),
        ),
        servicesEyebrow: resolveField(locale, services?.title, pickLocaleText(config.pages.services?.title, locale, pick3(locale, "Services", "Diensten", "الخدمات"))),
        servicesTitle: resolveRichText(
            locale,
            services?.subtitle,
            pickLocaleText(config.pages.services?.subtitle, locale, pick3(locale, "Digital systems services", "Digitale systeemdiensten", "خدمات الأنظمة الرقمية")),
        ),
        servicesDescription: resolveRichText(
            locale,
            services?.description,
            pickLocaleText(config.pages.services?.description, locale, ""),
        ),
        servicesList: resolveServiceItems(locale, services?.items, homeServicesFallback),
        whyEyebrow: resolveField(locale, about?.eyebrow, pick3(locale, "Three reasons it works", "Drie redenen dat het werkt", "ثلاثة أسباب تجعله ينجح")),
        whyTitle: resolveRichText(
            locale,
            about?.headline,
            pick3(locale,
                "Workspace, not dashboard. Governance, not hype. A system that learns at your business.",
                "Werkruimte, geen dashboard. Governance, geen hype. Een systeem dat leert in úw vak.",
                "مساحة عمل لا لوحة قيادة. حوكمة لا ضجيج. نظام يتعلّم في مجالك.",
            ),
        ),
        whyDescription: resolveRichText(locale, about?.description, ""),
        whyPoints: resolveListItems(locale, about?.whyPoints, whyPointsFallback),
        methodologyTitle: resolveField(locale, methodology?.title, pick3(locale, "Fit. Blueprint. Implement.", "Fit. Blueprint. Implementatie.", "ملاءمة. خارطة. تنفيذ.")),
        methodologySubtitle: resolveRichText(locale, methodology?.subtitle, ""),
        methodologySteps: (methodologySteps.length > 0 ? methodologySteps : methodologyDefaultFallback)
            .map((step) => ({
                stepNumber: step.stepNumber,
                title: resolveField(locale, step.title, ""),
                description: resolveRichText(locale, step.description, ""),
            }))
            .filter((step) => step.title.length > 0 || step.description.length > 0),
    };
}

export function buildIsystemAboutPageData(config: TemplateConfig, locale: Locale, visualLayout?: Json | null) {
    const about = extractBlock<AboutBlockProps>(visualLayout, "about", "AboutBlock");
    const commitment = extractBlock<CommitmentBlockProps>(visualLayout, "about", "CommitmentBlock");

    const whyPointsFallback = pick3(locale,
        "Egypt — built education systems that reached 150,000+ students; trained as a lawyer, so regulatory context is not an afterthought.|Georgia — ran Nomad Entrepreneur through recruitment, SEO, and cross-border business building; proved the operator side before building software for operators.|Netherlands — Rotterdam MSc research found the Dutch SME pattern: high competition, strong buyer power, legal preparation, cultural adaptation, and AI integration moving toward digital ethics. iSystem is that research turned into a working platform.",
        "Egypte — bouwde onderwijsprogramma's voor 150.000+ studenten; opgeleid als jurist, dus regelgeving is geen bijzaak.|Georgië — runde Nomad Entrepreneur via recruitment, SEO en grensoverschrijdende business building; eerst operator, daarna software voor operators.|Nederland — Rotterdams MSc-onderzoek liet het MKB-patroon zien: hoge concurrentie, sterke kopersmacht, juridische voorbereiding, culturele aanpassing en AI-integratie richting digitale ethiek. iSystem is dat onderzoek als werkend platform.",
        "مصر — بنى أنظمة تعليم وصلت إلى 150,000+ طالب؛ وتدرّب قانونيًا، لذلك لا تُعامل التنظيمات كفكرة لاحقة.|جورجيا — أدار Nomad Entrepreneur عبر التوظيف والسيو وبناء الأعمال العابرة للحدود؛ اختبر دور المشغّل قبل بناء البرمجيات للمشغّلين.|هولندا — كشف بحث الماجستير في روتردام النمط الهولندي: منافسة عالية، قوة شراء مرتفعة، استعداد قانوني، تكيّف ثقافي، وتكامل ذكاء اصطناعي يتجه نحو الأخلاقيات الرقمية. iSystem هو هذا البحث كمنصة عاملة.",
    ).split("|");

    return {
        eyebrow: resolveField(locale, about?.eyebrow, pickLocaleText(config.pages.about.title, locale)),
        headline: resolveRichText(locale, about?.headline, pickLocaleText(config.pages.about.headline, locale)),
        description: resolveRichText(locale, about?.description, pickLocaleText(config.pages.about.description, locale)),
        missionTitle: resolveField(locale, about?.missionTitle, pick3(locale, "How the work runs", "Hoe het werk loopt", "كيف يجري العمل")),
        missionText: resolveRichText(
            locale,
            about?.missionText,
            pick3(locale,
                "One operator, supported by AI agents inside the same governed workspace clients use. Less overhead, faster execution, every AI edit reviewable. The operator is the contact and the builder. There is no account-manager layer between you and the work.",
                "Eén operator, ondersteund door AI-agents binnen dezelfde governed workspace die klanten gebruiken. Minder overhead, snellere uitvoering, elke AI-bewerking herzienbaar. De operator is uw contact én de bouwer. Geen account-manager-laag ertussen.",
                "مشغّل واحد، تدعمه وكلاء ذكاء اصطناعي داخل مساحة العمل المحوكمة نفسها التي يستخدمها العملاء. أعباء أقل، تنفيذ أسرع، وكل تعديل ذكاء اصطناعي قابل للمراجعة. المشغّل هو نقطة التواصل وهو من يبني. لا طبقة مدير حسابات بينك وبين العمل.",
            ),
        ),
        visionTitle: resolveField(locale, about?.visionTitle, pick3(locale, "What is inside the workspace", "Wat er in de workspace zit", "ما يوجد داخل مساحة العمل")),
        visionText: resolveRichText(
            locale,
            about?.visionText,
            pick3(locale,
                "Inside the workspace: a desktop-style shell, governed drafting in five styles with metering and a ledger, SEO Control Center with preview/apply/rollback, Opportunity Engine, Market Monitor, newsletter on Resend, booking templates, Podcast Studio with ElevenLabs voices and FFmpeg mixing, and EN/NL/AR with RTL handling.",
                "In de workspace: een desktop-achtige shell, AI-drafting in vijf stijlen met metering en grootboek, SEO Control Center met preview/apply/rollback, Opportunity Engine, Market Monitor, nieuwsbrief op Resend, boekingstemplates, Podcast Studio met ElevenLabs-stemmen en FFmpeg-mix, en EN/NL/AR met RTL-ondersteuning.",
                "داخل مساحة العمل: واجهة بنمط سطح المكتب، صياغة بالذكاء الاصطناعي بخمسة أساليب مع قياس وسجل، SEO Control Center مع معاينة/تطبيق/تراجع، Opportunity Engine، Market Monitor، نشرة على Resend، قوالب حجز، Podcast Studio بأصوات ElevenLabs وخلط FFmpeg، وEN/NL/AR مع دعم RTL.",
            ),
        ),
        whyTitle: resolveField(locale, about?.whyTitle, pick3(locale, "The three chapters", "De drie hoofdstukken", "الفصول الثلاثة")),
        whyPoints: resolveListItems(locale, about?.whyPoints, whyPointsFallback),
        commitmentTitle: resolveField(locale, commitment?.title, pick3(locale, "What you actually get", "Wat u feitelijk krijgt", "ما تحصل عليه فعليًا")),
        commitmentDescription: resolveRichText(
            locale,
            commitment?.description,
            pick3(locale,
                "Direct access to the operator who built the platform. Founder reply within one business day. EN at C2, NL at B1 (improving, with native review on stakeholder copy), AR native. Published system prices and written scope before implementation. KvK-registered, GDPR-aware by design, ledger you can audit.",
                "Direct contact met de operator die het platform heeft gebouwd. Reactie binnen één werkdag. EN op C2, NL op B1 (in ontwikkeling, met native review van stakeholdercopy), AR moedertaal. Gepubliceerde systeemprijzen en een geschreven scope vóór implementatie. KvK-geregistreerd, GDPR-bewust ontworpen, met een controleerbaar grootboek.",
                "تواصل مباشر مع المشغّل الذي بنى المنصّة، ورد من المؤسس خلال يوم عمل واحد. الإنجليزية بمستوى C2، والهولندية بمستوى B1 مع مراجعة من ناطق أصلي للنصوص الموجهة لأصحاب المصلحة، والعربية لغة أم. أسعار الأنظمة منشورة، والنطاق مكتوب قبل التنفيذ. مسجَّل لدى KvK، ومصمم مع مراعاة GDPR، بسجل قابل للتدقيق.",
            ),
        ),
    };
}

export function buildIsystemServicesPageData(config: TemplateConfig, locale: Locale, visualLayout?: Json | null) {
    const showcase = extractBlock<ServicesShowcaseBlockProps>(visualLayout, "services", "ServicesShowcaseBlock");
    const methodology = extractBlock<MethodologyBlockProps>(visualLayout, "services", "MethodologyBlock");
    const engagementSteps = methodology?.steps ?? [];

    const offeringsFallback = pick3(locale,
        "Systems Fit Call|Free · 30 minutes. A qualification conversation with Hossam about the outcome, current setup, and mutual fit. No audit, report, or implementation work is promised.||Systems Blueprint|€490 · 90 minutes. A written system map, prioritized plan, and fixed proposal. Fully credited to implementation when contracted within 30 days. Paid through PayPal Checkout.||Foundation System|€3,900 setup + €249/month · delivered in 21 business days. A managed public website with up to seven pages, lead forms, manual content and blog, analytics, GDPR foundations, and supportable structured client records.||Growth Operating System|€7,500 setup + €699/month · delivered in 30 business days. Foundation plus the shipped content, SEO, booking, newsletter, opportunity, market-monitoring, podcast, and popup workflows. AI usage is metered separately in a visible ledger.",
        "Systems Fit Call|Gratis · 30 minuten. Een kwalificatiegesprek met Hossam over je doel, huidige situatie en de wederzijdse fit. Geen audit, rapport of implementatiewerk.||Systems Blueprint|€490 · 90 minuten. Een geschreven systeemkaart, prioriteitenplan en vaste offerte. Volledig verrekend bij een implementatiecontract binnen 30 dagen. Betaling via PayPal Checkout.||Foundation System|€3.900 setup + €249 per maand · levering binnen 21 werkdagen. Een beheerde openbare website met maximaal zeven pagina's, leadformulieren, handmatige content en blog, analytics, een GDPR-basis en — waar passend — gestructureerde klantgegevens.||Growth Operating System|€7.500 setup + €699 per maand · levering binnen 30 werkdagen. Foundation plus de bestaande workflows voor content, SEO, boekingen, nieuwsbrief, kansen, marktmonitoring, podcast en pop-ups. AI-gebruik wordt apart gemeten in een zichtbaar grootboek.",
        "مكالمة ملاءمة الأنظمة|مجانًا · 30 دقيقة. محادثة تأهيل مع حسام حول النتيجة المطلوبة والوضع الحالي ومدى الملاءمة المتبادلة، من دون وعد بتدقيق أو تقرير أو تنفيذ.||خارطة الأنظمة|€490 · 90 دقيقة. خريطة مكتوبة للنظام وخطة مرتبة حسب الأولوية وعرض بسعر ثابت. تُحتسب بالكامل ضمن التنفيذ عند التعاقد خلال 30 يومًا. الدفع عبر PayPal Checkout.||نظام التأسيس|إعداد بقيمة €3,900 + €249 شهريًا · التسليم خلال 21 يوم عمل. موقع عام مُدار بما يصل إلى سبع صفحات ونماذج للعملاء المحتملين ومحتوى ومدونة يدويين وتحليلات وأساس لإعدادات GDPR وسجلات عملاء منظمة حيثما كان ذلك مناسبًا.||نظام تشغيل النمو|إعداد بقيمة €7,500 + €699 شهريًا · التسليم خلال 30 يوم عمل. يشمل نظام التأسيس ويضيف سير العمل المتاح للمحتوى والسيو والحجوزات والنشرات والفرص ومراقبة السوق والبودكاست والنوافذ المنبثقة. يُقاس استخدام الذكاء الاصطناعي بصورة منفصلة في سجل ظاهر.",
    ).split("||").map((entry) => {
        const [title, description] = entry.split("|");
        return { title: title ?? "", description: description ?? "", features: [] as string[] };
    });

    const engagementFallback = pick3(locale,
        "Foundation implementation||A fixed managed foundation delivered in 21 business days. Setup is paid 50/30/20, followed by €249 monthly care.|||Growth implementation||The full operating system delivered in 30 business days. Setup is paid 50/30/20, followed by €699 monthly care; AI and third-party usage remain separate.|||Enterprise or embedded scope||Proposal-only specialist work under a scoped service agreement. Start with the Fit Call; use the Blueprint only when the complexity warrants it. There is no public enterprise tier or free enterprise audit.",
        "Foundation-implementatie||Een vaste, beheerde basis die binnen 21 werkdagen wordt geleverd. De setup wordt betaald in 50/30/20, gevolgd door €249 per maand voor doorlopende zorg.|||Growth-implementatie||Het volledige besturingssysteem wordt binnen 30 werkdagen geleverd. De setup wordt betaald in 50/30/20, gevolgd door €699 per maand; AI- en externe gebruikskosten blijven apart.|||Enterprise of embedded scope||Specialistisch werk op offertebasis onder een afgebakende serviceovereenkomst. Begin met de Fit Call; gebruik de Blueprint alleen als de complexiteit dat vraagt. Er is geen openbare enterprisebundel of gratis enterprise-audit.",
        "تنفيذ نظام التأسيس||أساس مُدار وثابت يُسلَّم خلال 21 يوم عمل. تُدفع كلفة الإعداد على دفعات 50/30/20، ثم €249 شهريًا للرعاية المستمرة.|||تنفيذ نظام النمو||يُسلَّم نظام التشغيل الكامل خلال 30 يوم عمل. تُدفع كلفة الإعداد على دفعات 50/30/20، ثم €699 شهريًا، بينما تبقى تكاليف الذكاء الاصطناعي والأطراف الثالثة منفصلة.|||نطاق المؤسسات أو الدعم المدمج||عمل متخصص بموجب عرض واتفاقية خدمات محددة النطاق. ابدأ بمكالمة الملاءمة، واستخدم خارطة الأنظمة فقط عندما تستدعي درجة التعقيد ذلك. لا توجد فئة مؤسسات عامة ولا تدقيق مؤسسات مجاني.",
    ).split("|||").map((entry, idx) => {
        const [title, description] = entry.split("||");
        const stepNumber = String(idx + 1).padStart(2, "0");
        return { id: `engagement-${idx + 1}`, stepNumber, title: { en: title ?? "", nl: title ?? "", ar: title ?? "" } as LocaleField, description: { en: description ?? "", nl: description ?? "", ar: description ?? "" } as LocaleField };
    });

    return {
        eyebrow: resolveField(locale, showcase?.title, pickLocaleText(config.pages.services?.title, locale, pick3(locale, "Services", "Diensten", "الخدمات"))),
        headline: resolveRichText(
            locale,
            showcase?.subtitle,
            pickLocaleText(config.pages.services?.subtitle, locale, pick3(locale, "Digital systems services", "Digitale systeemdiensten", "خدمات الأنظمة الرقمية")),
        ),
        description: resolveRichText(
            locale,
            showcase?.description,
            pickLocaleText(config.pages.services?.description, locale, ""),
        ),
        offerings: resolveServiceItems(locale, showcase?.items, offeringsFallback),
        methodologyTitle: resolveField(locale, methodology?.title, pick3(locale, "Engagement models", "Engagementmodellen", "نماذج التعاون")),
        methodologySubtitle: resolveRichText(locale, methodology?.subtitle, pick3(locale,
            "The service model follows the same logic as the thesis: diagnose the market and operating model first, then build the smallest governed system that can run in production.",
            "Het servicemodel volgt dezelfde logica als de scriptie: eerst markt en werkmodel diagnosticeren, daarna het kleinste governed systeem bouwen dat in productie kan draaien.",
            "يتبع نموذج الخدمة منطق الرسالة نفسه: تشخيص السوق ونموذج التشغيل أولًا، ثم بناء أصغر نظام محوكم يمكن تشغيله في الإنتاج.",
        )),
        engagementModels: (engagementSteps.length > 0 ? engagementSteps : engagementFallback)
            .map((step) => ({
                tier: step.stepNumber || "",
                title: resolveField(locale, step.title, ""),
                description: resolveRichText(locale, step.description, ""),
            }))
            .filter((step) => step.title.length > 0 || step.description.length > 0),
    };
}

export function buildIsystemContactPageData(config: TemplateConfig, locale: Locale, visualLayout?: Json | null) {
    const contact = extractBlock<ContactBlockProps>(visualLayout, "contact", "ContactBlock");

    const trustItemsFallback = pick3(locale,
        "Step 1 — free 30-minute Systems Fit Call to qualify the need and mutual fit|Step 2 — €490 Systems Blueprint only when deeper diagnosis is warranted|Step 3 — written fixed scope for Foundation, Growth, or proposal-only embedded work|Step 4 — implementation with one accountable founder and agreed care cadence",
        "Stap 1 — gratis Systems Fit Call van 30 minuten om de vraag en wederzijdse fit te beoordelen|Stap 2 — Systems Blueprint van €490, alleen als diepere analyse nodig is|Stap 3 — geschreven vaste scope voor Foundation, Growth of embedded werk op offertebasis|Stap 4 — implementatie met één verantwoordelijke oprichter en een afgesproken zorgritme",
        "الخطوة 1 — مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة لتأهيل الحاجة ومدى الملاءمة المتبادلة|الخطوة 2 — خارطة الأنظمة بقيمة €490 فقط عندما يلزم تشخيص أعمق|الخطوة 3 — نطاق مكتوب وثابت لنظام التأسيس أو النمو أو للعمل المدمج بموجب عرض|الخطوة 4 — تنفيذ بقيادة مؤسس واحد مسؤول ودورة رعاية متفق عليها",
    ).split("|");

    const requestTypeOptions = pick3(locale,
        "I need a managed website and digital foundation|I need the full growth operating system|I'm evaluating embedded specialist support for my team|Other — I'm not sure yet",
        "Ik heb een beheerde website en digitale basis nodig|Ik heb het volledige groeisysteem nodig|Ik onderzoek embedded specialist support voor mijn team|Anders — ik weet het nog niet zeker",
        "أحتاج إلى موقع مُدار وأساس رقمي|أحتاج إلى نظام تشغيل النمو الكامل|أُقيّم دعمًا متخصصًا مدمجًا لفريقي|خيار آخر — لست متأكدًا بعد",
    ).split("|");

    interface FaqItem { question: string; answer: string; }
    const faqFallback: FaqItem[] = pick3(locale,
        "Where do I start?||Book the free 30-minute Systems Fit Call. It qualifies the need and fit; it does not include a free audit or report. Deeper diagnosis is a €490, 90-minute Systems Blueprint, credited in full when implementation is contracted within 30 days.|||What does Foundation cost?||€3,900 setup plus €249 per month, delivered in 21 business days. Foundation stays within the managed website, up to seven public pages, lead forms, manual content, analytics, GDPR foundation, and supportable structured client-record scope.|||What does Growth cost?||€7,500 setup plus €699 per month, delivered in 30 business days. It adds the shipped content, SEO, booking, newsletter, opportunity, market-monitoring, podcast, and popup capabilities. AI usage is separately metered and visible in the ledger.|||What do prices exclude?||All published prices exclude 21% VAT and third-party, media, and AI usage. Setup is paid 50/30/20. Both systems have a six-month initial care term, then continue monthly with 30 days' notice. Extra approved work is €125 per hour.|||Do you offer an enterprise tier?||No. Enterprise and embedded work is proposal-only under a scoped service agreement. Start with the Fit Call; use the Blueprint if complexity warrants it. There is no public enterprise tier or free enterprise audit.|||Do you work in Dutch and Arabic?||Yes. English is the working language, Dutch public copy receives a native review, and Arabic is formal MSA with RTL-safe rendering.",
        "Waar begin ik?||Plan de gratis Systems Fit Call van 30 minuten. Daarmee beoordelen we de vraag en de fit; de call bevat geen gratis audit of rapport. Voor diepere analyse is er de Systems Blueprint van €490 en 90 minuten. Die wordt volledig verrekend bij een implementatiecontract binnen 30 dagen.|||Wat kost Foundation?||€3.900 setup plus €249 per maand, geleverd binnen 21 werkdagen. Foundation blijft binnen de scope van een beheerde website, maximaal zeven openbare pagina's, leadformulieren, handmatige content, analytics, een GDPR-basis en — waar passend — gestructureerde klantgegevens.|||Wat kost Growth?||€7.500 setup plus €699 per maand, geleverd binnen 30 werkdagen. Growth voegt de bestaande mogelijkheden voor content, SEO, boekingen, nieuwsbrief, kansen, marktmonitoring, podcast en pop-ups toe. AI-gebruik wordt apart gemeten en staat zichtbaar in het grootboek.|||Wat is niet bij de prijs inbegrepen?||Alle gepubliceerde prijzen zijn exclusief 21% btw en kosten voor derden, media en AI-gebruik. De setup wordt betaald in 50/30/20. Beide systemen hebben eerst een zorgtermijn van zes maanden en lopen daarna maandelijks door met een opzegtermijn van 30 dagen. Goedgekeurd extra werk kost €125 per uur.|||Is er een enterprisebundel?||Nee. Enterprise- en embedded werk wordt alleen op offertebasis geleverd onder een afgebakende serviceovereenkomst. Begin met de Fit Call; gebruik de Blueprint als de complexiteit dat vraagt. Er is geen openbare enterprisebundel of gratis enterprise-audit.|||Werken jullie in het Nederlands en Arabisch?||Ja. Engels is de werktaal, openbare Nederlandse teksten krijgen een native review en Arabisch wordt in formeel MSA geschreven met RTL-veilige weergave.",
        "من أين أبدأ؟||احجز مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة. هدفها تأهيل الحاجة ومدى الملاءمة، ولا تشمل تدقيقًا أو تقريرًا مجانيًا. أما التشخيص الأعمق فيتم عبر خارطة الأنظمة لمدة 90 دقيقة بقيمة €490، وتُحتسب قيمتها كاملة عند توقيع عقد التنفيذ خلال 30 يومًا.|||ما كلفة نظام التأسيس؟||€3,900 للإعداد و€249 شهريًا، مع التسليم خلال 21 يوم عمل. يظل النطاق ضمن موقع مُدار وما يصل إلى سبع صفحات عامة ونماذج للعملاء المحتملين ومحتوى يدوي وتحليلات وأساس لإعدادات GDPR وسجلات عملاء منظمة حيثما كان ذلك مناسبًا.|||ما كلفة نظام النمو؟||€7,500 للإعداد و€699 شهريًا، مع التسليم خلال 30 يوم عمل. يضيف الإمكانات المتاحة للمحتوى والسيو والحجوزات والنشرات والفرص ومراقبة السوق والبودكاست والنوافذ المنبثقة. يُقاس استخدام الذكاء الاصطناعي بصورة منفصلة ويظهر في السجل.|||ما الذي لا تشمله الأسعار؟||جميع الأسعار المنشورة لا تشمل ضريبة القيمة المضافة بنسبة 21% ولا تكاليف الأطراف الثالثة أو الوسائط أو استخدام الذكاء الاصطناعي. تُدفع كلفة الإعداد على دفعات 50/30/20. تبدأ الرعاية بستة أشهر، ثم تستمر شهريًا مع إشعار مدته 30 يومًا. كلفة العمل الإضافي المعتمد €125 للساعة.|||هل توجد فئة للمؤسسات؟||لا. تُقدَّم أعمال المؤسسات والدعم المدمج بموجب عرض واتفاقية خدمات محددة النطاق. ابدأ بمكالمة الملاءمة، واستخدم خارطة الأنظمة إذا استدعت درجة التعقيد ذلك. لا توجد فئة مؤسسات عامة ولا تدقيق مؤسسات مجاني.|||هل تعملون بالهولندية والعربية؟||نعم. الإنجليزية هي لغة العمل، وتخضع النصوص الهولندية العامة لمراجعة ناطق أصلي، وتُكتب العربية بالفصحى الحديثة مع عرض آمن من اليمين إلى اليسار.",
    ).split("|||").map((entry) => {
        const [question, answer] = entry.split("||");
        return { question: question?.trim() ?? "", answer: answer?.trim() ?? "" };
    }).filter((item) => item.question.length > 0);

    return {
        eyebrow: resolveField(locale, contact?.eyebrow, pickLocaleText(config.pages.contact.title, locale)),
        headline: resolveField(locale, contact?.title, pickLocaleText(config.pages.contact.subtitle, locale)),
        description: resolveRichText(
            locale,
            contact?.description,
            pick3(locale,
                "Share your operational challenge, desired outcome, and current digital setup. We’ll recommend the right starting point: Fit Call, Blueprint, Foundation, Growth, or a proposal-only embedded scope.",
                "Deel je operationele uitdaging, gewenste uitkomst en huidige digitale situatie. We adviseren het juiste startpunt: Fit Call, Blueprint, Foundation, Growth of embedded werk op offertebasis.",
                "شاركنا التحدي التشغيلي والنتيجة المطلوبة ووضعك الرقمي الحالي. سنوصي بنقطة البداية المناسبة: مكالمة الملاءمة أو خارطة الأنظمة أو نظام التأسيس أو النمو أو نطاق دعم مدمج بموجب عرض.",
            ),
        ),
        formTitle: resolveField(locale, contact?.formTitle, pick3(locale, "Project intake", "Project intake", "استمارة المشروع")),
        formSubtitle: resolveRichText(locale, contact?.formSubtitle, ""),
        submitLabel: resolveField(locale, contact?.submitLabel, pick3(locale, "Send intake", "Verstuur intake", "إرسال الاستمارة")),
        trustTitle: resolveField(locale, contact?.trustTitle, pick3(locale, "Next steps", "Volgende stappen", "الخطوات التالية")),
        trustItems: resolveListItems(locale, contact?.trustItems, trustItemsFallback),
        faqTitle: resolveField(locale, contact?.faqTitle, pick3(locale, "Frequently asked questions", "Veelgestelde vragen", "الأسئلة الشائعة")),
        faqItems: (() => {
            const cmsItems = (Array.isArray(contact?.faqItems) ? contact.faqItems : [])
                .filter((item) => item && typeof item === "object")
                .map((item) => ({
                    question: resolveField(locale, item.question, ""),
                    answer: resolveRichText(locale, item.answer, ""),
                }))
                .filter((item) => item.question.length > 0 || item.answer.length > 0);
            return cmsItems.length > 0 ? cmsItems : faqFallback;
        })(),
        requestTypeOptions,
        requestTypePlaceholder: pick3(locale, "Select type", "Selecteer type", "اختر النوع"),
        timelineLabel: pick3(locale, "Target timeline", "Gewenste timing", "الجدول الزمني المستهدف"),
        timelinePlaceholder: pick3(locale, "E.g. Q3 2026", "Bijv. Q3 2026", "مثال: الربع الثالث 2026"),
        challengeLabel: pick3(locale, "Challenge & context", "Uitdaging & context", "التحدي والسياق"),
        challengePlaceholder: pick3(locale,
            "Describe your challenge, current tools, team structure, and desired outcome",
            "Beschrijf uw uitdaging, huidige tools, teamstructuur en gewenste resultaat",
            "صف التحدي والأدوات الحالية وهيكل الفريق والنتيجة المرجوّة",
        ),
    };
}
