import { ISYSTEM_PUBLIC_OFFER_NOTES } from "@/features/marketing/isystem-commercial-offer";

export type IsystemLocalizedCopy = {
    en: string;
    nl: string;
    ar: string;
};

const copy = (en: string, nl: string, ar: string): IsystemLocalizedCopy => ({ en, nl, ar });

export const ISYSTEM_PUBLIC_GENERIC_BLOCK_COPY = {
    eyebrow: copy("Public system", "Publiek systeem", "النظام العام"),
    title: copy("A clear public decision.", "Een duidelijke publieke beslissing.", "قرار عام واضح."),
    description: copy(
        "Evidence, boundaries, and the next step in one place.",
        "Bewijs, grenzen en de volgende stap op één plek.",
        "الدليل والحدود والخطوة التالية في مكان واحد.",
    ),
} as const;

export const ISYSTEM_PUBLIC_BLOCK_DEFAULTS: Record<string, Record<string, unknown>> = {
    OutcomeHero: {
        eyebrow: copy(
            "Founder-led digital systems for Dutch service SMEs",
            "Founder-led digitale systemen voor Nederlandse dienstverleners",
            "أنظمة رقمية يقودها المؤسس للشركات الخدمية الهولندية",
        ),
        headline: copy(
            "Turn a scattered digital operation into one accountable system.",
            "Maak van een versnipperde digitale operatie één verantwoord systeem.",
            "حوّل العمليات الرقمية المتفرقة إلى نظام واحد واضح المسؤولية.",
        ),
        subtitle: copy(
            "iSystem designs, implements, and operates the digital systems around your service business, with Hossam accountable for the result.",
            "iSystem ontwerpt, implementeert en beheert de digitale systemen rond je dienstverlenende bedrijf, met Hossam als verantwoordelijke voor het resultaat.",
            "يصمم iSystem الأنظمة الرقمية المحيطة بعملك الخدمي وينفذها ويديرها، مع تحمّل حسام مسؤولية النتيجة.",
        ),
        primaryCtaLabel: copy(
            "Book the free Systems Fit Call",
            "Plan de gratis Systems Fit Call",
            "احجز مكالمة ملاءمة الأنظمة المجانية",
        ),
        secondaryCtaLabel: copy(
            "See how the system works",
            "Bekijk hoe het systeem werkt",
            "اكتشف كيف يعمل النظام",
        ),
        commercialLine: copy(
            "Foundation €3,900 + €249/month · Growth €7,500 + €699/month · excl. VAT, external services, and metered AI.",
            "Foundation €3.900 + €249/maand · Growth €7.500 + €699/maand · excl. btw, externe diensten en gemeten AI.",
            "نظام التأسيس €3,900 + €249 شهريًا · نظام النمو €7,500 + €699 شهريًا · لا تشمل ضريبة القيمة المضافة والخدمات الخارجية واستخدام الذكاء الاصطناعي المقاس.",
        ),
        evidenceEyebrow: copy("The operating question", "De operationele vraag", "سؤال التشغيل"),
        evidenceTitle: copy(
            "Can the next buyer, the next delivery step, and the next decision see the same system?",
            "Zien de volgende koper, de volgende leveringsstap en de volgende beslissing hetzelfde systeem?",
            "هل يرى المشتري التالي وخطوة التنفيذ التالية والقرار التالي النظام نفسه؟",
        ),
        evidenceDescription: copy(
            "The public site is the first visible layer: outcome first, evidence second, tool names only when they help a buyer understand the work.",
            "De publieke site is de eerste zichtbare laag: eerst het resultaat, dan het bewijs, en alleen toolnamen wanneer die het werk voor een koper verduidelijken.",
            "الموقع العام هو الطبقة المرئية الأولى: النتيجة أولًا، ثم الدليل، ولا تُذكر أسماء الأدوات إلا عندما تساعد المشتري على فهم العمل.",
        ),
    },
    ProblemRecognition: {
        eyebrow: copy("Recognition", "Herkenning", "المشكلة"),
        title: copy(
            "The problem is rarely one missing tool.",
            "Het probleem is zelden één ontbrekende tool.",
            "المشكلة نادرًا ما تكون أداة واحدة مفقودة.",
        ),
        points: [
            { text: copy(
                "Your public presence, sales follow-up, and delivery records tell different versions of the business.",
                "Je publieke verhaal, salesopvolging en leveringsdossiers vertellen elk een ander verhaal.",
                "يعرض حضورك العام ومتابعة المبيعات وسجلات التنفيذ نسخًا مختلفة من العمل.",
            ) },
            { text: copy(
                "Useful expertise is published irregularly, while search, newsletter, and media work run as separate tasks.",
                "Expertise verschijnt onregelmatig, terwijl zoekwerk, nieuwsbrief en media losse taken blijven.",
                "تُنشر الخبرة بشكل غير منتظم، بينما يظل البحث والنشرة والعمل الإعلامي مهام منفصلة.",
            ) },
            { text: copy(
                "Bookings, client work, legal records, and commercial follow-up depend on someone remembering the next step.",
                "Boekingen, klantwerk, juridische dossiers en commerciële opvolging hangen af van wie de volgende stap onthoudt.",
                "تعتمد الحجوزات وعمل العملاء والسجلات القانونية والمتابعة التجارية على تذكّر شخص ما للخطوة التالية.",
            ) },
        ],
    },
    SystemMap: {
        eyebrow: copy("The system map", "De systeemkaart", "خريطة النظام"),
        title: copy(
            "Five connected systems. One accountable operating layer.",
            "Vijf verbonden systemen. Eén verantwoordelijke operationele laag.",
            "خمسة أنظمة مترابطة. طبقة تشغيل واحدة واضحة المسؤولية.",
        ),
        description: copy(
            "The work is organized around buyer outcomes and operating loops, not around a catalogue of software features.",
            "Het werk is georganiseerd rond klantresultaten en operationele lussen, niet rond een catalogus met softwarefuncties.",
            "يُنظم العمل حول نتائج المشتري وحلقات التشغيل، لا حول قائمة من خصائص البرامج.",
        ),
    },
    OperatingLoop: {
        eyebrow: copy("Working proof", "Werkend bewijs", "دليل عملي"),
        title: copy(
            "A visible chain from evidence to delivery.",
            "Een zichtbare keten van bewijs naar levering.",
            "سلسلة واضحة من الدليل إلى التنفيذ.",
        ),
        description: copy(
            "Every stage leaves evidence for the next one, so growth and delivery stay reviewable instead of disappearing into disconnected tools.",
            "Elke fase laat bewijs achter voor de volgende, zodat groei en levering controleerbaar blijven in plaats van te verdwijnen in losse tools.",
            "تترك كل مرحلة دليلًا للمرحلة التالية، لتظل عمليات النمو والتنفيذ قابلة للمراجعة بدلًا من التشتت بين أدوات منفصلة.",
        ),
        steps: [
            { stage: copy("Review", "Beoordelen", "مراجعة"), label: copy("Reviewed evidence", "Beoordeeld bewijs", "دليل تمت مراجعته"), description: copy("Proof is checked before it becomes a public claim.", "Bewijs wordt gecontroleerd voordat het een publieke claim wordt.", "يُفحص الدليل قبل أن يتحول إلى ادعاء عام.") },
            { stage: copy("Publish", "Publiceren", "نشر"), label: copy("Approved content", "Goedgekeurde content", "محتوى معتمد"), description: copy("Approved ideas become reusable public content.", "Goedgekeurde ideeën worden herbruikbare publieke content.", "تتحول الأفكار المعتمدة إلى محتوى عام قابل لإعادة الاستخدام.") },
            { stage: copy("Signal", "Signaal", "إشارة"), label: copy("Search or market signal", "Zoek- of marktsignaal", "إشارة بحث أو سوق"), description: copy("Publishing creates search, audience, and market feedback.", "Publicatie levert feedback uit zoekverkeer, publiek en markt op.", "ينتج النشر إشارات من البحث والجمهور والسوق.") },
            { stage: copy("Convert", "Converteren", "تحويل"), label: copy("Enquiry or booking", "Aanvraag of boeking", "استفسار أو حجز"), description: copy("A useful signal becomes a responsible next step.", "Een bruikbaar signaal wordt een verantwoorde volgende stap.", "تتحول الإشارة المفيدة إلى خطوة تالية مسؤولة.") },
            { stage: copy("Deliver", "Leveren", "تنفيذ"), label: copy("Client work and record", "Klantwerk en dossier", "عمل العميل وسجله"), description: copy("Delivery closes with ownership and a usable client record.", "De levering sluit af met eigenaarschap en een bruikbaar klantdossier.", "يُختتم التنفيذ بملكية واضحة وسجل عميل قابل للاستخدام.") },
        ],
    },
    ServiceArchitecture: {
        eyebrow: copy("Five connected systems", "Vijf verbonden systemen", "خمسة أنظمة مترابطة"),
        title: copy(
            "Every service belongs to one operating system.",
            "Elke dienst hoort bij één operationeel systeem.",
            "تنتمي كل خدمة إلى نظام تشغيل واحد.",
        ),
        description: copy(
            "The groups below cover the complete public service scope. Status is stated separately so a configured or assisted workflow is never presented as autonomous software.",
            "De groepen hieronder dekken de volledige publieke scope. De status staat apart, zodat ingericht of ondersteund werk nooit als autonome software wordt verkocht.",
            "تغطي المجموعات أدناه النطاق العام الكامل للخدمات. وتُعرض الحالة منفصلة حتى لا يُقدَّم التدفق المهيأ أو المدعوم بوصفه برنامجًا ذاتيًا.",
        ),
    },
    OfferComparison: {
        eyebrow: copy("The offer", "Het aanbod", "العرض"),
        title: copy(
            "Choose the operating shape that matches the work.",
            "Kies de operationele vorm die bij het werk past.",
            "اختر شكل التشغيل الذي يناسب العمل.",
        ),
        description: copy(
            "Start with a Fit Call. Use a Blueprint when the system needs to be mapped before implementation.",
            "Begin met een Fit Call. Gebruik een Blueprint wanneer het systeem vóór de implementatie in kaart moet worden gebracht.",
            "ابدأ بمكالمة الملاءمة. استخدم مخطط الأنظمة عندما يحتاج النظام إلى رسم واضح قبل التنفيذ.",
        ),
        fitCallLabel: copy("Start with the free Fit Call", "Begin met de gratis Fit Call", "ابدأ بمكالمة الملاءمة المجانية"),
        recommendedLabel: copy("For a broader operating loop", "Voor een bredere operationele lus", "لحلقة تشغيل أوسع"),
        foundationDescription: copy(
            "A managed public presence, structured content, lead capture, analytics, and GDPR foundations.",
            "Een beheerde publieke aanwezigheid, gestructureerde content, leadopvang, analytics en een GDPR-basis.",
            "حضور عام مُدار ومحتوى منظم وجمع للعملاء المحتملين وتحليلات وأساس للامتثال لـGDPR.",
        ),
        growthDescription: copy(
            "Foundation plus the publishing, SEO, booking, newsletter, opportunity, and market-monitoring loops that need to keep moving.",
            "Foundation plus de doorlopende lussen voor publicatie, SEO, boekingen, nieuwsbrief, kansen en marktmonitoring.",
            "نظام التأسيس مع حلقات النشر والسيو والحجز والنشرة والفرص ومراقبة السوق التي يجب أن تستمر في العمل.",
        ),
    },
    ScopeBoundary: {
        eyebrow: copy("Scope and boundaries", "Scope en grenzen", "النطاق والحدود"),
        title: copy(
            "Know what is included before the work begins.",
            "Weet vóór de start wat wel en niet is inbegrepen.",
            "اعرف ما هو مشمول قبل بدء العمل.",
        ),
        description: copy(
            "The offer stays understandable by separating the managed systems, separately scoped work, and the promises iSystem deliberately does not make.",
            "Het aanbod blijft begrijpelijk door beheerde systemen, apart werk en bewuste grenzen van elkaar te scheiden.",
            "يبقى العرض واضحًا عبر فصل الأنظمة المُدارة والعمل ذي النطاق المنفصل والوعود التي يتعمد iSystem عدم تقديمها.",
        ),
    },
    MethodTimeline: {
        eyebrow: copy("The method", "De methode", "المنهج"),
        title: copy(
            "A small number of decisions, made in the right order.",
            "Een beperkt aantal beslissingen, in de juiste volgorde.",
            "عدد محدود من القرارات، يُتخذ بالترتيب الصحيح.",
        ),
        steps: [
            ["01", copy("Fit", "Passendheid", "الملاءمة"), copy("Clarify the outcome, the current setup, and whether the fit is sensible.", "Maak het doel, de huidige situatie en de wederzijdse fit duidelijk.", "وضّح النتيجة والوضع الحالي وما إذا كانت الملاءمة منطقية.")],
            ["02", copy("Blueprint", "Systeemplan", "مخطط الأنظمة"), copy("Map the system and write the implementation shape when the decision needs more detail.", "Breng het systeem in kaart en leg de implementatievorm vast wanneer de beslissing meer detail vraagt.", "ارسم النظام وحدد شكل التنفيذ عندما يحتاج القرار إلى تفاصيل أكثر.")],
            ["03", copy("Implement and operate", "Implementeren en beheren", "التنفيذ والتشغيل"), copy("Build the Foundation or Growth system with clear ownership, review points, and care.", "Bouw het Foundation- of Growth-systeem met duidelijk eigenaarschap, reviewmomenten en beheer.", "ابنِ نظام التأسيس أو النمو بملكية واضحة ونقاط مراجعة ورعاية مستمرة.")],
        ],
    },
    FeatureStatusMatrix: {
        eyebrow: copy("Capability status", "Status van onderdelen", "حالة القدرات"),
        title: copy(
            "What is shipped, configured, assisted, or still ahead.",
            "Wat geleverd, ingericht, ondersteund of nog gepland is.",
            "ما تم تسليمه أو تهيئته أو دعمه، وما لا يزال قادمًا.",
        ),
    },
    FounderWorkingModel: {
        eyebrow: copy("Founder working model", "Founder-led werkmodel", "نموذج العمل بقيادة المؤسس"),
        title: copy(
            "The person who designed the system is accountable for the work.",
            "De ontwerper van het systeem blijft verantwoordelijk voor het werk.",
            "يبقى من صمم النظام مسؤولًا عن العمل.",
        ),
        description: copy(
            "iSystem is founder-led by Hossam Afifi from Breda. The relationship is direct, the system is governed, and the boundary between what is shipped and what is still being built remains visible.",
            "iSystem wordt vanuit Breda geleid door oprichter Hossam Afifi. De samenwerking is direct, het systeem wordt beheerst en de grens tussen wat geleverd is en wat nog wordt gebouwd blijft zichtbaar.",
            "يقود حسام عفيفي iSystem من بريدا. العلاقة مباشرة، والنظام محكوم، والحد الفاصل بين ما تم تسليمه وما لا يزال قيد البناء يظل واضحًا.",
        ),
    },
    FitAndNonFit: {
        fitEyebrow: copy("Good fit", "Goede fit", "ملاءمة جيدة"),
        fitTitle: copy(
            "Owner-led Dutch service firms that need the operation to become legible.",
            "Nederlandse dienstverleners waar de eigenaar de operatie helder en bestuurbaar wil maken.",
            "شركات خدمات هولندية يقودها مالك يريد جعل العمليات واضحة وقابلة للإدارة.",
        ),
        fitDescription: copy(
            "Usually 5–30 people, with real expertise, disconnected tools, and an owner willing to review evidence and make decisions.",
            "Meestal 5–30 mensen, met echte expertise, losse tools en een eigenaar die bewijs wil beoordelen en beslissingen wil nemen.",
            "عادةً ما تضم 5 إلى 30 شخصًا، ولديها خبرة حقيقية وأدوات منفصلة ومالك مستعد لمراجعة الأدلة واتخاذ القرارات.",
        ),
        nonFitEyebrow: copy("Not a fit", "Geen fit", "غير مناسب"),
        nonFitTitle: copy(
            "Not a cheap brochure site, an unmetered AI sandbox, or a 24/7 enterprise delivery team.",
            "Geen goedkope brochuresite, onbeperkte AI-speeltuin of 24/7 enterprise-deliveryteam.",
            "ليس موقعًا تعريفيًا رخيصًا، ولا بيئة ذكاء اصطناعي بلا قياس، ولا فريق تنفيذ مؤسسيًا يعمل على مدار الساعة.",
        ),
        nonFitDescription: copy(
            "The system works when there is an accountable owner, a defined outcome, and enough evidence to improve the next decision.",
            "Het systeem werkt wanneer er een verantwoordelijke eigenaar, een duidelijk resultaat en genoeg bewijs voor een betere volgende beslissing zijn.",
            "يعمل النظام عندما يوجد مالك مسؤول ونتيجة محددة ودليل كافٍ لتحسين القرار التالي.",
        ),
    },
    QuestionAccordion: {
        eyebrow: copy("Questions", "Vragen", "الأسئلة"),
        title: copy("Clear before commercial.", "Duidelijkheid vóór een voorstel.", "وضوح قبل أي عرض تجاري."),
        items: [
            { question: copy("Is the Systems Fit Call free?", "Is de Systems Fit Call gratis?", "هل مكالمة ملاءمة الأنظمة مجانية؟"), answer: ISYSTEM_PUBLIC_OFFER_NOTES.fitCall },
            { question: copy("When is a Systems Blueprint useful?", "Wanneer is een Systems Blueprint zinvol?", "متى يكون مخطط الأنظمة مفيدًا؟"), answer: ISYSTEM_PUBLIC_OFFER_NOTES.blueprint },
            { question: copy("Does Growth include every workspace capability?", "Bevat Growth elke mogelijkheid van de werkruimte?", "هل يشمل نظام النمو كل قدرات مساحة العمل؟"), answer: copy("Growth includes the agreed publishing, search, audience, booking, and monitoring workflows. Legal, embedded, third-party, and unusually complex work may need a separate scope.", "Growth omvat de afgesproken workflows voor publicatie, zoeken, publiek, boekingen en monitoring. Juridisch, embedded, extern of uitzonderlijk complex werk kan een aparte scope vragen.", "يشمل نظام النمو تدفقات النشر والبحث والجمهور والحجز والمراقبة المتفق عليها. وقد يحتاج العمل القانوني أو المدمج أو الخارجي أو المعقد بصورة استثنائية إلى نطاق منفصل.") },
            { question: copy("Is AI usage unlimited?", "Is AI-gebruik onbeperkt?", "هل استخدام الذكاء الاصطناعي غير محدود؟"), answer: copy("No. AI usage is metered, recorded, and reviewed. Third-party costs remain separate and visible.", "Nee. AI-gebruik wordt gemeten, vastgelegd en beoordeeld. Externe kosten blijven apart en zichtbaar.", "لا. يُقاس استخدام الذكاء الاصطناعي ويُسجل ويُراجع، وتظل التكاليف الخارجية منفصلة وواضحة.") },
        ],
    },
    FinalDecisionCta: {
        eyebrow: copy("The next decision", "De volgende beslissing", "القرار التالي"),
        title: copy(
            "Start with the question the system needs to answer.",
            "Begin met de vraag die het systeem moet beantwoorden.",
            "ابدأ بالسؤال الذي يجب على النظام الإجابة عنه.",
        ),
        description: copy(
            "Book a free 30-minute Systems Fit Call with Hossam. No free audit, report, or implementation work is implied.",
            "Plan een gratis Systems Fit Call van 30 minuten met Hossam. Een gratis audit, rapport of implementatiewerk is niet inbegrepen.",
            "احجز مكالمة ملاءمة أنظمة مجانية لمدة 30 دقيقة مع حسام. لا يتضمن ذلك تدقيقًا أو تقريرًا أو عملًا تنفيذيًا مجانيًا.",
        ),
        label: copy("Book the free Systems Fit Call", "Plan de gratis Systems Fit Call", "احجز مكالمة ملاءمة الأنظمة المجانية"),
    },
    ContactExperience: {
        eyebrow: copy("Fit first", "Eerst de fit", "الملاءمة أولًا"),
        title: copy("One conversation before any proposal.", "Eén gesprek vóór ieder voorstel.", "محادثة واحدة قبل أي عرض."),
        description: copy(
            "The free Systems Fit Call is the qualification step. If the decision needs a written system map, the next step is the Systems Blueprint.",
            "De gratis Systems Fit Call is de kwalificatiestap. Als de beslissing een schriftelijke systeemkaart nodig heeft, volgt de Systems Blueprint.",
            "مكالمة ملاءمة الأنظمة المجانية هي خطوة التأهيل. وإذا احتاج القرار إلى خريطة نظام مكتوبة، فالخطوة التالية هي مخطط الأنظمة.",
        ),
        primaryLabel: copy("Book the free Fit Call", "Plan de gratis Fit Call", "احجز مكالمة الملاءمة المجانية"),
        secondaryLabel: copy("Email Hossam", "E-mail Hossam", "راسل حسام"),
    },
};

export function getIsystemPublicBlockDefaults(type: string): Record<string, unknown> {
    return ISYSTEM_PUBLIC_BLOCK_DEFAULTS[type] ?? ISYSTEM_PUBLIC_GENERIC_BLOCK_COPY;
}
