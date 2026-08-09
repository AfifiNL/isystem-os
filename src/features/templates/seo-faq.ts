/**
 * Curated FAQ content per public surface, used by both the FAQPage JSON-LD
 * and (optionally) visible page content. Voice and content calibrated against
 * the reviewed public brand brief — sober EU register, specifics over
 * adjectives, names Hossam, no banned phrases.
 *
 * Google's FAQPage rich-result guidelines require the visible page to match
 * the schema. The schema alone still helps AI citation (ChatGPT, Perplexity,
 * Google AI Overviews) — but for full rich-result eligibility, surface these
 * questions in the page body too (a follow-up task for the home/about
 * surfaces, where the marketing audit also wants this).
 */
export type SeoPage = "home" | "about" | "services" | "contact";
export type FaqLocale = "en" | "nl" | "ar";

export interface FaqEntry {
    q: string;
    a: string;
}

type FaqMatrix = Record<SeoPage, Record<FaqLocale, FaqEntry[]>>;

export const ISYSTEM_PUBLIC_FAQ: FaqMatrix = {
    home: {
        en: [
            {
                q: "What is iSystem.ai exactly?",
                a: "iSystem.ai is a founder-led digital operating system for SMEs. The managed workspace connects publishing, search, bookings, newsletters, client work, and practical utilities. AI-assisted actions use bounded budgets, named reviewers, and reversible changes.",
            },
            {
                q: "Is iSystem.ai an agency, a SaaS, or an AI tool?",
                a: "None of the three exactly. It is a founder-led implementation and operating partnership, delivered through a managed workspace. Hossam Afifi scopes the system, implements it, and remains accountable after launch. The workspace is closer to your business computer in the browser than to another SaaS dashboard.",
            },
            {
                q: "Who is this built for?",
                a: "SME operators — typically 5–50 people, founder-led, tool-fatigued, cautious about AI hype. Strongest fit in horeca, real-estate, education, professional-services, and legal. We are not the right choice for funded startups with 30-person growth teams, marketplace operators, buyers who want an unmetered AI sandbox, or anyone wanting a multi-vendor agency relationship.",
            },
            {
                q: "What does \"governed AI\" mean in practice?",
                a: "AI-assisted work is budgeted, logged, and presented for review before a public or operational change is accepted. The reviewer can see what changed, why it changed, and how to reverse it. Access controls and abuse protections remain part of the managed system.",
            },
            {
                q: "What languages does iSystem.ai support?",
                a: "English, Dutch, and Arabic — with sticky locale and full RTL handling for Arabic. The platform infrastructure is real; stakeholder-facing Dutch copy gets a native-speaker review pass before shipping. Hossam is C2 English, B1 Dutch (improving), native Arabic.",
            },
            {
                q: "How do I get started?",
                a: "Book the free 30-minute Systems Fit Call with Hossam, in English or Dutch. It is a qualification conversation: we clarify the outcome, your current setup, and whether iSystem is a sensible fit. It does not include a free audit or written report. iSystem.ai is registered in the Netherlands with KvK 42053547.",
            },
        ],
        nl: [
            {
                q: "Wat is iSystem.ai precies?",
                a: "iSystem.ai is een digitaal besturingssysteem voor het mkb, onder leiding van de oprichter. De beheerde werkomgeving verbindt publicatie, zoekwerk, boekingen, nieuwsbrieven, klantwerk en praktische hulpmiddelen. AI-ondersteund werk heeft begrensde budgetten, benoemde reviewers en omkeerbare wijzigingen.",
            },
            {
                q: "Is iSystem.ai een agency, een SaaS of een AI-tool?",
                a: "Geen van drieën. Het is een implementatie- en operationeel partnerschap onder leiding van de oprichter, geleverd via een beheerde werkomgeving. Hossam Afifi bepaalt de scope, implementeert het systeem en blijft na livegang verantwoordelijk. De werkomgeving lijkt meer op je bedrijfscomputer in de browser dan op een SaaS-dashboard.",
            },
            {
                q: "Voor wie is dit gebouwd?",
                a: "MKB-ondernemers — meestal 5–50 mensen, founder-led, tool-moe, sceptisch over AI-hype. Sterkste fit in horeca, vastgoed, onderwijs, zakelijke dienstverlening en legal. Niet voor gefinancierde startups met een groeiteam van 30, niet voor marktplaats-operators, niet voor wie een onbeperkte AI-sandbox wil.",
            },
            {
                q: "Wat betekent \"governed AI\" in de praktijk?",
                a: "AI-ondersteund werk wordt gebudgetteerd, vastgelegd en ter beoordeling aangeboden voordat een publieke of operationele wijziging wordt geaccepteerd. De reviewer ziet wat veranderde, waarom en hoe de wijziging kan worden teruggedraaid. Toegangscontrole en misbruikbescherming blijven onderdeel van het beheerde systeem.",
            },
            {
                q: "Welke talen ondersteunt iSystem.ai?",
                a: "Engels, Nederlands en Arabisch — met sticky locale en volledige RTL voor het Arabisch. De platform-infrastructuur is echt; stakeholder-gerichte Nederlandse copy krijgt een native-speaker review voor publicatie.",
            },
            {
                q: "Hoe begin ik?",
                a: "Plan de gratis Systems Fit Call van 30 minuten met Hossam, in het Nederlands of Engels. Dit is een kwalificatiegesprek: we bespreken je doel, je huidige situatie en of iSystem logisch past. De call bevat geen gratis audit of geschreven rapport. iSystem.ai is gevestigd in Nederland, KvK 42053547.",
            },
        ],
        ar: [
            {
                q: "ما هو iSystem.ai بالضبط؟",
                a: "iSystem.ai نظام تشغيل رقمي للشركات الصغيرة والمتوسطة يقوده المؤسس. تربط مساحة العمل المُدارة النشر والبحث والحجوزات والنشرات وعمل العملاء والأدوات العملية. ويعمل الذكاء الاصطناعي ضمن ميزانيات محددة ومراجعين معروفين وتغييرات قابلة للعكس.",
            },
            {
                q: "هل iSystem.ai وكالة أم SaaS أم أداة ذكاء اصطناعي؟",
                a: "ليس أيًّا منها بدقة. إنها شراكة للتنفيذ والتشغيل يقودها المؤسس وتُقدَّم عبر مساحة عمل مُدارة. يحدد حسام عفيفي النطاق وينفذ النظام ويظل مسؤولًا عنه بعد الإطلاق. وتشبه مساحة العمل حاسوب أعمالك داخل المتصفح أكثر مما تشبه لوحة SaaS أخرى.",
            },
            {
                q: "لمن صُمّم؟",
                a: "مشغّلو الشركات الصغيرة والمتوسطة — عادةً من 5 إلى 50 شخصًا، بقيادة مؤسّس، أنهكتهم الأدوات، حذرون تجاه ضجيج الذكاء الاصطناعي. أفضل ملاءمة في الضيافة والعقارات والتعليم والخدمات المهنية والقانون.",
            },
            {
                q: "ماذا تعني \"الحوكمة\" عمليًّا؟",
                a: "يُخصَّص للعمل المدعوم بالذكاء الاصطناعي نطاق وميزانية، ويُسجَّل ثم يُعرض للمراجعة قبل قبول أي تغيير عام أو تشغيلي. يرى المراجع ما تغيّر وسببه وطريقة التراجع عنه، مع بقاء ضوابط الوصول والحماية من إساءة الاستخدام ضمن النظام المُدار.",
            },
            {
                q: "ما اللغات المدعومة؟",
                a: "الإنجليزية والهولندية والعربية — مع لزوم اللغة الاختياري ودعم كامل للاتجاه من اليمين لليسار في العربية.",
            },
            {
                q: "كيف أبدأ؟",
                a: "احجز مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة مع حسام، بالإنجليزية أو الهولندية. هذه محادثة تأهيل لتوضيح النتيجة المطلوبة ووضعك الحالي ومدى ملاءمة iSystem، ولا تشمل تدقيقًا أو تقريرًا مكتوبًا مجانيًا. iSystem.ai مسجّلة في هولندا، KvK 42053547.",
            },
        ],
    },
    about: {
        en: [
            {
                q: "Who runs iSystem.ai?",
                a: "Hossam Afifi — founder and operator. MSc Consultancy & Entrepreneurship from Rotterdam Business School, with a master's thesis titled \"Strategic Frameworks for AI Adoption in Small and Medium-sized Educational Enterprises (SMEs): A Dutch Market Analysis.\" Earlier chapters: educational programs in Egypt reaching 150,000+ students; recruitment work at Ilia State University in Georgia (300+ international students placed); founder of Nomad Entrepreneur. Published author. KvK-registered in the Netherlands.",
            },
            {
                q: "Why is iSystem founder-led instead of agency-style?",
                a: "Because the kind of buyer iSystem fits — SME operators who built their business themselves — values a senior contact, not a junior account manager. Founder-led means Hossam runs your Systems Fit Call, scopes the engagement, and stays the accountable person throughout. No handoff to a delivery team you did not meet.",
            },
            {
                q: "What languages does Hossam work in?",
                a: "English C2 (working language), Arabic native, Dutch B1 and improving. Stakeholder-facing Dutch copy is reviewed by a native speaker before it ships. We are explicit about this rather than overclaiming.",
            },
            {
                q: "Where is iSystem.ai based?",
                a: "Registered in the Netherlands with KvK 42053547. Operations are remote; in-person meetings are arranged in Breda, Rotterdam, or Amsterdam at the client's preferred venue; client visits elsewhere in Europe are discussed case by case. We do not maintain a walk-in office.",
            },
        ],
        nl: [
            {
                q: "Wie staat er achter iSystem.ai?",
                a: "Hossam Afifi — founder en operator. MSc Consultancy & Entrepreneurship aan Rotterdam Business School, met een masterscriptie getiteld \"Strategic Frameworks for AI Adoption in Small and Medium-sized Educational Enterprises (SMEs): A Dutch Market Analysis.\" Eerdere hoofdstukken: onderwijsprogramma's in Egypte met 150.000+ studenten; recruitment bij Ilia State University in Georgië (300+ internationale studenten); founder van Nomad Entrepreneur. Auteur. KvK-geregistreerd in Nederland.",
            },
            {
                q: "Waarom founder-led en niet agency-stijl?",
                a: "Omdat het type koper waar iSystem bij past — MKB-ondernemers die hun bedrijf zelf opbouwden — waarde hecht aan een senior contact, niet een junior accountmanager. Founder-led betekent dat Hossam je discovery-call zelf doet, je scope vaststelt en de aanspreekbare persoon blijft.",
            },
            {
                q: "Welke talen spreekt Hossam?",
                a: "Engels C2 (werktaal), Arabisch native, Nederlands B1 en aan het verbeteren. Stakeholder-gerichte Nederlandse copy wordt door een native speaker gereviewd voor het wordt gepubliceerd. We zijn hier expliciet over.",
            },
            {
                q: "Waar is iSystem.ai gevestigd?",
                a: "Geregistreerd in Nederland, KvK 42053547. Werk is remote; afspraken in persoon worden geregeld in Breda, Rotterdam of Amsterdam op de locatie van de klant; klantbezoeken elders in Europa zijn bespreekbaar. We hebben geen inlooppand.",
            },
        ],
        ar: [
            {
                q: "من يدير iSystem.ai؟",
                a: "حسام عفيفي — المؤسّس والمشغّل. ماجستير في الاستشارات وريادة الأعمال من Rotterdam Business School، برسالة بعنوان \"أُطر استراتيجية لتبنّي الذكاء الاصطناعي في الشركات التعليمية الصغيرة والمتوسطة: تحليل السوق الهولندية\". فصول سابقة: برامج تعليمية في مصر طالت 150,000+ طالب؛ توظيف في جامعة إيليا في جورجيا (300+ طالبًا دوليًّا)؛ مؤسّس Nomad Entrepreneur. مؤلِّف. مسجّل في هولندا.",
            },
            {
                q: "لماذا بقيادة مؤسِّس وليس نموذج وكالة؟",
                a: "لأنّ نوع المشتري الذي يناسبه iSystem — مشغّل شركة صغيرة بنى عمله بنفسه — يقدّر التواصل مع شخص سيني، لا مع مدير حسابات مبتدئ. القيادة بالمؤسِّس تعني أنّ حسامًا يدير مكالمتك الاستكشافية ويحدّد النطاق ويبقى المسؤول.",
            },
            {
                q: "ما لغات حسام؟",
                a: "الإنجليزية C2 (لغة العمل)، العربية لغة أم، الهولندية B1 وفي تحسّن. تُراجَع النصوص الهولندية الموجّهة للجهات الفاعلة من قِبَل ناطق أصلي قبل النشر. نُصرّح بذلك بدلاً من ادّعاء أكثر ممّا هو حقيقي.",
            },
            {
                q: "أين تقع iSystem.ai؟",
                a: "مسجّلة في هولندا، KvK 42053547. العمل عن بُعد؛ تُرتَّب اللقاءات في بريدا أو روتردام أو أمستردام في موقع العميل المفضّل؛ زيارات العملاء في بقية أوروبا قابلة للنقاش. لا يوجد مكتب مفتوح للزوار.",
            },
        ],
    },
    services: {
        en: [
            {
                q: "What services does iSystem.ai offer?",
                a: "Two managed systems. Foundation System is €3,900 setup plus €249 per month for a managed website, up to seven public pages, lead forms, manual content, analytics, GDPR foundations, and supportable structured client records. Growth Operating System is €7,500 setup plus €699 per month and adds the shipped booking, newsletter, content, SEO, opportunity, market-monitoring, podcast, and popup workflows. Both exclude 21% VAT, third-party, media, and AI usage.",
            },
            {
                q: "How does an engagement start?",
                a: "Start with the free 30-minute Systems Fit Call. It qualifies the need and fit; it is not a free audit or report. When deeper diagnosis is needed, the next step is a €490, 90-minute Systems Blueprint with a written system map, prioritized plan, and fixed proposal. The €490 is credited to implementation when contracted within 30 days.",
            },
            {
                q: "Do you accept retainer clients?",
                a: "Ongoing care is part of both systems: an initial six-month care term, followed by monthly continuation with 30 days' notice. Approved work outside the agreed scope is €125 per hour. Enterprise or embedded work is proposal-only under a scoped service agreement, not a public subscription tier.",
            },
            {
                q: "Where do you deliver work from?",
                a: "Remotely, from the Netherlands. Where helpful for kickoff or steering committees we meet in person in Breda, Rotterdam, or Amsterdam. Client visits elsewhere in Europe are discussed case by case. No walk-in office.",
            },
        ],
        nl: [
            {
                q: "Welke diensten biedt iSystem.ai?",
                a: "Twee beheerde systemen. Foundation System kost €3.900 voor de setup en €249 per maand voor een beheerde website, maximaal zeven openbare pagina's, leadformulieren, handmatige content, analytics, een GDPR-basis en — waar passend — gestructureerde klantgegevens. Growth Operating System kost €7.500 voor de setup en €699 per maand en voegt de bestaande workflows voor boekingen, nieuwsbrief, content, SEO, kansen, marktmonitoring, podcast en pop-ups toe. Beide prijzen zijn exclusief 21% btw, diensten van derden, media en AI-gebruik.",
            },
            {
                q: "Hoe begint een traject?",
                a: "Begin met de gratis Systems Fit Call van 30 minuten. Daarmee beoordelen we de vraag en de wederzijdse fit; het is geen gratis audit of rapport. Is diepere analyse nodig, dan volgt de Systems Blueprint: 90 minuten, €490, met een geschreven systeemkaart, prioriteitenplan en vaste offerte. De €490 wordt volledig verrekend wanneer je binnen 30 dagen een implementatiecontract sluit.",
            },
            {
                q: "Werken jullie met retainers?",
                a: "Doorlopende zorg hoort bij beide systemen: eerst zes maanden, daarna per maand opzegbaar met een opzegtermijn van 30 dagen. Goedgekeurd werk buiten de afgesproken scope kost €125 per uur. Enterprise- en embedded werk wordt alleen op offertebasis geleverd onder een afgebakende serviceovereenkomst, niet als openbaar abonnement.",
            },
            {
                q: "Vanwaar werken jullie?",
                a: "Remote, vanuit Nederland. Wanneer nuttig voor kick-off of stuurgroep ontmoeten we elkaar in persoon in Breda, Rotterdam of Amsterdam. Klantbezoeken elders in Europa zijn bespreekbaar. Geen inlooppand.",
            },
        ],
        ar: [
            {
                q: "ما الخدمات التي تقدّمها iSystem.ai؟",
                a: "نقدّم نظامين مُدارين. تبلغ كلفة إعداد نظام التأسيس €3,900، إضافة إلى €249 شهريًا، وتشمل موقعًا مُدارًا وما يصل إلى سبع صفحات عامة ونماذج للعملاء المحتملين ومحتوى يدويًا وتحليلات وأساسًا لإعدادات GDPR وسجلات عملاء منظمة حيثما كان ذلك مناسبًا. وتبلغ كلفة إعداد نظام تشغيل النمو €7,500، إضافة إلى €699 شهريًا، ويضيف سير العمل المتاح للحجوزات والنشرات والمحتوى والسيو والفرص ومراقبة السوق والبودكاست والنوافذ المنبثقة. الأسعار لا تشمل ضريبة القيمة المضافة بنسبة 21% ولا خدمات الأطراف الثالثة أو الوسائط أو استخدام الذكاء الاصطناعي.",
            },
            {
                q: "كيف يبدأ التعاون؟",
                a: "ابدأ بمكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة. هدفها تأهيل الحاجة ومدى الملاءمة، وليست تدقيقًا أو تقريرًا مجانيًا. وعند الحاجة إلى تشخيص أعمق، تأتي خارطة الأنظمة: جلسة مدتها 90 دقيقة بقيمة €490 تشمل خريطة مكتوبة للنظام وخطة مرتبة حسب الأولوية وعرضًا بسعر ثابت. تُحتسب قيمة €490 كاملة ضمن التنفيذ عند التعاقد خلال 30 يومًا.",
            },
            {
                q: "هل تقبلون عملاء بعقود متكرّرة؟",
                a: "تشمل المنظومتان رعاية مستمرة لمدة أولية قدرها ستة أشهر، ثم تستمر شهريًا مع إشعار مدته 30 يومًا. تبلغ كلفة العمل الإضافي المعتمد خارج النطاق €125 للساعة. أما أعمال المؤسسات أو الدعم المدمج فتُقدَّم بموجب عرض واتفاقية خدمات محددة النطاق، وليس كفئة اشتراك عامة.",
            },
            {
                q: "من أين تنفّذون العمل؟",
                a: "عن بُعد، من هولندا. عند الحاجة لانطلاق المشروع أو لجان التوجيه نلتقي شخصيًّا في بريدا أو روتردام أو أمستردام. زيارات العملاء في باقي أوروبا قابلة للنقاش. لا يوجد مكتب مفتوح للزوار.",
            },
        ],
    },
    contact: {
        en: [
            {
                q: "What's the fastest way to reach Hossam?",
                a: "Book the free 30-minute Systems Fit Call via the booking page. For email, write to hossam@isystem.ai. Replies are typically within one Dutch business day; we don't run an after-hours queue.",
            },
            {
                q: "Do you accept walk-in visitors?",
                a: "No. iSystem.ai operates remotely; we don't maintain a public office. In-person meetings are arranged at the client's preferred location in Breda, Rotterdam, or Amsterdam, or elsewhere in Europe by arrangement.",
            },
            {
                q: "What languages can I write in?",
                a: "English, Dutch, or Arabic. Dutch replies pass a native review when stakeholder-facing.",
            },
            {
                q: "What is the KvK number?",
                a: "42053547, registered in the Netherlands. iSystem.ai is the legal trade name.",
            },
        ],
        nl: [
            {
                q: "Hoe bereik ik Hossam het snelst?",
                a: "Plan de gratis Systems Fit Call van 30 minuten via de boekingspagina. Voor e-mail: hossam@isystem.ai. Antwoorden meestal binnen één Nederlandse werkdag; geen 24/7-wachtrij.",
            },
            {
                q: "Accepteren jullie inloopbezoek?",
                a: "Nee. iSystem.ai werkt remote; geen openbaar kantoor. Afspraken in persoon worden geregeld op de voorkeurslocatie van de klant in Breda, Rotterdam of Amsterdam, of elders in Europa op afspraak.",
            },
            {
                q: "In welke talen kan ik schrijven?",
                a: "Nederlands, Engels of Arabisch. Nederlandse antwoorden krijgen een native review wanneer ze stakeholder-gericht zijn.",
            },
            {
                q: "Wat is het KvK-nummer?",
                a: "42053547, geregistreerd in Nederland. iSystem.ai is de handelsnaam.",
            },
        ],
        ar: [
            {
                q: "ما أسرع وسيلة للتواصل مع حسام؟",
                a: "احجز مكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة عبر صفحة الحجز. وللبريد الإلكتروني: hossam@isystem.ai. تصل الردود عادةً خلال يوم عمل هولندي واحد، ولا توجد خدمة خارج ساعات العمل.",
            },
            {
                q: "هل تقبلون زيارات بدون موعد؟",
                a: "لا. iSystem.ai تعمل عن بُعد ولا تملك مكتبًا مفتوحًا للعموم. تُرتَّب الاجتماعات الشخصية في الموقع المفضّل للعميل في بريدا أو روتردام أو أمستردام، أو في باقي أوروبا بموعد مسبق.",
            },
            {
                q: "بأيّ لغة يمكنني الكتابة؟",
                a: "الإنجليزية أو الهولندية أو العربية. تخضع الردود الهولندية لمراجعة ناطق أصلي حين تكون موجّهة لأصحاب القرار.",
            },
            {
                q: "ما رقم KvK؟",
                a: "42053547، مسجّلة في هولندا. iSystem.ai هو الاسم التجاري.",
            },
        ],
    },
};

export function buildFaqJsonLdFromEntries(entries: FaqEntry[]) {
    if (!entries.length) return null;
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entries.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
            },
        })),
    };
}

export function buildPublicFaqJsonLd(page: SeoPage, locale: FaqLocale) {
    const entries = ISYSTEM_PUBLIC_FAQ[page][locale];
    return buildFaqJsonLdFromEntries(entries);
}

/**
 * Extract FAQ Q&A pairs from a persisted Puck visual_layout. When a workspace
 * manager edits the FaqAccordionBlock in the page builder, those edits become
 * the new source of truth for both the visible content AND the JSON-LD.
 *
 * Falls back to the seo-faq.ts curated set when the layout has no
 * FaqAccordionBlock — fresh installs or templates that aren't seeded yet.
 */
type PuckBlockShape = {
    type?: string;
    props?: Record<string, unknown> | null;
} & Record<string, unknown>;

interface VisualLayoutLike {
    content?: PuckBlockShape[] | null;
}

function stripRichHtml(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pickFaqLocaleString(field: unknown, locale: FaqLocale): string {
    if (!field || typeof field !== "object") {
        return typeof field === "string" ? field : "";
    }
    const f = field as Record<string, unknown>;
    const richKey = locale === "en" ? "richEn" : locale === "nl" ? "richNl" : "richAr";
    const richValue = stripRichHtml(f[richKey]);
    if (richValue) return richValue;
    const plain = f[locale];
    if (typeof plain === "string" && plain.trim()) return plain.trim();
    for (const fallback of ["en", "nl", "ar"] as const) {
        const v = f[fallback];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

export function extractFaqEntriesFromLayout(
    visualLayout: unknown,
    locale: FaqLocale,
): FaqEntry[] | null {
    if (!visualLayout || typeof visualLayout !== "object") return null;
    const layout = visualLayout as VisualLayoutLike;
    if (!Array.isArray(layout.content)) return null;

    for (const block of layout.content) {
        if (!block || block.type !== "FaqAccordionBlock") continue;
        const props = block.props as Record<string, unknown> | undefined;
        const rawItems = props?.items;
        if (!Array.isArray(rawItems) || rawItems.length === 0) continue;

        const entries: FaqEntry[] = [];
        for (const raw of rawItems) {
            if (!raw || typeof raw !== "object") continue;
            const item = raw as Record<string, unknown>;
            const q = pickFaqLocaleString(item.question, locale);
            const a = pickFaqLocaleString(item.answer, locale);
            if (q && a) entries.push({ q, a });
        }
        if (entries.length > 0) return entries;
    }
    return null;
}
