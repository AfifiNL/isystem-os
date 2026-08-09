import type { ProseSection } from "./prose";
import type { ToolLocale, ToolSlug } from "./types";

/**
 * Per-tool, per-locale page copy: FAQ, prose content sections, serviceCta,
 * howTo steps, featureList. The header (title/summary) lives in registry.ts.
 *
 * Authored against the reviewed public brand and localization brief:
 *   - EN tilts to sober EU register.
 *   - NL ≈ 30% shorter than EN, uses "vrijblijvend", "je" for SME audience.
 *     Stakeholder-facing NL gets a native review before public rollout.
 *   - AR is calm MSA B2B, RTL-safe.
 */

export interface ToolPageCopy {
    faq: Array<{ q: string; a: string }>;
    content: ProseSection[];
    serviceCta: { heading: string; body: string; buttonLabel: string };
    howToSteps?: Array<{ name: string; text: string }>;
    featureList?: string[];
}

export type ToolCopyRegistry = Record<ToolSlug, Record<ToolLocale, ToolPageCopy>>;

export const TOOL_COPY: ToolCopyRegistry = {
    "automation-scanner": {
        en: {
            faq: [
                {
                    q: "How is the savings estimate calculated?",
                    a: "We multiply each recommendation's baseline monthly hours by team-size and tech-comfort factors, then by your hourly cost. The estimate is intentionally conservative — most operators we work with realise 1.2–1.6× on top once a workflow beds in. Numbers come from the iSystem implementation playbook, not generic blog benchmarks.",
                },
                {
                    q: "Will Hossam contact me after I run the tool?",
                    a: "Only if you tick the email box. We don't sell or rent leads, we don't cold-call, and we don't run drip sequences. If you opt in, you get one short follow-up from Hossam personally — you can ignore it or reply, your choice. The roadmap is yours regardless.",
                },
                {
                    q: "Why these specific tools?",
                    a: "We picked tools with generous free tiers, real APIs, and a clear path to either self-hosting (n8n) or staying inside one vendor (HubSpot). All have been used in iSystem implementations. If your team prefers others, the roadmap shapes still apply — only the labels change.",
                },
                {
                    q: "Does this work if I'm a solo operator?",
                    a: "Yes. Readiness skews a bit lower (less internal coordination to optimise) but the time saved compounds faster because you are the bottleneck. Pick the top recommendation and ship it before adding anything else.",
                },
            ],
            content: [
                { type: "h2", text: "What this scanner actually does" },
                { type: "p", text: "The Automation Opportunity Scanner is a structured diagnostic, not a generic AI prompt. You give us a thin profile of your operation (sector, team, repetitive workload, comfort with tools) and we score it against a curated playbook of automations iSystem has shipped for real operators — agencies, clinics, real-estate brokerages, legal practices, hospitality groups." },
                { type: "p", text: "The output is ranked by monthly euros saved, not hype. Each recommendation carries a difficulty rating so you know what is a weekend job versus a multi-week build." },
                { type: "h2", text: "How to read your readiness score" },
                {
                    type: "ul-strong", items: [
                        { strong: "0–34 (low)", text: "start with one quick win to build internal trust. Pick a tool you already use and automate the most painful manual step inside it." },
                        { strong: "35–54 (moderate)", text: "you have enough volume to justify a small automation budget. Focus on lead intake or support deflection first." },
                        { strong: "55–74 (high)", text: "you are leaving real money on the table. Run the top two recommendations in parallel and re-run this scanner in 90 days." },
                        { strong: "75+ (critical)", text: "every month you wait costs roughly the figure in \"monthly savings\". Talk to Hossam." },
                    ],
                },
                { type: "h2", text: "Why this isn't an AI prompt with a friendlier UI" },
                { type: "p", text: "Because an ungoverned AI prompt can't tell you what is feasible in your sector, what other operators have actually shipped, or where the typical implementation breaks. The scoring engine is rules-based and deterministic. We use governed AI in production for our clients, not for content generation in a public tool." },
            ],
            serviceCta: {
                heading: "Want Hossam to scope the top three for you?",
                body: "Free 30-minute Systems Fit Call with the founder. We clarify the outcome, your current setup, and whether a fixed-scope build is sensible. No slides or pitch deck; English or Dutch.",
                buttonLabel: "Book the free Systems Fit Call",
            },
            howToSteps: [
                { name: "Answer 10 quick questions", text: "Industry, team size, repetitive workload, customer-inquiry volume, current stack, comfort with tools, and your biggest pain point." },
                { name: "Get a ranked automation roadmap", text: "Top five recommendations ordered by estimated monthly euros saved, each with hours-saved, difficulty, and tool suggestions." },
                { name: "Review your readiness score", text: "0-100 score blending repetition, volume, stack maturity, and tech comfort." },
                { name: "Email yourself the full roadmap (optional)", text: "Printable PDF plus one short follow-up from Hossam if you want a scoping conversation." },
            ],
            featureList: [
                "Ten input fields covering industry, team size, workload, comfort",
                "Curated recommendations from iSystem implementation playbook",
                "Hours-saved + euros-saved estimates per recommendation",
                "Readiness score 0-100 across four weighted signals",
                "Free, anonymous by default, share link, PDF export",
            ],
        },
        nl: {
            faq: [
                {
                    q: "Hoe wordt de besparing berekend?",
                    a: "We vermenigvuldigen de basisbesparing per aanbeveling met factoren voor teamgrootte en tech-comfort, en daarna met je uurkosten. De schatting is bewust conservatief — de meeste operators halen er 1,2–1,6× bovenop zodra de workflow ingebed is. Cijfers komen uit het iSystem implementatie-speelboek, niet uit generieke blogposts.",
                },
                {
                    q: "Neemt Hossam contact op?",
                    a: "Alleen als je het mailvakje aanvinkt. Geen lead-verkoop, geen koude calls, geen drip-sequences. Als je opt-in geeft krijg je één korte follow-up van Hossam zelf. Negeren of antwoorden — jouw keuze. De roadmap is sowieso van jou.",
                },
                {
                    q: "Waarom juist deze tools?",
                    a: "Tools met royale gratis tiers, echte API's en een duidelijk pad naar self-hosting (n8n) of binnen één vendor blijven (HubSpot). Allemaal gebruikt in iSystem-implementaties. Jouw team mag andere kiezen — de roadmap blijft, alleen de labels veranderen.",
                },
                {
                    q: "Werkt dit voor een solo-ondernemer?",
                    a: "Ja. Readiness valt iets lager uit (minder interne coördinatie te optimaliseren) maar bespaarde tijd telt sneller op omdat jij het knelpunt bent. Begin met de bovenste aanbeveling en lever die af voor je iets anders doet.",
                },
            ],
            content: [
                { type: "h2", text: "Wat deze scanner echt doet" },
                { type: "p", text: "De Automation Opportunity Scanner is een gestructureerde diagnose, geen generieke AI-prompt. Je geeft een dun profiel van je bedrijf (sector, team, repetitief werk, tech-comfort) en wij scoren dat tegen een speelboek van automatiseringen die iSystem voor echte operators heeft uitgerold — agencies, klinieken, makelaars, legal, horeca." },
                { type: "p", text: "De output is gerangschikt op euro's per maand, niet op hype. Elke aanbeveling heeft een moeilijkheidsgraad zodat je weet wat een weekendklus is en wat een traject van meerdere weken." },
                { type: "h2", text: "Hoe je je readiness-score leest" },
                {
                    type: "ul-strong", items: [
                        { strong: "0–34 (laag)", text: "begin met één snelle winst om intern vertrouwen op te bouwen. Kies een tool die je al gebruikt en automatiseer de pijnlijkste handmatige stap." },
                        { strong: "35–54 (matig)", text: "je hebt genoeg volume voor een klein automatiseringsbudget. Focus eerst op lead-intake of supportdeflectie." },
                        { strong: "55–74 (hoog)", text: "je laat echt geld liggen. Voer de bovenste twee aanbevelingen parallel uit en draai de scanner over 90 dagen opnieuw." },
                        { strong: "75+ (kritiek)", text: "elke maand wachten kost ongefveer het bedrag bij \"besparing/maand\". Praat met Hossam." },
                    ],
                },
                { type: "h2", text: "Waarom dit geen AI-prompt met fraaie UI is" },
                { type: "p", text: "Omdat een ongereguleerde AI-prompt niet weet wat haalbaar is in jouw sector, wat andere operators echt hebben uitgerold, of waar de gemiddelde implementatie sneuvelt. De scoring-engine is rule-based en deterministisch. Governed AI gebruiken we voor klanten in productie, niet voor contentgeneratie in een publieke tool." },
            ],
            serviceCta: {
                heading: "Hossam de top drie laten scopen?",
                body: "Discovery-call van 30 minuten met de founder. We mappen deze roadmap op jouw stack en team, leggen vast hoe een fixed-scope traject eruitziet, en jij beslist wat er gebeurt. Geen dia's, geen pitchdeck, NL of EN.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
            howToSteps: [
                { name: "Beantwoord 10 korte vragen", text: "Sector, teamgrootte, repetitief werk, klantvragen per maand, huidige stack, tech-comfort en je grootste pijnpunt." },
                { name: "Krijg een gerangschikte automatiseringsroadmap", text: "Top vijf aanbevelingen op volgorde van euro's per maand, met bespaarde uren, moeilijkheid en tools." },
                { name: "Bekijk je readiness-score", text: "0-100 op basis van herhaling, volume, stack-volwassenheid en tech-comfort." },
                { name: "Mail jezelf de volledige roadmap (optioneel)", text: "PDF plus één korte follow-up van Hossam als je wil sparren." },
            ],
            featureList: [
                "Tien invoervelden: sector, team, werklast, comfort",
                "Aanbevelingen uit het iSystem implementatie-speelboek",
                "Uren- en euro-besparing per aanbeveling",
                "Readiness-score 0-100 op vier gewogen signalen",
                "Vrijblijvend, standaard anoniem, deellink en PDF",
            ],
        },
        ar: {
            faq: [
                {
                    q: "كيف تُحتسب الوفورات؟",
                    a: "نضرب الساعات الأساسية لكل توصية بعوامل حجم الفريق والراحة التقنية، ثم بتكلفة الساعة المُدخَلة. التقدير محافظ عمدًا — أغلب المشغّلين يحقّقون 1.2–1.6× أعلى بعد استقرار سير العمل. الأرقام من دليل تنفيذ iSystem، لا من تدوينات عامّة.",
                },
                {
                    q: "هل سيتواصل حسام بعد التشغيل؟",
                    a: "فقط إن أدخلت بريدك. لا بيع للقوائم، لا اتصالات باردة، لا تسلسلات تلقائية. إن وافقت تحصل على متابعة قصيرة واحدة من حسام شخصيًا — تجاهلها أو ردّ، الخيار لك. خارطة الطريق لك بأي حال.",
                },
                {
                    q: "لماذا هذه الأدوات تحديدًا؟",
                    a: "أدوات بطبقات مجانية سخيّة وAPIs حقيقية ومسار واضح إلى الاستضافة الذاتية (n8n) أو البقاء داخل بائع واحد (HubSpot). جميعها مستخدمة في تنفيذات iSystem. إن فضّل فريقك بدائل فالخطّة تبقى صالحة بأسماء مختلفة.",
                },
                {
                    q: "هل يعمل لمشغّل فردي؟",
                    a: "نعم. تنخفض درجة الجاهزية قليلاً لقلّة التنسيق، لكن الوقت الموفّر يتراكم أسرع لأنّك أنت العنق. ابدأ بالتوصية الأعلى وأنجزها قبل أيّ شيء آخر.",
                },
            ],
            content: [
                { type: "h2", text: "ماذا يفعل هذا الماسح فعليًا" },
                { type: "p", text: "ماسح فرص الأتمتة هو تشخيص مهيكَل، لا مجرّد مطالبة ذكاء اصطناعي. تقدّم لنا ملفًا مختصرًا لعملك (القطاع، الفريق، العمل المتكرّر، الراحة التقنية) ونُسجّله مقابل دليل أتمتات نفّذها iSystem لمشغّلين حقيقيين — وكالات وعيادات ومكاتب عقارية وممارسات قانونية ومجموعات ضيافة." },
                { type: "p", text: "النتيجة مرتّبة بحسب اليوروهات الموفّرة شهريًا، لا بحسب الضجيج. لكل توصية تقدير صعوبة لتعرف ما هو عمل عطلة أسبوعية وما هو مشروع أسابيع." },
                { type: "h2", text: "كيف تقرأ درجة جاهزيتك" },
                {
                    type: "ul-strong", items: [
                        { strong: "0–34 (منخفض)", text: "ابدأ بمكسب سريع واحد لبناء الثقة الداخلية. اختر أداة تستخدمها وأتمت أصعب خطوة يدوية فيها." },
                        { strong: "35–54 (متوسط)", text: "حجمك يكفي لميزانية أتمتة صغيرة. ابدأ باستقبال العملاء المحتملين أو تحويل الدعم." },
                        { strong: "55–74 (مرتفع)", text: "أنت تترك مالًا حقيقيًا على الطاولة. شغّل أعلى توصيتين بالتوازي وأعد تشغيل الماسح بعد 90 يومًا." },
                        { strong: "75+ (حرج)", text: "كل شهر تأخير يكلّفك تقريبًا قيمة \"وفر شهري\". تواصل مع حسام." },
                    ],
                },
                { type: "h2", text: "لماذا ليس هذا مطالبة ذكاء اصطناعي بواجهة لطيفة" },
                { type: "p", text: "لأنّ مطالبة ذكاء اصطناعي غير مُحوكَمة لا تعرف ما هو ممكن في قطاعك ولا ما نفّذه المشغّلون فعلًا ولا أين ينهار التنفيذ المعتاد. محرّك التقييم قائم على قواعد وحتمي. نستخدم الذكاء الاصطناعي المُحوكَم لعملائنا في الإنتاج، لا لتوليد محتوى في أداة عامّة." },
            ],
            serviceCta: {
                heading: "تريد من حسام تحديد نطاق الثلاثة الأولى لك؟",
                body: "مكالمة استكشاف 30 دقيقة مع المؤسّس. نُسقط هذه الخارطة على مكدّسك وفريقك ونتّفق على ما يبدو عليه تنفيذ بنطاق ثابت، ثم تقرّر ما يليه. بلا شرائح، بلا عرض مبيعات، بالإنجليزية أو الهولندية.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
            howToSteps: [
                { name: "أجب عن عشرة أسئلة قصيرة", text: "القطاع، حجم الفريق، العمل المتكرّر، حجم الاستفسارات، المكدّس الحالي، الراحة التقنية، وأكبر نقطة ألم." },
                { name: "احصل على خارطة طريق مرتّبة", text: "أعلى خمس توصيات مرتّبة بحسب يوروهات الوفر الشهري، مع ساعات موفّرة وصعوبة وأدوات مقترحة." },
                { name: "راجع درجة الجاهزية", text: "0-100 تجمع التكرار والحجم ونضج المكدّس والراحة التقنية." },
                { name: "أرسل لنفسك الخارطة الكاملة (اختياري)", text: "PDF قابل للطباعة ومتابعة قصيرة من حسام لو أردت محادثة نطاق." },
            ],
            featureList: [
                "عشرة حقول إدخال: القطاع والفريق والعمل والراحة",
                "توصيات من دليل تنفيذ iSystem",
                "تقدير ساعات ويوروهات لكل توصية",
                "درجة جاهزية 0-100 بأربع إشارات موزونة",
                "مجاني، مجهول افتراضيًا، رابط مشاركة وPDF",
            ],
        },
    },
    "automation-roi-calculator": {
        en: {
            faq: [
                { q: "Is this just hours × rate with a coat of paint?", a: "No. We factor in error-and-rework cost, your stated automation coverage percentage, monthly tooling cost, and one-off implementation. The output is a net-savings and a payback figure — not a vanity number designed to push you toward a sale." },
                { q: "What is a realistic automation coverage percentage?", a: "On well-defined tasks with n8n, Zapier, or Make, 60–80% in the first pass is realistic. Above 85% usually requires custom code or a tighter input schema. If you have no idea, start at 70%." },
                { q: "Where does the rework adjustment come from?", a: "Repetitive manual work has a known error rate; the rework factor inflates the hour count to capture cleanup time. If you don't know your real rework rate, 10% is the safe default for most SME teams." },
                { q: "Why not just trust a vendor's ROI calculator?", a: "Vendors model the case where you buy them. We model the case where you implement, including the real implementation hours and the ongoing tooling bill. You should run their version too — the gap between the two numbers is the conversation." },
            ],
            content: [
                { type: "h2", text: "How this differs from a typical ROI calculator" },
                { type: "p", text: "Most online ROI calculators multiply hours × rate and call it done. That makes automation look free. In reality you pay for tooling (n8n cloud, Zapier, your AI provider) every month, and you pay an upfront implementation cost — whether that's your time or a contractor's. We model both, so the payback figure is honest." },
                { type: "h2", text: "How to read the result" },
                { type: "p", text: "Payback under 6 months is a no-brainer — start with the top task and let it self-fund the rest. 6–12 months is still attractive but warrants stakeholder buy-in; use the per-task table to make the case. Above 12 months, scope smaller — pick the one task with the highest waste figure and ship that alone." },
                { type: "h2", text: "Looking for stack-consolidation savings instead?" },
                { type: "p-link", text: "This tool quantifies per-task automation savings. If your problem is more \"our software stack is fragmented and the bill keeps growing,\" the ", linkHref: "/audit", linkLabel: "Stealth CTO systems audit", suffix: " covers that shape of question instead." },
            ],
            serviceCta: {
                heading: "Turn the output into a board-ready business case?",
                body: "30 minutes with Hossam. We pressure-test the numbers, scope phased delivery, and you leave with a one-pager you can show your co-founder or your accountant. No slides, no pitch deck.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
        },
        nl: {
            faq: [
                { q: "Is dit gewoon uren × tarief in een nieuw jasje?", a: "Nee. We rekenen ook fout-en-correctiekosten, je opgegeven automatiseringsdekking, maandelijkse tooling en eenmalige implementatie mee. De uitkomst is netto besparing en terugverdientijd — geen ijdel cijfer om je naar een sale te duwen." },
                { q: "Wat is een realistisch dekkingspercentage?", a: "Op duidelijk afgebakende taken met n8n, Zapier of Make is 60–80% in de eerste ronde realistisch. Boven 85% vraagt meestal custom code of een strakkere input. Geen idee? Begin bij 70%." },
                { q: "Waar komt de rework-correctie vandaan?", a: "Repetitief handwerk heeft een bekende foutkans; de rework-factor verhoogt de uren om de opruimtijd mee te tellen. Weet je je echte rework-percentage niet, dan is 10% veilig voor de meeste MKB-teams." },
                { q: "Waarom geen vendor-calculator?", a: "Vendors modelleren het scenario waarin je hen koopt. Wij modelleren het scenario waarin je echt implementeert, inclusief implementatie-uren en doorlopende toolingkosten. Draai die van hen ook — het verschil tussen beide is het gesprek." },
            ],
            content: [
                { type: "h2", text: "Hoe deze calculator verschilt van een typische" },
                { type: "p", text: "De meeste online ROI-calculators doen uren × tarief en daarmee uit. Dan lijkt automatisering gratis. In werkelijkheid betaal je elke maand voor tooling (n8n cloud, Zapier, je AI-provider) en je betaalt vooraf voor implementatie — jouw tijd of die van een contractor. Wij modelleren beide, dus de terugverdientijd is eerlijk." },
                { type: "h2", text: "Hoe je het resultaat leest" },
                { type: "p", text: "Onder 6 maanden terugverdientijd is een no-brainer — begin met de bovenste taak en laat die de rest financieren. 6–12 maanden blijft aantrekkelijk maar vraagt stakeholder-buy-in; gebruik de tabel om het verhaal op te bouwen. Boven 12 maanden: maak het kleiner — pak de taak met de hoogste verspilling en lever alleen die." },
                { type: "h2", text: "Op zoek naar stack-consolidatie?" },
                { type: "p-link", text: "Deze tool kwantificeert besparingen per taak. Is je probleem meer \"onze stack is versnipperd en de rekening groeit\", dan past de ", linkHref: "/audit", linkLabel: "Stealth CTO systems audit", suffix: " beter." },
            ],
            serviceCta: {
                heading: "De uitkomst omzetten in een board-ready businesscase?",
                body: "30 minuten met Hossam. We toetsen de cijfers, scopen gefaseerde levering en je vertrekt met een one-pager voor je medeoprichter of accountant. Geen dia's, geen pitchdeck.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
        },
        ar: {
            faq: [
                { q: "هل هذا مجرّد ساعات × سعر بطلاء جديد؟", a: "لا. ندخل أيضًا تكلفة الخطأ وإعادة العمل، ونسبة الأتمتة المُدخَلة، والتكلفة الشهرية للأدوات، وتكلفة التنفيذ. النتيجة وفر صافٍ وفترة استرداد — لا رقمٌ لإقناعك بالشراء." },
                { q: "ما النسبة الواقعية لتغطية الأتمتة؟", a: "على مهام محدّدة بـ n8n وZapier وMake، 60–80% في الجولة الأولى واقعي. ما فوق 85% يحتاج عادةً كودًا مخصّصًا أو مدخلات أنظف. إن لم تكن متأكدًا فابدأ من 70%." },
                { q: "من أين تأتي تعديلات إعادة العمل؟", a: "للعمل اليدوي المتكرّر معدّل خطأ معروف؛ معامل إعادة العمل يضخّم الساعات لاحتساب وقت التنظيف. إن لم تعرف معدّلك الحقيقي فـ 10% افتراض آمن لمعظم فرق الشركات الصغيرة والمتوسطة." },
                { q: "لِمَ لا أثق بحاسبة المورّد؟", a: "المورّدون يحاكون سيناريو شرائك منهم. نحن نحاكي سيناريو التنفيذ الحقيقي بساعاته وتكاليف الأدوات المستمرة. شغّل حاسبتهم أيضًا — الفارق بين الرقمين هو الحوار." },
            ],
            content: [
                { type: "h2", text: "كيف تختلف هذه الحاسبة عن غيرها" },
                { type: "p", text: "أغلب الحاسبات على الإنترنت تضرب ساعات × سعر وانتهى. وكأنّ الأتمتة مجانية. في الواقع تدفع شهريًا للأدوات (n8n cloud وZapier ومزوّد الذكاء الاصطناعي) وتدفع تكلفة تنفيذ مسبّقة — وقتك أو وقت مقاول. نحن نحسب كليهما، فتأتي فترة الاسترداد صادقة." },
                { type: "h2", text: "كيف تقرأ النتيجة" },
                { type: "p", text: "استرداد أقل من 6 أشهر قرار سهل — ابدأ بالمهمة الأعلى ودعها تموّل البقية. 6–12 شهرًا جذّاب لكنه يستلزم قبولًا من أصحاب القرار؛ استخدم الجدول لبناء الحجّة. ما فوق 12 شهرًا، قلّص النطاق — اختر المهمة الأعلى هدرًا وأطلقها وحدها." },
                { type: "h2", text: "تبحث عن وفر دمج المكدّس بدلاً من ذلك؟" },
                { type: "p-link", text: "هذه الأداة تقيس وفر الأتمتة لكل مهمة. إن كانت مشكلتك \"مكدّسنا مجزّأ والفاتورة تنمو\" فيناسبك ", linkHref: "/audit", linkLabel: "تدقيق Stealth CTO للأنظمة", suffix: " أكثر." },
            ],
            serviceCta: {
                heading: "تحويل النتيجة إلى دراسة جدوى جاهزة للعرض؟",
                body: "ثلاثون دقيقة مع حسام. نضغط الأرقام، نحدّد نطاق التسليم بمراحل، وتخرج بصفحة واحدة تعرضها على شريكك أو محاسبك. بلا شرائح، بلا عرض مبيعات.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
        },
    },
    "ai-stack-recommender": {
        en: {
            faq: [
                { q: "Why three tiers instead of one perfect stack?", a: "Because every business is on a different curve. Starter is the minimum viable setup. Growth adds revenue tools. Automation removes manual hand-offs once the basics work. You don't have to skip levels — most operators shouldn't." },
                { q: "Are these affiliate links?", a: "Some are. Every affiliate link is tagged with rel=\"sponsored\" so you and search engines know. We only list tools used inside iSystem implementations — not tools that pay us most. If a tool isn't a good fit for SME operators, it isn't on the list." },
                { q: "Can I get a stack tuned to my exact situation?", a: "Yes. 30 minutes with Hossam, we map this output to your current tools, headcount plan, and revenue targets, and you leave with a single sheet showing what to keep, what to drop, and what to add. No subscription pitch." },
                { q: "Why not just recommend iSystem on every tier?", a: "Because that wouldn't be honest. iSystem is a fit for operators consolidating onto one founder-led platform — not a fit for every shape of business. The recommender tells you the truth even when the truth points elsewhere." },
            ],
            content: [
                { type: "h2", text: "What goes into the recommendation" },
                { type: "p", text: "We map your sector and pain points to tools iSystem has repeatedly seen succeed inside SME operations. Each tier is capped against a fraction of the budget you state, so the recommendation stays realistic instead of maximalist. You can always upgrade later — sequencing matters more than picking the \"best\" tool." },
                { type: "h2", text: "What the \"Automation\" tier actually adds" },
                { type: "p", text: "Once you have a CRM and a chat or scheduling layer, the next move is connecting them. The Automation tier adds an orchestration engine (n8n or Make) — software whose entire job is to trigger actions across your stack. That is what turns \"a CRM\" into \"a system that follows up while you sleep.\"" },
                { type: "h2", text: "Why governed automation matters" },
                { type: "p", text: "Every iSystem implementation runs AI work through pre-flight credit metering, an append-only audit ledger, and role-gated mutations. The recommended stacks here are scoped so the same posture is reachable from day one — you don't have to choose between speed and traceability." },
            ],
            serviceCta: {
                heading: "Want Hossam to set this stack up for you?",
                body: "30-minute scoping call, fixed-price implementations, EU-hosted where it matters, and we hand you the keys. You'll know whether iSystem is the right shape for your business by the end of the call.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
        },
        nl: {
            faq: [
                { q: "Waarom drie niveaus en niet één perfecte stack?", a: "Omdat elk bedrijf op een andere curve zit. Starter is het minimum, Groei voegt revenue-tools toe, Automatisering haalt handmatige hand-offs weg zodra de basis loopt. Niveaus overslaan kan, meestal niet slim." },
                { q: "Zijn dit affiliate-links?", a: "Sommige wel. Elke affiliate-link is getagd met rel=\"sponsored\" zodat jij en zoekmachines het weten. We noemen alleen tools die we in iSystem-implementaties gebruiken — niet tools die het meest betalen. Niet passend voor MKB? Niet op de lijst." },
                { q: "Een stack op maat?", a: "Ja. 30 minuten met Hossam, we mappen deze output op je huidige tools, headcount-plan en omzet-targets en je vertrekt met één blad: wat houden, wat schrappen, wat toevoegen. Geen abonnement-pitch." },
                { q: "Waarom niet altijd iSystem aanbevelen?", a: "Omdat dat oneerlijk zou zijn. iSystem past bij operators die consolideren op één founder-led platform — niet bij elk bedrijfstype. De recommender zegt de waarheid, ook als die ergens anders heen wijst." },
            ],
            content: [
                { type: "h2", text: "Wat er in de aanbeveling zit" },
                { type: "p", text: "We mappen je sector en pijnpunten op tools waarvan iSystem keer op keer heeft gezien dat ze werken bij MKB. Elk niveau is afgetopt op een fractie van je opgegeven budget, zodat de aanbeveling realistisch blijft. Upgraden kan altijd — de volgorde telt meer dan \"de beste\" tool." },
                { type: "h2", text: "Wat het \"Automatisering\"-niveau toevoegt" },
                { type: "p", text: "Zodra je een CRM en chat- of planlaag hebt, is de volgende stap: ze verbinden. Het Automatisering-niveau voegt een orchestratie-engine toe (n8n of Make) — software die acties triggert door je hele stack. Dat maakt van \"een CRM\" een \"systeem dat opvolgt terwijl jij slaapt.\"" },
                { type: "h2", text: "Waarom governed automatisering telt" },
                { type: "p", text: "Elke iSystem-implementatie draait AI-werk via pre-flight credit-check, append-only audit-ledger en role-gated mutaties. De aanbevolen stacks hier zijn zo geschaald dat dezelfde governance vanaf dag één bereikbaar is — je kiest niet tussen snelheid en traceerbaarheid." },
            ],
            serviceCta: {
                heading: "Hossam de stack laten opzetten?",
                body: "Scopingsgesprek van 30 minuten, fixed-price implementatie, EU-gehost waar dat telt, en we leveren de sleutels op. Aan het einde van het gesprek weet je of iSystem past.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
        },
        ar: {
            faq: [
                { q: "لماذا ثلاث طبقات بدل مكدّس واحد مثالي؟", a: "لأنّ كل عمل في منحنى مختلف. \"المبتدئ\" هو الحد الأدنى الفعّال، \"النمو\" يضيف أدوات الإيرادات، \"الأتمتة\" تزيل المناولات اليدوية بعد استقرار الأساسيات. تخطّي الطبقات ممكن لكنه نادرًا ما يكون صائبًا." },
                { q: "هل هذه روابط شراكة؟", a: "بعضها نعم. كل رابط شراكة موسوم بـ rel=\"sponsored\" حتى تعرفه أنت ومحرّكات البحث. لا نُرشّح إلا أدوات نستخدمها في تنفيذات iSystem — لا الأدوات التي تدفع أكثر. إن لم تكن مناسبة للشركات الصغيرة والمتوسطة فلن تُذكر." },
                { q: "هل أحصل على مكدّس مفصّل؟", a: "نعم. ثلاثون دقيقة مع حسام، نُسقط هذه النتيجة على أدواتك الحالية وخطّة الموظّفين وأهداف الإيرادات، وتخرج بصفحة واحدة: ما تبقي وما تُسقط وما تُضيف. بلا عرض اشتراك." },
                { q: "لماذا لا تُرشّحون iSystem في كل طبقة؟", a: "لأنّ ذلك لن يكون صادقًا. iSystem يناسب المشغّلين الذين يوحّدون على منصّة واحدة بقيادة المؤسّس — لا كل شكل من أشكال الأعمال. الموصي يقول الحقيقة حتى لو أشارت إلى مكان آخر." },
            ],
            content: [
                { type: "h2", text: "ماذا يدخل في التوصية" },
                { type: "p", text: "نُسقط قطاعك ونقاط ألمك على أدوات رأت iSystem نجاحها مرارًا داخل عمليات الشركات الصغيرة والمتوسطة. كل طبقة مُحدّدة بسقف جزء من ميزانيتك المُدخَلة، فتبقى التوصية واقعية لا متطرّفة. يمكنك الترقية لاحقًا — الترتيب أهم من \"أفضل\" أداة." },
                { type: "h2", text: "ماذا تُضيف طبقة \"الأتمتة\" فعلًا" },
                { type: "p", text: "بعد توفّر CRM وطبقة محادثة أو جدولة، الخطوة التالية ربطها. طبقة الأتمتة تُضيف محرّك تنسيق (n8n أو Make) — برنامج وظيفته إطلاق إجراءات عبر مكدّسك. ذلك ما يحوّل \"CRM\" إلى \"نظام يُتابع بينما أنت نائم\"." },
                { type: "h2", text: "لماذا تهمّ الأتمتة المُحوكَمة" },
                { type: "p", text: "كل تنفيذ iSystem يُجري عمل الذكاء الاصطناعي عبر فحص رصيد مسبق، وسجلّ تدقيق غير قابل للتعديل، وتغييرات مقيّدة بالأدوار. المكدّسات الموصى بها هنا مُحدّدة حتى يصل الموقف نفسه منذ اليوم الأول — لا تختار بين السرعة وقابلية التتبّع." },
            ],
            serviceCta: {
                heading: "تريد من حسام تجهيز هذا المكدّس؟",
                body: "مكالمة تحديد نطاق 30 دقيقة، تنفيذات بسعر ثابت، استضافة أوروبية حيث يهمّ، ونسلّمك المفاتيح. ستعرف بنهاية المكالمة إن كان iSystem يناسب عملك.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
        },
    },
    "ai-visibility-checker": {
        en: {
            faq: [
                { q: "Does this query ChatGPT, Perplexity, and Google's AI Overviews directly?", a: "No. We audit the signals AI engines use to decide whether to cite a page — schema markup, FAQ phrasing, brand-mention density, content depth, canonical links. For prompt-level testing, run the sample prompts in each engine yourself; we show you which ones to try." },
                { q: "Why does schema matter for AI search?", a: "Schema.org markup gives machines explicit context about an organization and a page. It supports interpretation, but it does not guarantee citation or ranking." },
                { q: "How often should I re-check?", a: "After any meaningful content or template change, and at least quarterly. AI engines re-crawl and re-score continuously; the score from three months ago does not reflect today." },
                { q: "What's a practical first fix?", a: "Add real customer questions as clear headings with concise answers. Where the visible page genuinely contains an FAQ, mirror it in valid FAQPage structured data." },
            ],
            content: [
                { type: "h2", text: "What \"AI visibility\" means in practice" },
                { type: "p", text: "AI answer engines interpret public pages before deciding which sources to mention. Clear entities, useful answers, consistent metadata, and real content depth make a page easier to understand; none of those signals guarantees a citation." },
                { type: "h2", text: "A practical first lever for SME operators" },
                { type: "p", text: "Start with real customer questions and concise visible answers. Add valid FAQPage structured data only when those questions and answers are present on the page." },
                { type: "h2", text: "Why iSystem ships governed AI for visibility work" },
                { type: "p", text: "AI-assisted edits in the iSystem SEO Control Center use reviewed public sources where evidence is needed, a visible change preview, and rollback. We treat AI-search visibility as an editorial problem under governance, not a content-spam problem at scale." },
            ],
            serviceCta: {
                heading: "Want a full AI visibility roadmap for your top pages?",
                body: "Start with the free 30-minute Systems Fit Call. We clarify which pages matter and whether a separately scoped audit is justified. English or Dutch.",
                buttonLabel: "Book the free Systems Fit Call",
            },
            howToSteps: [
                { name: "Enter your URL, brand, and industry", text: "We need the page to audit plus enough context to generate prompt-test suggestions tailored to your business." },
                { name: "Run the AI visibility audit", text: "Nine signal checks: title, meta description, OpenGraph, H1, schema, FAQ phrasing, brand-mention density, canonical, content depth." },
                { name: "Review the readiness score and fix list", text: "Each check is graded pass/warn/fail with a concrete recommendation. We also list sample prompts to test in ChatGPT, Perplexity, and Google AI Overviews." },
                { name: "Email the full report (optional)", text: "Send yourself the printable version plus one short follow-up from Hossam." },
            ],
            featureList: [
                "Nine weighted citation-readiness signals",
                "Schema (JSON-LD) detection with Organization + FAQPage emphasis",
                "Brand-mention density measurement",
                "Sample AI-search prompts tailored to your brand + industry",
                "Cached scan results so repeated runs return immediately",
            ],
        },
        nl: {
            faq: [
                { q: "Bevraagt dit ChatGPT, Perplexity en Google AI Overviews direct?", a: "Nee. We auditen de signalen die AI-engines gebruiken om te beslissen of ze een pagina citeren — schema, FAQ-fraseringen, merkvermeldingen, content-diepte, canonical. Voor prompt-tests draai je de voorbeelden zelf; we tonen je welke." },
                { q: "Waarom telt schema voor AI-zoeken?", a: "Schema.org geeft machines expliciete context over een organisatie en pagina. Het helpt bij interpretatie, maar garandeert geen citaat of ranking." },
                { q: "Hoe vaak hercheckenof?", a: "Na elke betekenisvolle content- of template-wijziging, minimaal eens per kwartaal. AI-engines crawlen en hercoderen continu; de score van drie maanden geleden is niet die van vandaag." },
                { q: "Wat is een praktische eerste verbetering?", a: "Voeg echte klantvragen toe als duidelijke koppen met beknopte antwoorden. Gebruik FAQPage structured data alleen als die vragen en antwoorden ook zichtbaar op de pagina staan." },
            ],
            content: [
                { type: "h2", text: "Wat \"AI-zichtbaarheid\" in de praktijk betekent" },
                { type: "p", text: "AI-antwoordmachines interpreteren publieke pagina's voordat ze bronnen noemen. Duidelijke entiteiten, bruikbare antwoorden, consistente metadata en echte inhoudelijke diepgang maken een pagina beter begrijpelijk; geen van deze signalen garandeert een citaat." },
                { type: "h2", text: "Een praktische eerste hefboom voor MKB-ondernemers" },
                { type: "p", text: "Begin met echte klantvragen en beknopte zichtbare antwoorden. Voeg alleen geldige FAQPage structured data toe wanneer die vragen en antwoorden ook op de pagina staan." },
                { type: "h2", text: "Waarom iSystem governed AI voor zichtbaarheid levert" },
                { type: "p", text: "AI-ondersteunde bewerkingen in het iSystem SEO Control Center gebruiken beoordeelde publieke bronnen waar bewijs nodig is, plus een zichtbare wijzigingspreview en rollback. AI-zichtbaarheid is voor ons een redactioneel probleem onder governance, geen content-spam-probleem op schaal." },
            ],
            serviceCta: {
                heading: "Een complete AI-zichtbaarheidsroadmap voor je top-pagina's?",
                body: "Begin met de gratis Systems Fit Call van 30 minuten. We bepalen welke pagina's tellen en of een apart gescopeerde audit zinvol is. Nederlands of Engels.",
                buttonLabel: "Plan de gratis Systems Fit Call",
            },
            howToSteps: [
                { name: "Vul je URL, merk en branche in", text: "We hebben de pagina nodig plus context om prompt-tests af te stemmen op je bedrijf." },
                { name: "Voer de AI-zichtbaarheidsaudit uit", text: "Negen signalen: title, meta description, OpenGraph, H1, schema, FAQ-frasering, merkvermeldingen, canonical, contentdiepte." },
                { name: "Bekijk de readiness-score en fix-lijst", text: "Elke check krijgt pass/warn/fail met concrete aanbeveling. We tonen voorbeeldprompts om in ChatGPT, Perplexity en AI Overviews te testen." },
                { name: "Mail jezelf het volledige rapport (optioneel)", text: "PDF plus één korte follow-up van Hossam." },
            ],
            featureList: [
                "Negen gewogen citaat-readiness signalen",
                "Schema (JSON-LD) detectie met focus op Organization + FAQPage",
                "Merkvermeldings-dichtheid meting",
                "Voorbeeldprompts toegesneden op merk + branche",
                "Cache-resultaten voor herhaalruns",
            ],
        },
        ar: {
            faq: [
                { q: "هل تستجوب ChatGPT وPerplexity وGoogle AI Overviews مباشرة؟", a: "لا. ندقّق الإشارات التي تستخدمها محرّكات الذكاء الاصطناعي لتقرير الاقتباس — السكيمات، صياغة الأسئلة الشائعة، كثافة ذكر العلامة، عمق المحتوى، Canonical. لاختبار المطالبات شغّل الأمثلة بنفسك؛ نحن نُريك أيّها." },
                { q: "لِمَ تهمّ السكيمات لبحث الذكاء الاصطناعي؟", a: "تمنح Schema.org الآلات سياقًا صريحًا عن المؤسسة والصفحة. وهي تساعد على الفهم، لكنها لا تضمن الاقتباس أو الترتيب." },
                { q: "كم مرّة أُعيد الفحص؟", a: "بعد أي تغيير محتوى/قالب مهمّ، وكل ربع سنة على الأقل. تُعيد المحرّكات الزحف والتقييم باستمرار؛ درجة قبل ثلاثة أشهر ليست درجة اليوم." },
                { q: "ما أول تحسين عملي؟", a: "أضف أسئلة عملاء حقيقية كعناوين واضحة مع إجابات موجزة. استخدم بيانات FAQPage المنظمة فقط عندما تظهر الأسئلة والإجابات فعلًا على الصفحة." },
            ],
            content: [
                { type: "h2", text: "ماذا يعني الظهور في إجابات الذكاء الاصطناعي عمليًا" },
                { type: "p", text: "تفسر محركات الإجابة صفحات الويب قبل أن تقرر ذكر المصادر. تجعل الكيانات الواضحة والإجابات المفيدة والبيانات المتسقة والعمق الحقيقي الصفحة أسهل للفهم، لكن لا توجد إشارة تضمن الاقتباس." },
                { type: "h2", text: "رافعة أولى عملية للشركات الصغيرة والمتوسطة" },
                { type: "p", text: "ابدأ بأسئلة عملاء حقيقية وإجابات موجزة ظاهرة. أضف بيانات FAQPage المنظمة فقط عندما تكون الأسئلة والإجابات موجودة على الصفحة." },
                { type: "h2", text: "لماذا تستخدم iSystem ذكاءً مُحوكَمًا في أعمال الظهور" },
                { type: "p", text: "تستخدم التعديلات المدعومة بالذكاء الاصطناعي في مركز SEO مصادر عامة تمت مراجعتها عند الحاجة إلى دليل، مع معاينة واضحة للتغيير وإمكان التراجع. نتعامل مع الظهور باعتباره مسألة تحريرية تحت الحوكمة، لا إنتاج محتوى مزعج على نطاق واسع." },
            ],
            serviceCta: {
                heading: "تريد خارطة طريق كاملة لظهور صفحاتك الأهم؟",
                body: "ابدأ بمكالمة ملاءمة الأنظمة المجانية لمدة 30 دقيقة. نحدد الصفحات المهمة وما إذا كان التدقيق المنفصل مبررًا. بالإنجليزية أو الهولندية.",
                buttonLabel: "احجز مكالمة ملاءمة الأنظمة",
            },
            howToSteps: [
                { name: "أدخل الرابط والعلامة والقطاع", text: "نحتاج الصفحة وسياقًا يكفي لاقتراح مطالبات اختبار مخصّصة لعملك." },
                { name: "شغّل تدقيق الظهور", text: "تسع فحوصات: العنوان، الوصف، OpenGraph، H1، السكيمات، صياغة الأسئلة الشائعة، كثافة ذكر العلامة، Canonical، عمق المحتوى." },
                { name: "راجع درجة الجاهزية وقائمة الإصلاح", text: "كل فحص يأخذ ناجح/تنبيه/فشل مع توصية عملية. نعرض أمثلة مطالبات لتجربتها في ChatGPT وPerplexity وAI Overviews." },
                { name: "أرسل التقرير الكامل لنفسك (اختياري)", text: "PDF قابل للطباعة ومتابعة قصيرة من حسام." },
            ],
            featureList: [
                "تسع إشارات جاهزية اقتباس موزونة",
                "اكتشاف السكيمات مع تركيز على Organization + FAQPage",
                "قياس كثافة ذكر العلامة",
                "أمثلة مطالبات مخصّصة للعلامة والقطاع",
                "نتائج مفحوصة مخزّنة لمعالجة فورية للتكرار",
            ],
        },
    },
    "support-automation-readiness": {
        en: {
            faq: [
                { q: "When does an AI chatbot beat hiring a person?", a: "When inquiries are repetitive and high-volume. Below ~200 a month it is usually cheaper to keep humans on it. Above that, deflecting even 40% of inquiries covers the tooling bill several times over." },
                { q: "What about phone / voice agents?", a: "Production-ready for narrow scripts (booking confirmations, status checks, after-hours triage). For open-ended technical support they still struggle on edge cases — pair with human escalation rather than replacing humans." },
                { q: "Our tickets are complex. Is automation a waste?", a: "No, but the play changes. Instead of deflection, use AI to draft responses and surface relevant context. Agents stay in control, and handle time drops 30–40%. We see this work especially well in legal, financial-services, and regulated B2B support." },
                { q: "Where does the readiness score come from?", a: "Four signals: monthly inquiry volume, repetition rate, response-time SLA, and complexity. Volume and repetition drive ROI; complexity caps how much can be auto-resolved; slow response time pushes you toward automation faster because delays compound into more inbound load." },
            ],
            content: [
                { type: "h2", text: "How the readiness score is built" },
                { type: "p", text: "We weight four signals: inquiry volume, repetition, response time, and complexity. Volume and repetition drive ROI; complexity caps how much can be auto-resolved. Long response times push you toward automation faster because every hour of delay compounds into more inbound load." },
                { type: "h2", text: "If you score below 35" },
                { type: "p", text: "Don't buy a chatbot yet. Start with a public FAQ and canned-response macros inside your existing inbox. Re-run this tool in three months once you have the FAQ data — the second readiness pass is usually the one that justifies the spend." },
                { type: "h2", text: "How iSystem handles support automation under governance" },
                { type: "p", text: "Every AI-drafted response in an iSystem implementation runs through the same review surface as content — diff, rationale, risk flags, atomic apply, rollback. Agents stay in control. The chatbot doesn't go rogue at 3am." },
            ],
            serviceCta: {
                heading: "Want a chatbot trained on your real documentation?",
                body: "30 minutes with Hossam. We scope a fixed-price chatbot rollout — your docs, your tone, human escalation, analytics — typically live inside two weeks. EN or NL.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
        },
        nl: {
            faq: [
                { q: "Wanneer wint een AI-chatbot van een nieuwe medewerker?", a: "Als vragen repetitief en in hoog volume zijn. Onder ~200 per maand is een mens vaak goedkoper. Daarboven dekt 40% deflectie de toolingkosten meerdere keren." },
                { q: "Telefoon-/spraakagenten?", a: "Productie-ready voor smalle scripts (bevestigingen, statuschecks, triage buiten kantooruren). Voor open technische support struikelen ze nog op edge cases — combineer met menselijke escalatie." },
                { q: "Onze tickets zijn complex. Verspilling?", a: "Nee, de speelwijze verandert. Geen deflectie maar AI-drafts en context-surfacing. Agents houden controle, handle time daalt 30–40%. Werkt vooral in legal, financial services en regulated B2B." },
                { q: "Waar komt de readiness-score vandaan?", a: "Vier signalen: maandvolume, herhalingsgraad, responstijd-SLA en complexiteit. Volume en herhaling drijven ROI; complexiteit limiteert auto-resolutie; trage responstijd duwt sneller richting automatisering omdat vertraging extra inbound oplevert." },
            ],
            content: [
                { type: "h2", text: "Hoe de readiness-score is opgebouwd" },
                { type: "p", text: "Vier gewogen signalen: volume, herhaling, responstijd en complexiteit. Volume en herhaling drijven ROI; complexiteit beperkt auto-resolutie. Trage responstijd duwt richting automatisering omdat elke uur vertraging optelt tot meer inbound." },
                { type: "h2", text: "Score onder 35?" },
                { type: "p", text: "Koop nog geen chatbot. Begin met een publieke FAQ en canned-response macro's in je inbox. Herdraai de tool over drie maanden zodra je FAQ-data hebt — de tweede ronde rechtvaardigt meestal de uitgave." },
                { type: "h2", text: "Hoe iSystem support-automatisering onder governance levert" },
                { type: "p", text: "Elke AI-draftrespons binnen iSystem gaat door dezelfde review-surface als content — diff, rationale, risk-flags, atomic apply, rollback. Agents houden controle. De chatbot loopt om 3 uur 's nachts niet vrij rond." },
            ],
            serviceCta: {
                heading: "Een chatbot getraind op je echte documentatie?",
                body: "30 minuten met Hossam. We scopen een fixed-price chatbot-uitrol — jouw documenten, jouw tone, menselijke escalatie, analytics — meestal binnen twee weken live. NL of EN.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
        },
        ar: {
            faq: [
                { q: "متى تتفوّق دردشة الذكاء الاصطناعي على توظيف شخص؟", a: "حين تكون الاستفسارات متكرّرة وعالية الحجم. تحت ~200 شهريًا، البشر أرخص عادةً. فوق ذلك، تحويل 40% من الاستفسارات يغطّي فاتورة الأدوات أضعافًا." },
                { q: "ماذا عن وكلاء الهاتف/الصوت؟", a: "جاهزون للإنتاج في نصوص ضيّقة (تأكيدات حجز، فحص حالة، فرز بعد الدوام). للدعم الفنّي المفتوح ما زالوا يتعثّرون في الحالات الحدّية — اقرنهم بتصعيد بشري." },
                { q: "تذاكرنا معقّدة. هل الأتمتة هدر؟", a: "لا، لكنّ اللعبة تتغيّر. بدلًا من التحويل، استخدم الذكاء الاصطناعي لصياغة الردود وعرض السياق. يبقى الموظّفون متحكّمين وينخفض زمن المعالجة 30–40%. يعمل ذلك جيّدًا في الدعم القانوني والمالي والقطاعات المنظَّمة." },
                { q: "من أين تأتي درجة الجاهزية؟", a: "أربع إشارات: حجم الاستفسارات الشهري، معدّل التكرار، اتفاقية مستوى الردّ، التعقيد. الحجم والتكرار يدفعان العائد؛ التعقيد يحدّ ما يُحَلّ تلقائيًا؛ بطء الردّ يسرّع الحاجة إلى الأتمتة لأنّ التأخير يتراكم." },
            ],
            content: [
                { type: "h2", text: "كيف تُبنى درجة الجاهزية" },
                { type: "p", text: "أربع إشارات موزونة: حجم الاستفسارات، التكرار، زمن الردّ، التعقيد. الحجم والتكرار يدفعان العائد؛ التعقيد يحدّ التحويل التلقائي. زمن الردّ البطيء يسرّع الاتّجاه نحو الأتمتة لأنّ كل ساعة تأخير تتراكم إلى حمل إضافي." },
                { type: "h2", text: "إذا حصلت على درجة دون 35" },
                { type: "p", text: "لا تشترِ دردشة بعد. ابدأ بصفحة أسئلة شائعة عامّة وماكروات ردود جاهزة في صندوق بريدك. أعد تشغيل الأداة بعد ثلاثة أشهر بمجرّد توفّر بيانات الأسئلة — الجولة الثانية عادةً ما تبرّر النفقة." },
                { type: "h2", text: "كيف تُدير iSystem أتمتة الدعم تحت الحوكمة" },
                { type: "p", text: "كل ردّ يصوغه الذكاء الاصطناعي في تنفيذ iSystem يمرّ بسطح المراجعة نفسه الذي يمرّ به المحتوى — فرق ومبرّر وعلامات مخاطر وتطبيق ذرّي وتراجع. يبقى الموظّفون متحكّمين. لن تنطلق الدردشة في الثالثة فجرًا." },
            ],
            serviceCta: {
                heading: "تريد دردشة مدرّبة على وثائقك الفعلية؟",
                body: "ثلاثون دقيقة مع حسام. نُحدّد نطاق إطلاق دردشة بسعر ثابت — وثائقك ولهجتك وتصعيد بشري وتحليلات — جاهزة عادةً خلال أسبوعين. بالإنجليزية أو الهولندية.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
        },
    },
    "review-response-generator": {
        en: {
            faq: [
                { q: "Will Google penalise AI-drafted replies?", a: "No. Google's guidance is that AI-assisted replies are fine as long as the response is helpful and authentic. The output here is intentionally a strong first draft — read it, add one specific detail from the customer's experience, then post." },
                { q: "How should I handle a 1-star review?", a: "Acknowledge, don't argue, and move the conversation off-platform. The 1–2 star templates intentionally invite a private email follow-up rather than relitigating in public. Never promise refunds or specific compensation in the public reply — that promise becomes the next reviewer's expectation." },
                { q: "Why does the Arabic reply differ from a literal translation?", a: "Because direct translations sound stilted. We use modern standard Arabic phrasing tuned for B2C service businesses — not a word-for-word English mirror. Hossam reviews the AR template set personally; it's his native language." },
                { q: "Is the AI output safe to post?", a: "Safe-but-bland by design. The system prompt forbids promises, refunds, named-and-shaming, and any line you'd regret. If the AI is unavailable we fall back to a deterministic template. Edit before posting, every time — that's the rule even for human-only teams." },
            ],
            content: [
                { type: "h2", text: "Treat the output as a strong first draft" },
                { type: "p", text: "Add one specific detail from the customer's actual experience before posting. That single detail is what makes the reply read as human and stops future readers from spotting an AI draft. We keep the output deliberately \"safe\": no promises, no offers of refunds, no naming-and-shaming." },
                { type: "h2", text: "Why iSystem doesn't auto-post" },
                { type: "p", text: "Because the cost of a wrong public reply is higher than the value of one more reply per day. Every AI surface inside iSystem is reviewable, reversible, and gated by role. Public review replies are the textbook case for human approval." },
            ],
            serviceCta: {
                heading: "Want review replies on a governed pipeline?",
                body: "30 minutes with Hossam. We scope a reputation automation that drafts, routes, and posts review responses with human approval — and logs every action against your workspace audit ledger.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
        },
        nl: {
            faq: [
                { q: "Strait Google AI-drafted antwoorden af?", a: "Nee. Google's richtlijn: AI-ondersteunde antwoorden mogen, mits ze nuttig en authentiek zijn. De output is bewust een sterke eerste draft — lees, voeg één specifiek detail uit de klantervaring toe, post." },
                { q: "Hoe een 1-ster review aanpakken?", a: "Erkenning, niet discussiëren, gesprek offline halen. De 1–2 ster-templates nodigen bewust uit tot privé-mail in plaats van openbare herhaling. Nooit refunds of specifieke compensatie beloven in publiek antwoord — die belofte wordt de verwachting van de volgende reviewer." },
                { q: "Waarom is het Arabische antwoord geen letterlijke vertaling?", a: "Directe vertaling klinkt stijf. We gebruiken MSA gestemd op B2C-dienstverlening — geen woord-voor-woord-spiegel. Hossam reviewt de AR-templates zelf; het is zijn moedertaal." },
                { q: "Is de AI-output veilig te posten?", a: "Veilig-maar-saai by design. De system prompt verbiedt beloftes, refunds, naming-and-shaming, en alles waar je spijt van zou krijgen. Bij AI-storing valt de tool terug op een deterministische template. Altijd bewerken voor je post — geldt ook voor human-only teams." },
            ],
            content: [
                { type: "h2", text: "Behandel de output als sterke eerste draft" },
                { type: "p", text: "Voeg vóór posten één specifiek detail uit de echte klantervaring toe. Dat ene detail maakt het antwoord menselijk en voorkomt dat toekomstige lezers de AI-draft zien. We houden de output bewust \"veilig\": geen beloftes, geen refunds, geen naming-and-shaming." },
                { type: "h2", text: "Waarom iSystem niet auto-post" },
                { type: "p", text: "Omdat de kost van een fout publiek antwoord groter is dan de waarde van één extra antwoord per dag. Elke AI-surface in iSystem is reviewbaar, omkeerbaar en role-gated. Publieke reviewantwoorden zijn het schoolvoorbeeld voor menselijke goedkeuring." },
            ],
            serviceCta: {
                heading: "Reviewantwoorden op een governed pipeline?",
                body: "30 minuten met Hossam. We scopen een reputatie-automatisering die drafts maakt, routeert en post met menselijke approval — en logt elke actie tegen je workspace audit-ledger.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
        },
        ar: {
            faq: [
                { q: "هل تعاقب Google الردود التي يصوغها الذكاء الاصطناعي؟", a: "لا. توجيه Google: الردود بمساعدة الذكاء الاصطناعي مقبولة ما دامت مفيدة وأصيلة. مخرجاتنا مسوّدة قوية متعمَّدة — اقرأها، أضف تفصيلًا من تجربة العميل، ثم انشر." },
                { q: "كيف أتعامل مع تقييم بنجمة واحدة؟", a: "أقرّ، لا تجادل، وانقل الحوار خارج المنصّة. قوالب 1–2 نجمة تدعو عمدًا إلى متابعة عبر بريد خاص بدل إعادة النقاش علنًا. لا تَعِد باسترداد أو تعويض محدّد في ردّ علني — يتحوّل ذلك إلى توقّع لمَن يليه." },
                { q: "لِمَ لا يكون الردّ العربي ترجمة حرفية؟", a: "لأنّ الترجمات المباشرة تبدو متكلّفة. نستخدم العربية الفصحى الحديثة المضبوطة لأعمال الخدمات للمستهلك — لا مرآة كلمة-بكلمة. حسام يراجع قوالب العربية شخصيًا؛ إنّها لغته الأم." },
                { q: "هل المخرجات آمنة للنشر؟", a: "آمنة-لكن-باهتة بالتصميم. التعليمات تمنع الوعود وردّ الأموال والتشهير وأي سطر سيُندَم عليه. عند تعطّل الذكاء الاصطناعي تعود الأداة إلى قالب حتمي. عدّل قبل النشر دائمًا — قاعدة تشمل الفرق البشريّة فقط أيضًا." },
            ],
            content: [
                { type: "h2", text: "تعامل مع المخرجات كمسوّدة أوّلية قويّة" },
                { type: "p", text: "أضف قبل النشر تفصيلًا واحدًا من تجربة العميل الفعليّة. ذلك التفصيل يجعل الردّ يبدو إنسانيًا ويمنع القارئ القادم من تمييز مسوّدة الذكاء الاصطناعي. نُبقي المخرجات \"آمنة\" عمدًا: لا وعود، لا عروض استرداد، لا تشهير." },
                { type: "h2", text: "لماذا لا تنشر iSystem تلقائيًا" },
                { type: "p", text: "لأنّ تكلفة ردّ علني خاطئ أعلى من قيمة ردّ إضافي يوميًا. كل سطح ذكاء اصطناعي في iSystem قابل للمراجعة والعكس ومقيّد بالأدوار. الردود العلنية مثال نموذجي للحاجة إلى موافقة بشريّة." },
            ],
            serviceCta: {
                heading: "ردود تقييمات على خطّ أنابيب مُحوكَم؟",
                body: "ثلاثون دقيقة مع حسام. نُحدّد نطاق أتمتة سمعة تصوغ الردود وتُوجّهها وتنشرها بموافقة بشريّة — وتُسجّل كل إجراء في دفتر تدقيق مساحة عملك.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
        },
    },
    "gdpr-cookie-scanner": {
        en: {
            faq: [
                { q: "Does a clean scan mean my site is GDPR compliant?", a: "No — compliance also covers contracts (DPAs), data residency, retention policies, and DSR handling, which a URL scan can't see. This tool catches the most common public-facing failures: missing banners, missing policies, and trackers that fire pre-consent. It's the first 30%, not the whole picture." },
                { q: "I have a consent banner but you didn't detect it. Why?", a: "We fingerprint the major CMPs (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano, Quantcast) and the common cookie-consent scripts. Custom-built banners can slip through. Email the URL and we'll add the fingerprint — it makes the tool more useful for the next operator too." },
                { q: "We use Google Tag Manager — is GTM itself a problem?", a: "GTM is the loader, not the tag — but the tags it deploys (GA4, Google Ads, Meta Pixel) almost always require consent. Wire GTM to your CMP using Consent Mode v2 so non-essential tags don't fire pre-consent." },
                { q: "What changed in EU enforcement recently?", a: "Dutch AP, Belgian APD, French CNIL, and Italian Garante are all issuing fines for analytics that fire pre-consent or for missing Article 13 disclosures. The bar moved in the last two years; an audit from 2022 is not enough." },
            ],
            content: [
                { type: "h2", text: "What we actually check" },
                { type: "p", text: "We fetch the page HTML once (no headless browser, no follow-on requests) and look for fingerprints of 20+ commonly-deployed trackers, the major consent management platforms, and links to your privacy, cookie, and terms pages. Trackers that require consent under GDPR are separated from essential ones like Stripe.js or privacy-friendly analytics such as Plausible." },
                { type: "h2", text: "Why a banner alone isn't enough" },
                { type: "p", text: "A common failure mode: install a banner but fire Google Analytics and Meta Pixel anyway on page load. That violates Article 6 because consent must be obtained before processing. Use Google Consent Mode v2 (or your CMP's equivalent) to actually gate the tags. The Dutch AP, CNIL, and Garante have all issued fines on exactly this failure in the last two years." },
                { type: "h2", text: "The honest limit of a public scan" },
                { type: "p", text: "A URL scan sees what an unauthenticated visitor sees. It cannot see your DPA stack, your data residency, your retention policies, or your DSR workflow. The iSystem platform supports compliance posture — but the operator still has obligations only a human can satisfy. We are explicit about that distinction." },
            ],
            serviceCta: {
                heading: "Want the fix scoped properly, not duct-taped?",
                body: "30 minutes with Hossam. We install a CMP, wire it to your tag manager, write the privacy and cookie policies in your locale, and document data flows — typically inside one week. Fixed price, EN or NL.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
            howToSteps: [
                { name: "Enter your website URL", text: "Paste the homepage or any landing page URL into the scanner." },
                { name: "Run the GDPR scan", text: "We fetch the page HTML, fingerprint 20+ tracker scripts, detect consent platforms, and check for privacy/cookie/terms links." },
                { name: "Review the risk score and findings", text: "Trackers requiring consent are separated from essential ones. Findings are ranked by severity with concrete fix recommendations." },
                { name: "Email yourself the full checklist (optional)", text: "Opt in to receive the printable compliance checklist and one short follow-up from Hossam." },
            ],
            featureList: [
                "Detects 20+ commonly-deployed trackers including GA4, GTM, Meta Pixel, LinkedIn Insight, Hotjar, Clarity",
                "Fingerprints major consent management platforms (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano)",
                "Checks for privacy policy, cookie policy, and terms of service links",
                "SSRF-safe URL fetching with private-network protection",
                "Free, anonymous by default, optional email delivery",
            ],
        },
        nl: {
            faq: [
                { q: "Een schone scan = GDPR-compliant?", a: "Nee — compliance bevat ook DPA's, dataresidentie, bewaartermijnen en DSR-flow, niet zichtbaar in een URL-scan. Deze tool vangt de meest voorkomende publieke faalmodes: ontbrekende banners, ontbrekend beleid, trackers die pre-consent vuren. Eerste 30%, niet het hele plaatje." },
                { q: "Ik heb een consent-banner maar jullie zien hem niet?", a: "We fingerprinten grote CMP's (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano, Quantcast) en gangbare consent-scripts. Custom banners glippen er soms doorheen. Mail de URL — we voegen de fingerprint toe en de tool wordt voor de volgende operator beter." },
                { q: "We gebruiken Google Tag Manager — is GTM het probleem?", a: "GTM is de loader, niet de tag — maar de tags die het uitrolt (GA4, Google Ads, Meta Pixel) vereisen vrijwel altijd consent. Wire GTM aan je CMP via Consent Mode v2 zodat non-essential tags niet pre-consent vuren." },
                { q: "Wat is er recent veranderd in EU-handhaving?", a: "AP (NL), APD (BE), CNIL (FR) en Garante (IT) beboeten allemaal analytics die pre-consent vuren of ontbrekende Artikel 13-disclosures. De lat ging omhoog in twee jaar; een audit uit 2022 is niet genoeg." },
            ],
            content: [
                { type: "h2", text: "Wat we daadwerkelijk controleren" },
                { type: "p", text: "We halen de page HTML één keer op (geen headless browser, geen follow-ups) en kijken naar fingerprints van 20+ trackers, de grote consent-platforms, en links naar je privacy-, cookie- en terms-pagina's. Consent-vereiste trackers worden gescheiden van essentiële zoals Stripe.js of privacy-vriendelijke analytics zoals Plausible." },
                { type: "h2", text: "Waarom een banner alleen niet genoeg is" },
                { type: "p", text: "Een veelvoorkomende faalmode: banner installeren maar Google Analytics en Meta Pixel toch laten vuren op page load. Dat schendt Artikel 6, want consent moet voor processing zijn. Gebruik Google Consent Mode v2 (of CMP-equivalent) om tags echt te gaten. AP, CNIL en Garante hebben in twee jaar boetes uitgedeeld op precies deze fout." },
                { type: "h2", text: "De eerlijke grens van een publieke scan" },
                { type: "p", text: "Een URL-scan ziet wat een ongeauthenticeerde bezoeker ziet. Hij ziet je DPA-stack niet, je dataresidentie niet, je bewaartermijnen niet, je DSR-flow niet. iSystem ondersteunt compliance-posture — maar de operator heeft verplichtingen die alleen een mens kan vervullen. We zijn daar expliciet over." },
            ],
            serviceCta: {
                heading: "De fix goed scopen, niet plakband?",
                body: "30 minuten met Hossam. We installeren een CMP, wire het aan je tag manager, schrijven privacy- en cookiebeleid in je taal en documenteren datastromen — meestal binnen een week. Fixed price, NL of EN.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
            howToSteps: [
                { name: "Vul de URL in", text: "Plak de homepage of een willekeurige landingspagina-URL in de scanner." },
                { name: "Start de GDPR-scan", text: "We halen de HTML op, fingerprinten 20+ tracker-scripts, detecteren consent-platforms en checken links naar privacy/cookie/terms." },
                { name: "Bekijk de risicoscore en bevindingen", text: "Consent-vereiste trackers gescheiden van essentiële. Bevindingen op ernst gerangschikt met concrete fixes." },
                { name: "Mail jezelf de volledige checklist (optioneel)", text: "Opt-in voor de printbare compliance-checklist plus één korte follow-up van Hossam." },
            ],
            featureList: [
                "Detecteert 20+ trackers waaronder GA4, GTM, Meta Pixel, LinkedIn Insight, Hotjar, Clarity",
                "Fingerprinted CMP's (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano)",
                "Checkt privacy-, cookie- en terms-links",
                "SSRF-veilige URL-fetch met private-network bescherming",
                "Vrijblijvend, standaard anoniem, optionele e-mail",
            ],
        },
        ar: {
            faq: [
                { q: "هل المسح النظيف يعني الامتثال لـ GDPR؟", a: "لا — يشمل الامتثال أيضًا اتفاقيات DPA وإقامة البيانات وسياسات الحفظ وتدفّق DSR، وهي غير مرئية في فحص URL. تلتقط الأداة أبرز الإخفاقات العلنيّة: غياب البانر، غياب السياسات، وأدوات التتبّع التي تعمل قبل الموافقة. 30% الأولى، لا الصورة الكاملة." },
                { q: "لديّ بانر موافقة لكنّكم لم تكتشفوه. لماذا؟", a: "نُبصم منصّات الموافقة الكبرى (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano, Quantcast) وسكربتات consent الشائعة. البانرات المخصّصة قد تُفلت. أرسل الرابط ونُضيف البصمة — تصبح الأداة أنفع للمشغّل التالي." },
                { q: "نستخدم Google Tag Manager — هل GTM مشكلة بحدّ ذاته؟", a: "GTM هو المُحمِّل، لا العلامة — لكنّ العلامات التي ينشرها (GA4, Google Ads, Meta Pixel) تحتاج موافقة غالبًا. اربط GTM بمنصّتك عبر Consent Mode v2 حتى لا تعمل العلامات غير الأساسيّة قبل الموافقة." },
                { q: "ما الذي تغيّر في تطبيق الاتحاد الأوروبي مؤخّرًا؟", a: "AP (هولندا) وAPD (بلجيكا) وCNIL (فرنسا) وGarante (إيطاليا) يصدرون غرامات على التحليلات التي تعمل قبل الموافقة وعلى غياب إفصاحات المادة 13. ارتفعت العتبة في السنتين الأخيرتين؛ تدقيق 2022 لم يعد كافيًا." },
            ],
            content: [
                { type: "h2", text: "ماذا نفحص فعلًا" },
                { type: "p", text: "نسحب HTML الصفحة مرّة واحدة (بلا متصفّح خفي، بلا طلبات تابعة) ونبحث عن بصمات 20+ من أدوات التتبّع، ومنصّات الموافقة الكبرى، وروابط صفحات الخصوصية والكوكيز والشروط. الأدوات التي تحتاج موافقة GDPR تُفصَل عن الأساسيّة مثل Stripe.js أو التحليلات الصديقة للخصوصية مثل Plausible." },
                { type: "h2", text: "لِمَ البانر وحده لا يكفي" },
                { type: "p", text: "نمط إخفاق شائع: تركيب بانر لكن مع تشغيل Google Analytics وMeta Pixel على تحميل الصفحة على أي حال. ذلك يخالف المادة 6 لأنّ الموافقة يجب أن تسبق المعالجة. استخدم Consent Mode v2 من Google (أو ما يعادله في منصّتك) لإيقاف العلامات فعلًا. أصدرت AP وCNIL وGarante غرامات على هذا تحديدًا خلال السنتين." },
                { type: "h2", text: "الحدّ الصريح للمسح العام" },
                { type: "p", text: "مسح URL يرى ما يراه زائر غير مُسجَّل. لا يرى DPA ولا إقامة البيانات ولا سياسات الحفظ ولا تدفّق DSR. منصّة iSystem تدعم موقف الامتثال — لكن للمشغّل التزامات لا يستطيع تأديتها سوى بشر. نُصرّح بهذا الفرق." },
            ],
            serviceCta: {
                heading: "تريد إصلاحًا بنطاق محكَم لا حلًا ترقيعيًا؟",
                body: "ثلاثون دقيقة مع حسام. نُركّب منصّة موافقة، نربطها بمدير العلامات، ونكتب سياسات الخصوصية والكوكيز بلغتك ونوثّق تدفّقات البيانات — عادةً خلال أسبوع. سعر ثابت، بالإنجليزية أو الهولندية.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
            howToSteps: [
                { name: "أدخل رابط الموقع", text: "ألصق رابط الصفحة الرئيسية أو أي صفحة هبوط في الماسح." },
                { name: "شغّل مسح GDPR", text: "نسحب HTML ونُبصم 20+ من سكربتات التتبّع ونكتشف منصّات الموافقة ونفحص روابط الخصوصية/الكوكيز/الشروط." },
                { name: "راجع درجة المخاطر والنتائج", text: "أدوات التتبّع المحتاجة موافقة مفصولة عن الأساسيّة. النتائج مرتّبة بالخطورة مع توصيات إصلاح ملموسة." },
                { name: "أرسل القائمة الكاملة لنفسك (اختياري)", text: "اشترك لتلقّي قائمة الامتثال القابلة للطباعة ومتابعة قصيرة من حسام." },
            ],
            featureList: [
                "يكتشف 20+ من أدوات التتبّع بينها GA4 وGTM وMeta Pixel وLinkedIn Insight وHotjar وClarity",
                "بصمة لمنصّات الموافقة الكبرى (Cookiebot, OneTrust, CookieYes, Termly, iubenda, Osano)",
                "يفحص روابط سياسة الخصوصية والكوكيز والشروط",
                "جلب URL آمن من SSRF مع حماية الشبكات الخاصّة",
                "مجاني، مجهول افتراضيًا، توصيل بريدي اختياري",
            ],
        },
    },
    "conversion-audit": {
        en: {
            faq: [
                { q: "Why isn't this a Lighthouse-style technical audit?", a: "Because Lighthouse already exists for technical SEO and performance. This tool grades the signals that decide whether visitors actually convert: CTA verbs, trust signals, lead-magnet presence, contact options. Different question, different tool." },
                { q: "What's the single biggest fix on most landing pages?", a: "Action-oriented CTA verbs combined with one specific, ungated piece of social proof. Generic 'Learn more' buttons next to anonymous testimonials lose to specific verbs next to a named-customer quote — every time we measure it." },
                { q: "Does this work for B2B SaaS landing pages?", a: "Yes, though we recommend running it on individual landing pages (e.g. /pricing, /demo, /feature-x) rather than your homepage. Homepages carry too many jobs to grade fairly — they're an overview, not a conversion surface." },
                { q: "Where does the grade come from?", a: "Nine weighted checks: H1 clarity, CTA verb presence, contact options, trust signals, lead-magnet language, mobile viewport, title length, meta description, and structured data. Fail-warn-pass per check, weighted by impact, normalised to 0–100." },
            ],
            content: [
                { type: "h2", text: "What this catches that \"normal\" SEO audits miss" },
                { type: "p", text: "Generic SEO tools tell you whether your title is the right length. They don't tell you whether your CTA is action-oriented or whether your trust signals are anonymous (and therefore worthless). We focus on the \"will a visitor actually convert?\" signals first, then layer in the AI- and SEO-readiness basics." },
                { type: "h2", text: "Why CTA copy outweighs everything else" },
                { type: "p", text: "A visitor decides to click in roughly 1.5 seconds. Generic verbs (\"Get started\", \"Learn more\", \"Click here\") lose because they describe the action without committing to a reward. Specific verbs win because they promise something concrete — a call with a named person, a downloadable spec, a price." },
                { type: "h2", text: "How iSystem ships conversion work under governance" },
                { type: "p", text: "Every conversion-copy change inside an iSystem implementation runs through the SEO Control Center: preview the diff, apply atomically, roll back if it underperforms. Conversion rewrites are a versioned editorial operation, not a guess-and-hope." },
            ],
            serviceCta: {
                heading: "Want a hands-on conversion rewrite?",
                body: "30 minutes with Hossam. We rewrite your hero, CTAs, and trust strip, then ship them via your existing CMS — fixed price, EN or NL. Numbers don't move because we wrote a brief; they move because we shipped the change.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
            howToSteps: [
                { name: "Enter your landing page URL", text: "Paste the URL of the page you want graded (works best on individual landing pages, not homepages)." },
                { name: "Run the conversion audit", text: "Nine weighted checks: H1 clarity, CTA verbs, contact options, trust signals, lead-magnet language, viewport, title length, meta description, structured data." },
                { name: "Read the grade and fix list", text: "Score out of 100 with letter grade. Each check is graded pass/warn/fail with a specific recommendation you can ship the same day." },
            ],
            featureList: [
                "Nine weighted conversion-readiness signals",
                "CTA verb detection across 12 common patterns",
                "Trust signal scan: testimonials, named customers, certifications, guarantees",
                "Lead-magnet language detection",
                "Cached results, free, anonymous by default",
            ],
        },
        nl: {
            faq: [
                { q: "Waarom geen Lighthouse-achtige technische audit?", a: "Omdat Lighthouse al bestaat voor technische SEO en performance. Deze tool beoordeelt de signalen die bepalen of bezoekers daadwerkelijk converteren: CTA-werkwoorden, vertrouwenssignalen, leadmagnet-aanwezigheid, contactopties. Andere vraag, andere tool." },
                { q: "Wat is de grootste fix op de meeste landingspagina's?", a: "Actiegerichte CTA-werkwoorden plus één specifiek, niet-gegate social-proof element. Generieke 'Lees meer'-knoppen naast anonieme testimonials verliezen van specifieke werkwoorden naast een named-customer-quote — elke keer dat we het meten." },
                { q: "Werkt dit voor B2B SaaS landingspagina's?", a: "Ja, maar draai het op individuele landingspagina's (bijv. /pricing, /demo, /feature-x), niet op je homepage. Homepages dragen te veel taken om eerlijk te beoordelen — ze zijn overzicht, geen conversie-surface." },
                { q: "Waar komt het cijfer vandaan?", a: "Negen gewogen checks: H1, CTA-werkwoord, contactopties, vertrouwenssignalen, leadmagnet-taal, mobile viewport, titellengte, meta description, structured data. Fail-warn-pass per check, gewogen op impact, genormaliseerd naar 0–100." },
            ],
            content: [
                { type: "h2", text: "Wat dit vangt wat \"gewone\" SEO-audits missen" },
                { type: "p", text: "Generieke SEO-tools vertellen je of je title de juiste lengte heeft. Niet of je CTA actiegericht is of je trust signals anoniem (en dus waardeloos). Wij focussen eerst op \"converteert deze bezoeker?\"-signalen, daarna leggen we AI- en SEO-readiness eroverheen." },
                { type: "h2", text: "Waarom CTA-tekst zwaarder weegt dan al de rest" },
                { type: "p", text: "Een bezoeker beslist in ~1,5 seconde om te klikken. Generieke werkwoorden (\"Get started\", \"Lees meer\", \"Klik hier\") verliezen omdat ze de actie beschrijven zonder beloning te beloven. Specifieke werkwoorden winnen omdat ze iets concreets beloven — een gesprek met een named person, een downloadbare spec, een prijs." },
                { type: "h2", text: "Hoe iSystem conversiewerk onder governance levert" },
                { type: "p", text: "Elke conversie-tekstwijziging in een iSystem-implementatie loopt via het SEO Control Center: preview de diff, apply atomic, rollback bij underperformance. Conversie-rewrites zijn een versioned editorial operation, geen guess-and-hope." },
            ],
            serviceCta: {
                heading: "Hands-on conversie-rewrite?",
                body: "30 minuten met Hossam. We herschrijven je hero, CTA's en trust-strip en zetten ze live via je bestaande CMS — fixed price, NL of EN. Cijfers bewegen niet omdat we een brief schrijven; ze bewegen omdat we de wijziging live zetten.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
            howToSteps: [
                { name: "Vul de URL in", text: "Plak de URL van de pagina die je wil laten beoordelen (werkt het best op individuele landingspagina's, niet homepages)." },
                { name: "Voer de conversie-audit uit", text: "Negen gewogen checks: H1, CTA-werkwoorden, contactopties, trust signals, leadmagnet-taal, viewport, titellengte, meta description, structured data." },
                { name: "Lees het cijfer en fix-lijst", text: "Score 0-100 met lettercijfer. Elke check pass/warn/fail met specifieke aanbeveling die je dezelfde dag kunt uitrollen." },
            ],
            featureList: [
                "Negen gewogen conversie-readiness signalen",
                "CTA-werkwoord detectie over 12 patronen",
                "Trust-signal scan: testimonials, named customers, certificeringen, garanties",
                "Leadmagnet-taal detectie",
                "Cache-resultaten, vrijblijvend, standaard anoniem",
            ],
        },
        ar: {
            faq: [
                { q: "لِمَ ليس هذا تدقيق Lighthouse تقني؟", a: "لأنّ Lighthouse موجود لـ SEO التقني والأداء. هذه الأداة تُقيّم الإشارات التي تقرّر هل يُحوّل الزوّار فعلًا: أفعال CTA، إشارات الثقة، وجود مغناطيس عملاء، خيارات التواصل. سؤال مختلف، أداة مختلفة." },
                { q: "ما أكبر إصلاح في معظم صفحات الهبوط؟", a: "أفعال CTA موجّهة للفعل + قطعة دليل اجتماعي محدّد وغير محجوب. أزرار \"Learn more\" عامّة بجانب توصيات مجهولة تخسر أمام أفعال محدّدة بجانب اقتباس عميل مُسمّى — كلّ مرّة نقيس." },
                { q: "هل يعمل لصفحات هبوط B2B SaaS؟", a: "نعم، لكن أنصح بتشغيله على صفحات فردية (مثلًا /pricing, /demo, /feature-x) لا الصفحة الرئيسية. الصفحات الرئيسية تحمل وظائف كثيرة لا تُقيَّم بإنصاف — هي عرض، لا سطح تحويل." },
                { q: "من أين يأتي التقدير؟", a: "تسع فحوصات موزونة: H1، فعل CTA، خيارات التواصل، إشارات الثقة، لغة مغناطيس العملاء، Viewport للجوال، طول العنوان، الوصف، البيانات المهيكلة. ناجح/تنبيه/فشل لكل فحص، موزون بالأثر، يُطبّع إلى 0–100." },
            ],
            content: [
                { type: "h2", text: "ماذا تلتقط هذه الأداة ممّا تفوّته أدوات SEO \"العادية\"" },
                { type: "p", text: "أدوات SEO العامّة تخبرك إن كان طول عنوانك صحيحًا. لا تخبرك إن كان CTA موجّهًا للفعل ولا إن كانت إشارات ثقتك مجهولة (وبالتالي بلا قيمة). نُركّز أوّلًا على إشارات \"هل سيتحوّل الزائر فعلًا؟\"، ثم نُضيف أساسيّات الجاهزية لـ AI وSEO." },
                { type: "h2", text: "لِمَ نسخة CTA تفوق كل شيء آخر" },
                { type: "p", text: "يقرّر الزائر النقر خلال ~1.5 ثانية. الأفعال العامّة (\"Get started\", \"Learn more\", \"Click here\") تخسر لأنّها تصف الفعل دون وعد بمكافأة. الأفعال المحدّدة تربح لأنّها تَعِد بشيء ملموس — مكالمة مع شخص مُسمّى، مواصفات قابلة للتنزيل، سعر." },
                { type: "h2", text: "كيف تُسلّم iSystem عمل التحويل تحت الحوكمة" },
                { type: "p", text: "كل تعديل نسخ تحويل داخل تنفيذ iSystem يمرّ بمركز SEO: معاينة الفرق، تطبيق ذرّي، تراجع إن لم يؤدِّ. إعادة كتابة التحويل عمليّة تحريرية مُصدَّرة، لا تخمين وأمل." },
            ],
            serviceCta: {
                heading: "تريد إعادة كتابة تحويل عمليّة؟",
                body: "ثلاثون دقيقة مع حسام. نُعيد كتابة Hero وCTAs وشريط الثقة وننشرها عبر نظام إدارة المحتوى الحالي — سعر ثابت، بالإنجليزية أو الهولندية. الأرقام لا تتحرّك لأنّنا كتبنا موجزًا؛ تتحرّك لأنّنا نشرنا التغيير.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
            howToSteps: [
                { name: "أدخل رابط صفحة الهبوط", text: "ألصق رابط الصفحة المراد تقييمها (الأفضل على صفحات فردية لا رئيسية)." },
                { name: "شغّل تدقيق التحويل", text: "تسع فحوصات موزونة: H1، أفعال CTA، خيارات التواصل، إشارات الثقة، لغة مغناطيس العملاء، Viewport، طول العنوان، الوصف، البيانات المهيكلة." },
                { name: "اقرأ التقدير وقائمة الإصلاح", text: "درجة من 100 مع تقدير حرفي. كل فحص ناجح/تنبيه/فشل مع توصية محدّدة قابلة للنشر في اليوم نفسه." },
            ],
            featureList: [
                "تسع إشارات جاهزية تحويل موزونة",
                "اكتشاف أفعال CTA عبر 12 نمطًا شائعًا",
                "مسح إشارات الثقة: توصيات، عملاء مُسمّون، شهادات، ضمانات",
                "اكتشاف لغة مغناطيس العملاء",
                "نتائج مخزّنة، مجاني، مجهول افتراضيًا",
            ],
        },
    },
    "nl-zzp-agreement-generator": {
        en: {
            faq: [
                { q: "Is this a legally binding Dutch agreement?", a: "It produces a plain Dutch service-agreement draft you can print, sign, and send. It is not legal advice and it does not know your exact risk profile. For high-value, regulated, or unusual engagements, have a Dutch legal professional review it." },
                { q: "Is the tool Wet DBA-compliant?", a: "The wording is Wet DBA-aware: it avoids employment-style markers such as a hierarchy relationship, fixed working hours, and mandatory personal performance. That does not guarantee compliance in practice — how you actually work with the client still matters." },
                { q: "Does iSystem store my contract data?", a: "No. This public generator renders the agreement in your browser. There is no submit button and no server-side contract storage. If you want storage, signing, audit trail, and retention, that is the managed Legal Vault workflow inside iSystem." },
                { q: "Why include 21% BTW wording?", a: "Most Dutch ZZP service work is invoiced with 21% BTW. The template states the fee exclusive of 21% BTW so both sides understand the commercial basis. If your service is exempt or different, adjust the text before signing." },
            ],
            content: [
                { type: "h2", text: "What this generator is built for" },
                { type: "p", text: "This tool is for Dutch ZZP operators who need a clean dienstverleningsovereenkomst quickly: a clear scope, independent-contractor language, fee terms, payment period, notice period, confidentiality, liability, and Dutch-law clause. It is deliberately practical — not a 30-page template you never finish." },
                { type: "h2", text: "Why the agreement is browser-only" },
                { type: "p", text: "A contract generator is a high-trust surface. The public version does not send your names, KvK numbers, scope, or fee to iSystem. The preview is rendered locally from the fields you type. Print it, save it, close the tab — the page does not keep a copy." },
                { type: "h2", text: "When to move from the free generator to Legal Vault" },
                { type: "ul-strong", items: [
                    { strong: "Use the free generator", text: "for straightforward ZZP service work where both parties know the scope and only need a sensible written basis." },
                    { strong: "Use Legal Vault", text: "when you need e-signing, audit trail, seven-year retention, invoice linkage, bookkeeping context, or repeatable templates across clients." },
                    { strong: "Use a lawyer", text: "when the assignment has IP transfer, regulated advice, sensitive data processing, large liability, international law, or anything you would not want tested in court from a free template." },
                ] },
            ],
            serviceCta: {
                heading: "Want the managed version inside iSystem?",
                body: "Hossam can set up the Legal Vault workflow around your real client process: templates, signing, retention, invoice linkage, and a clean hand-off from booking to agreement. 30 minutes, no pitch deck, EN or NL.",
                buttonLabel: "Plan a 30-minute call with Hossam",
            },
            howToSteps: [
                { name: "Fill in contractor and client details", text: "Add names, cities, KvK numbers, BTW-id, and the client entity details." },
                { name: "Describe the work", text: "Write the assignment scope clearly enough that both parties can recognise what is included and excluded." },
                { name: "Set commercial terms", text: "Choose start/end date, notice period, fee basis, and payment term." },
                { name: "Preview and print", text: "Review the Dutch agreement in the live preview, then use the print dialog to save it as PDF." },
            ],
            featureList: [
                "Wet DBA-aware independent-contractor clause",
                "Dutch-language dienstverleningsovereenkomst output",
                "21% BTW fee wording",
                "Browser-only rendering with no signup",
                "Live preview and print-to-PDF workflow",
            ],
        },
        nl: {
            faq: [
                { q: "Is dit een juridisch bindende Nederlandse overeenkomst?", a: "De tool maakt een Nederlandstalige concept-dienstverleningsovereenkomst die je kunt printen, ondertekenen en versturen. Het is geen juridisch advies en kent jouw exacte risicoprofiel niet. Laat hoge, gereguleerde of afwijkende opdrachten juridisch checken." },
                { q: "Is de tool Wet DBA-proof?", a: "De tekst is Wet DBA-bewust: geen gezagsverhouding, geen vaste werktijden en ruimte voor vrije vervanging. Dat garandeert niets als de praktijk anders is. De manier waarop je samenwerkt blijft bepalend." },
                { q: "Slaat iSystem mijn contractgegevens op?", a: "Nee. Deze publieke generator rendert in je browser. Er is geen submit-knop en geen serveropslag. Wil je opslag, ondertekening, audit trail en bewaarplicht, dan hoort dat in de Legal Vault binnen iSystem." },
                { q: "Waarom staat er 21% BTW in?", a: "Veel Nederlandse ZZP-dienstverlening wordt met 21% BTW gefactureerd. De template noemt het tarief exclusief 21% BTW zodat de commerciële basis duidelijk is. Is jouw dienst vrijgesteld of anders belast, pas de tekst aan voor ondertekening." },
            ],
            content: [
                { type: "h2", text: "Waar deze generator voor bedoeld is" },
                { type: "p", text: "Voor ZZP'ers die snel een nette dienstverleningsovereenkomst nodig hebben: duidelijke scope, zelfstandigheids-taal, tarief, betaaltermijn, opzegtermijn, geheimhouding, aansprakelijkheid en Nederlands recht. Praktisch bewust — geen template van 30 pagina's die je nooit afmaakt." },
                { type: "h2", text: "Waarom browser-only" },
                { type: "p", text: "Een contractgenerator vraagt vertrouwen. Deze publieke versie stuurt je namen, KvK-nummers, scope en tarief niet naar iSystem. De preview wordt lokaal gemaakt uit wat je typt. Print, bewaar, sluit de tab — de pagina houdt geen kopie vast." },
                { type: "h2", text: "Wanneer je overstapt naar Legal Vault" },
                { type: "ul-strong", items: [
                    { strong: "Gratis generator", text: "voor eenvoudige ZZP-dienstverlening waarbij beide partijen de scope kennen en een nette schriftelijke basis nodig hebben." },
                    { strong: "Legal Vault", text: "als je e-signing, audit trail, zeven jaar bewaarplicht, factuurkoppeling, boekhoudcontext of herbruikbare templates per klant nodig hebt." },
                    { strong: "Jurist", text: "bij IP-overdracht, gereguleerd advies, gevoelige data, hoge aansprakelijkheid, internationaal recht of alles wat je niet met een gratis template in de rechtbank wil testen." },
                ] },
            ],
            serviceCta: {
                heading: "De beheerde versie binnen iSystem?",
                body: "Hossam kan de Legal Vault-workflow rond je echte klantproces inrichten: templates, ondertekening, bewaarplicht, factuurkoppeling en een nette overdracht van boeking naar overeenkomst. 30 minuten, geen pitchdeck, NL of EN.",
                buttonLabel: "Plan 30 minuten met Hossam",
            },
            howToSteps: [
                { name: "Vul opdrachtnemer en opdrachtgever in", text: "Namen, vestigingsplaatsen, KvK-nummers, BTW-id en klantgegevens." },
                { name: "Beschrijf de werkzaamheden", text: "Schrijf de scope concreet genoeg zodat beide partijen weten wat wel en niet inbegrepen is." },
                { name: "Zet de commerciële afspraken", text: "Kies ingangsdatum, einddatum, opzegtermijn, tariefbasis en betaaltermijn." },
                { name: "Bekijk en print", text: "Controleer de Nederlandse overeenkomst in de live preview en bewaar via printen als PDF." },
            ],
            featureList: [
                "Wet DBA-bewuste zelfstandigheidsclausule",
                "Nederlandstalige dienstverleningsovereenkomst",
                "21% BTW-tarieftekst",
                "Browser-only rendering zonder registratie",
                "Live preview en print-naar-PDF workflow",
            ],
        },
        ar: {
            faq: [
                { q: "هل هذا عقد هولندي ملزم قانونيًا؟", a: "تُنتج الأداة مسودة عقد خدمات هولندية يمكن طباعتها وتوقيعها وإرسالها. لكنها ليست نصيحة قانونية ولا تعرف ملف المخاطر الخاص بك. راجع مختصًا قانونيًا هولنديًا في الأعمال عالية القيمة أو المنظمة أو غير المعتادة." },
                { q: "هل الأداة متوافقة مع Wet DBA؟", a: "الصياغة تراعي Wet DBA: تتجنب مؤشرات علاقة العمل مثل التبعية وساعات العمل الثابتة ووجوب الأداء الشخصي. هذا لا يضمن الامتثال إذا كان التنفيذ العملي مختلفًا." },
                { q: "هل يخزن iSystem بيانات العقد؟", a: "لا. هذه النسخة العامة تعرض العقد داخل المتصفح. لا يوجد زر إرسال ولا تخزين للعقد على الخادم. التخزين والتوقيع وسجل التدقيق والحفظ تتم داخل Legal Vault في iSystem." },
                { q: "لماذا تُذكر BTW بنسبة 21٪؟", a: "معظم خدمات ZZP الهولندية تُفوَّتر مع BTW بنسبة 21٪. يذكر النموذج أن الأجر دون BTW حتى تكون الأساس التجاري واضحًا. إن كانت خدمتك معفاة أو مختلفة، عدّل النص قبل التوقيع." },
            ],
            content: [
                { type: "h2", text: "لمن صُمّم هذا المولّد" },
                { type: "p", text: "الأداة لمشغّلي ZZP في هولندا الذين يحتاجون عقد خدمات واضحًا بسرعة: نطاق عمل، صياغة استقلالية، أجر، مدة سداد، مهلة إنهاء، سرية، مسؤولية، وقانون هولندي. عملي عمدًا — لا نموذج من 30 صفحة لن تكمله." },
                { type: "h2", text: "لماذا يعمل داخل المتصفح فقط" },
                { type: "p", text: "مولّد العقود سطح يتطلب ثقة عالية. النسخة العامة لا ترسل الأسماء أو أرقام KvK أو النطاق أو الأجر إلى iSystem. تُبنى المعاينة محليًا من الحقول التي تكتبها. اطبعها، احفظها، أغلق التبويب — لا تحتفظ الصفحة بنسخة." },
                { type: "h2", text: "متى تنتقل إلى Legal Vault" },
                { type: "ul-strong", items: [
                    { strong: "استخدم المولّد المجاني", text: "لأعمال ZZP المباشرة عندما يعرف الطرفان النطاق ويحتاجان أساسًا مكتوبًا معقولًا." },
                    { strong: "استخدم Legal Vault", text: "عندما تحتاج توقيعًا إلكترونيًا، سجل تدقيق، حفظًا لسبع سنوات، ربطًا بالفواتير، سياقًا محاسبيًا، أو نماذج متكررة للعملاء." },
                    { strong: "استخدم محاميًا", text: "عند نقل ملكية فكرية، نصيحة منظمة، بيانات حساسة، مسؤولية عالية، قانون دولي، أو أي شيء لا تريد اختباره بنموذج مجاني." },
                ] },
            ],
            serviceCta: {
                heading: "تريد النسخة المُدارة داخل iSystem؟",
                body: "يمكن لحسام إعداد سير Legal Vault حول عملية عملائك الحقيقية: النماذج، التوقيع، الحفظ، ربط الفواتير، وتسليم نظيف من الحجز إلى العقد. ثلاثون دقيقة، بلا عرض مبيعات، بالإنجليزية أو الهولندية.",
                buttonLabel: "احجز 30 دقيقة مع حسام",
            },
            howToSteps: [
                { name: "أدخل بيانات مقدم الخدمة والعميل", text: "الأسماء، المدن، أرقام KvK، رقم BTW، وتفاصيل جهة العميل." },
                { name: "صف العمل", text: "اكتب نطاق المهمة بوضوح كافٍ حتى يعرف الطرفان ما هو داخل النطاق وخارجه." },
                { name: "حدد الشروط التجارية", text: "اختر تاريخ البدء والانتهاء ومدة الإشعار وأساس الأجر ومدة السداد." },
                { name: "راجع واطبع", text: "راجع العقد الهولندي في المعاينة المباشرة ثم احفظه كـ PDF من نافذة الطباعة." },
            ],
            featureList: [
                "بند استقلالية يراعي Wet DBA",
                "مخرجات عقد خدمات باللغة الهولندية",
                "صياغة أجر مع BTW بنسبة 21٪",
                "عرض داخل المتصفح دون تسجيل",
                "معاينة مباشرة وطباعة PDF",
            ],
        },
    },
};

export function getToolCopy(slug: ToolSlug, locale: ToolLocale): ToolPageCopy {
    return TOOL_COPY[slug][locale];
}
