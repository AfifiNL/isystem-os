import React from "react";
import Image from "next/image";
import {
    BookOpenCheck,
    BriefcaseBusiness,
    CalendarCheck2,
    CheckCircle2,
    FileCheck2,
    Gauge,
    GitBranch,
    Globe2,
    Handshake,
    Layers3,
    type LucideIcon,
    Network,
    PenLine,
    Radar,
    Scale,
    Search,
    ShieldCheck,
    Sparkles,
    Waypoints,
} from "lucide-react";
import type { Locale } from "@/features/templates/types";

const styles = {
    frame: "isystem-hero-visual-frame",
    window: "isystem-hero-visual-window",
    chrome: "isystem-hero-visual-chrome",
    chromeDots: "isystem-hero-visual-chrome-dots",
    liveStatus: "isystem-hero-visual-live-status",
    workspace: "isystem-hero-visual-workspace",
    summary: "isystem-hero-visual-summary",
    map: "isystem-hero-visual-map",
    mapLines: "isystem-hero-visual-map-lines",
    core: "isystem-hero-visual-core",
    nodes: "isystem-hero-visual-nodes",
    nodeIcon: "isystem-hero-visual-node-icon",
    statusBar: "isystem-hero-visual-status-bar",
} as const;

export type PublicHeroVisualVariant =
    | "operating-system"
    | "services"
    | "systems"
    | "business-spine"
    | "legal"
    | "research"
    | "fit"
    | "proof"
    | "tools"
    | "audit"
    | "newsletter"
    | "booking"
    | "videos";

interface VisualNode {
    label: string;
    meta: string;
    icon: LucideIcon;
}

interface VisualCopy {
    layout: "orbit" | "flow" | "stack";
    eyebrow: string;
    title: string;
    description: string;
    coreLabel: string;
    brandCore?: boolean;
    status: string;
    nodes: VisualNode[];
}

interface PublicPageHeroVisualProps {
    locale: Locale;
    variant: PublicHeroVisualVariant;
    evidenceTitle?: string;
    evidenceDescription?: string;
    density?: "default" | "compact" | "home";
    brandName?: string;
    brandLogoUrl?: string;
}

function localized(locale: Locale, en: string, nl: string, ar: string): string {
    if (locale === "nl") return nl;
    if (locale === "ar") return ar;
    return en;
}

export function resolvePublicHeroVisualVariant(blockId: string): PublicHeroVisualVariant {
    if (blockId.includes("business-spine")) return "business-spine";
    if (blockId.includes("legal-sector")) return "legal";
    if (blockId.includes("services")) return "services";
    if (blockId.includes("systems")) return "systems";
    if (blockId.includes("about")) return "research";
    if (blockId.includes("contact")) return "fit";
    if (blockId.includes("proof") || blockId.includes("case")) return "proof";
    return "operating-system";
}

function getVisualCopy(
    variant: PublicHeroVisualVariant,
    locale: Locale,
    evidenceTitle?: string,
    evidenceDescription?: string,
): VisualCopy {
    if (variant === "services") {
        return {
            layout: "stack",
            eyebrow: localized(locale, "Operating shape", "Operationele vorm", "شكل التشغيل"),
            title: localized(locale, "Map the work before choosing the build.", "Breng het werk in kaart vóór de bouwkeuze.", "ارسم العمل قبل اختيار البناء."),
            description: localized(locale, "Fit, blueprint, and managed operation stay visibly connected.", "Fit, blueprint en beheerd beheer blijven zichtbaar verbonden.", "تبقى الملاءمة والمخطط والتشغيل المُدار مترابطة بوضوح."),
            coreLabel: localized(locale, "One scope", "Eén scope", "نطاق واحد"),
            status: localized(locale, "Decision path ready", "Beslispad gereed", "مسار القرار جاهز"),
            nodes: [
                { label: localized(locale, "Fit", "Fit", "الملاءمة"), meta: localized(locale, "Qualify the need", "Beoordeel de vraag", "تأهيل الحاجة"), icon: Handshake },
                { label: localized(locale, "Blueprint", "Blueprint", "المخطط"), meta: localized(locale, "Order the system", "Orden het systeem", "ترتيب النظام"), icon: Layers3 },
                { label: localized(locale, "Operate", "Beheer", "التشغيل"), meta: localized(locale, "Own the cadence", "Borg het ritme", "امتلاك الإيقاع"), icon: Gauge },
            ],
        };
    }

    if (variant === "systems") {
        return {
            layout: "orbit",
            eyebrow: localized(locale, "System overview", "Systeemoverzicht", "نظرة عامة على النظام"),
            title: localized(locale, "Five systems share one accountable record.", "Vijf systemen delen één verantwoordelijk dossier.", "خمسة أنظمة تشترك في سجل واحد واضح المسؤولية."),
            description: localized(locale, "Every signal has an owner, a boundary, and a visible next decision.", "Elk signaal heeft een eigenaar, een grens en een zichtbare volgende beslissing.", "لكل إشارة مالك وحدود وقرار تالٍ ظاهر."),
            coreLabel: "",
            brandCore: true,
            status: localized(locale, "Operating layer connected", "Operationele laag verbonden", "طبقة التشغيل متصلة"),
            nodes: [
                { label: localized(locale, "Presence", "Aanwezigheid", "الحضور"), meta: localized(locale, "Convert", "Converteer", "التحويل"), icon: Globe2 },
                { label: localized(locale, "Authority", "Autoriteit", "الخبرة"), meta: localized(locale, "Publish", "Publiceer", "النشر"), icon: PenLine },
                { label: localized(locale, "Growth", "Groei", "النمو"), meta: localized(locale, "Discover", "Vind", "الاكتشاف"), icon: Search },
                { label: localized(locale, "Operations", "Operatie", "العمليات"), meta: localized(locale, "Deliver", "Lever", "التنفيذ"), icon: BriefcaseBusiness },
                { label: localized(locale, "Control", "Controle", "التحكم"), meta: localized(locale, "Govern", "Beheers", "الحوكمة"), icon: ShieldCheck },
            ],
        };
    }

    if (variant === "business-spine") {
        return {
            layout: "flow",
            eyebrow: localized(locale, "Customer-to-delivery record", "Klant-tot-leveringsdossier", "سجل العميل حتى التنفيذ"),
            title: localized(locale, "Context travels with the work.", "Context reist mee met het werk.", "ينتقل السياق مع العمل."),
            description: localized(locale, "The customer record continues from the first enquiry to proof of delivery.", "Het klantdossier loopt door van de eerste aanvraag tot leveringsbewijs.", "يستمر سجل العميل من أول استفسار حتى دليل التنفيذ."),
            coreLabel: localized(locale, "Business Spine", "Business Spine", "العمود التشغيلي"),
            status: localized(locale, "No orphaned handoff", "Geen verweesde overdracht", "لا تسليم بلا مالك"),
            nodes: [
                { label: localized(locale, "Enquiry", "Aanvraag", "الاستفسار"), meta: localized(locale, "Origin", "Herkomst", "المصدر"), icon: Radar },
                { label: localized(locale, "Decision", "Besluit", "القرار"), meta: localized(locale, "Quote", "Offerte", "العرض"), icon: FileCheck2 },
                { label: localized(locale, "Owned work", "Eigen werk", "عمل مملوك"), meta: localized(locale, "Workflow", "Workflow", "سير العمل"), icon: GitBranch },
                { label: localized(locale, "Client view", "Klantbeeld", "عرض العميل"), meta: localized(locale, "Progress", "Voortgang", "التقدم"), icon: CalendarCheck2 },
                { label: localized(locale, "Record", "Dossier", "السجل"), meta: localized(locale, "Evidence", "Bewijs", "الدليل"), icon: BookOpenCheck },
            ],
        };
    }

    if (variant === "legal") {
        return {
            layout: "flow",
            eyebrow: localized(locale, "Legal client journey", "Juridische cliëntreis", "رحلة العميل القانونية"),
            title: localized(locale, "Trust travels with the next decision.", "Vertrouwen reist mee met de volgende beslissing.", "تنتقل الثقة مع القرار التالي."),
            description: localized(locale, "Expertise, enquiries, handovers, and governed records stay connected.", "Expertise, aanvragen, overdrachten en beheerde dossiers blijven verbonden.", "تبقى الخبرة والاستفسارات وعمليات التسليم والسجلات المحكومة مترابطة."),
            coreLabel: localized(locale, "One accountable scope", "Eén verantwoordelijke scope", "نطاق واحد واضح المسؤولية"),
            status: localized(locale, "Review points visible", "Reviewmomenten zichtbaar", "نقاط المراجعة ظاهرة"),
            nodes: [
                { label: localized(locale, "Expertise", "Expertise", "الخبرة"), meta: localized(locale, "Publish", "Publiceer", "النشر"), icon: Scale },
                { label: localized(locale, "Enquiry", "Aanvraag", "الاستفسار"), meta: localized(locale, "Qualify", "Kwalificeer", "التأهيل"), icon: Radar },
                { label: localized(locale, "Handover", "Overdracht", "التسليم"), meta: localized(locale, "Own", "Wijs toe", "التملك"), icon: Handshake },
                { label: localized(locale, "Record", "Dossier", "السجل"), meta: localized(locale, "Govern", "Beheers", "الحوكمة"), icon: ShieldCheck },
            ],
        };
    }

    if (variant === "research") {
        return {
            layout: "stack",
            eyebrow: localized(locale, "Founder-led by design", "Founder-led vanuit het ontwerp", "يقوده المؤسس حسب التصميم"),
            title: localized(locale, "Experience becomes research. Research becomes an operating system.", "Ervaring wordt onderzoek. Onderzoek wordt een operationeel systeem.", "تتحول الخبرة إلى بحث، والبحث إلى نظام تشغيل."),
            description: localized(locale, "The implementation stays close to the evidence and to the person accountable for delivery.", "De uitvoering blijft dicht bij het bewijs en bij degene die verantwoordelijk is voor levering.", "يبقى التنفيذ قريبًا من الدليل ومن الشخص المسؤول عن التسليم."),
            coreLabel: localized(locale, "One accountable founder", "Eén verantwoordelijke founder", "مؤسس واحد مسؤول"),
            status: localized(locale, "Evidence before automation", "Bewijs vóór automatisering", "الدليل قبل الأتمتة"),
            nodes: [
                { label: localized(locale, "Operate", "Uitvoeren", "التشغيل"), meta: localized(locale, "Field experience", "Praktijkervaring", "خبرة ميدانية"), icon: BriefcaseBusiness },
                { label: localized(locale, "Research", "Onderzoeken", "البحث"), meta: localized(locale, "Dutch SMEs", "Nederlands mkb", "الشركات الهولندية"), icon: Search },
                { label: localized(locale, "Build", "Bouwen", "البناء"), meta: localized(locale, "Governed system", "Beheerst systeem", "نظام محكوم"), icon: Sparkles },
            ],
        };
    }

    if (variant === "fit") {
        return {
            layout: "flow",
            eyebrow: localized(locale, "Fit before proposal", "Fit vóór voorstel", "الملاءمة قبل العرض"),
            title: localized(locale, "One operating question determines the next step.", "Eén operationele vraag bepaalt de volgende stap.", "سؤال تشغيلي واحد يحدد الخطوة التالية."),
            description: localized(locale, "The call qualifies the need; deeper mapping happens only when it is warranted.", "Het gesprek kwalificeert de vraag; diepere analyse volgt alleen wanneer dat nodig is.", "تؤهل المكالمة الحاجة، ولا يحدث التخطيط الأعمق إلا عند الحاجة."),
            coreLabel: localized(locale, "Clear next step", "Heldere volgende stap", "خطوة تالية واضحة"),
            status: localized(locale, "No free-audit theatre", "Geen gratis-audit-theater", "لا استعراض لتدقيق مجاني"),
            nodes: [
                { label: localized(locale, "Outcome", "Doel", "النتيجة"), meta: localized(locale, "What must change?", "Wat moet veranderen?", "ما الذي يجب تغييره؟"), icon: Radar },
                { label: localized(locale, "Current state", "Huidige situatie", "الوضع الحالي"), meta: localized(locale, "Where does clarity break?", "Waar breekt helderheid?", "أين ينقطع الوضوح؟"), icon: Network },
                { label: localized(locale, "Fit", "Fit", "الملاءمة"), meta: localized(locale, "Is this responsible?", "Is dit verantwoord?", "هل هذا خيار مسؤول؟"), icon: Handshake },
                { label: localized(locale, "Next step", "Volgende stap", "الخطوة التالية"), meta: localized(locale, "Call or blueprint", "Call of blueprint", "مكالمة أو مخطط"), icon: CheckCircle2 },
            ],
        };
    }

    if (variant === "proof") {
        return {
            layout: "stack",
            eyebrow: localized(locale, "Evidence standard", "Bewijsstandaard", "معيار الدليل"),
            title: localized(locale, "Proof stays attached to its source and limitation.", "Bewijs blijft verbonden aan bron en beperking.", "يبقى الدليل مرتبطًا بمصدره وحدوده."),
            description: localized(locale, "No anonymous claim is promoted beyond what the dated record can support.", "Geen anonieme claim gaat verder dan wat het gedateerde dossier ondersteunt.", "لا يُروّج لأي ادعاء مجهول بما يتجاوز ما يدعمه السجل المؤرخ."),
            coreLabel: localized(locale, "Reviewable record", "Controleerbaar dossier", "سجل قابل للمراجعة"),
            status: localized(locale, "Permission required", "Toestemming vereist", "الإذن مطلوب"),
            nodes: [
                { label: localized(locale, "Source", "Bron", "المصدر"), meta: localized(locale, "Named and dated", "Benoemd en gedateerd", "مُسمّى ومؤرخ"), icon: FileCheck2 },
                { label: localized(locale, "Status", "Status", "الحالة"), meta: localized(locale, "Current, not implied", "Actueel, niet gesuggereerd", "حالية وليست ضمنية"), icon: Gauge },
                { label: localized(locale, "Limitation", "Beperking", "الحدود"), meta: localized(locale, "Visible to the buyer", "Zichtbaar voor de koper", "مرئية للمشتري"), icon: ShieldCheck },
            ],
        };
    }

    if (variant === "tools") {
        return {
            layout: "orbit",
            eyebrow: localized(locale, "Diagnostic path", "Diagnosepad", "مسار التشخيص"),
            title: localized(locale, "Turn one operating question into a reviewable next move.", "Maak van één operationele vraag een controleerbare volgende stap.", "حوّل سؤالًا تشغيليًا واحدًا إلى خطوة تالية قابلة للمراجعة."),
            description: localized(locale, "Inputs become evidence, a finding, and a bounded recommendation—not an opaque AI answer.", "Input wordt bewijs, een bevinding en een begrensd advies — geen ondoorzichtig AI-antwoord.", "تتحول المدخلات إلى دليل ونتيجة وتوصية محددة، لا إلى إجابة ذكاء اصطناعي غامضة."),
            coreLabel: localized(locale, "One decision", "Eén besluit", "قرار واحد"),
            status: localized(locale, "Source-backed output", "Uitkomst met bronnen", "نتيجة مدعومة بالمصادر"),
            nodes: [
                { label: localized(locale, "Question", "Vraag", "السؤال"), meta: localized(locale, "Operating question", "Operationele vraag", "سؤال التشغيل"), icon: Radar },
                { label: localized(locale, "Inputs", "Input", "المدخلات"), meta: localized(locale, "6–10 signals", "6–10 signalen", "٦–١٠ إشارات"), icon: PenLine },
                { label: localized(locale, "Evidence", "Bewijs", "الدليل"), meta: localized(locale, "Named source", "Benoemde bron", "مصدر مُسمّى"), icon: FileCheck2 },
                { label: localized(locale, "Finding", "Bevinding", "النتيجة"), meta: localized(locale, "Visible logic", "Zichtbare logica", "منطق ظاهر"), icon: Search },
                { label: localized(locale, "Next move", "Volgende stap", "الخطوة التالية"), meta: localized(locale, "Bounded action", "Begrensde actie", "إجراء محدد"), icon: Waypoints },
            ],
        };
    }

    if (variant === "audit") {
        return {
            layout: "orbit",
            eyebrow: localized(locale, "Fragmentation model", "Fragmentatiemodel", "نموذج التجزؤ"),
            title: localized(locale, "See where software spend and manual work compound.", "Zie waar softwarekosten en handwerk zich opstapelen.", "شاهد أين تتراكم تكاليف البرامج والعمل اليدوي."),
            description: localized(locale, "The audit keeps the assumptions beside the projected savings and recovered capacity.", "De audit houdt aannames naast de verwachte besparing en teruggewonnen capaciteit.", "يبقي التدقيق الافتراضات بجانب الوفورات المتوقعة والقدرة المستعادة."),
            coreLabel: localized(locale, "Annual drag", "Jaarlijkse druk", "العبء السنوي"),
            status: localized(locale, "Assumptions stay visible", "Aannames blijven zichtbaar", "الافتراضات تبقى ظاهرة"),
            nodes: [
                { label: localized(locale, "SaaS spend", "SaaS-kosten", "تكلفة SaaS"), meta: localized(locale, "Four pillars", "Vier pijlers", "أربع ركائز"), icon: Layers3 },
                { label: localized(locale, "Manual hours", "Handmatige uren", "الساعات اليدوية"), meta: localized(locale, "Weekly load", "Wekelijkse last", "العبء الأسبوعي"), icon: Gauge },
                { label: localized(locale, "Overlap", "Overlap", "التداخل"), meta: localized(locale, "Fragmentation", "Fragmentatie", "التجزؤ"), icon: Network },
                { label: localized(locale, "Savings", "Besparing", "الوفورات"), meta: localized(locale, "Software removed", "Software vervalt", "برامج مستغنى عنها"), icon: CheckCircle2 },
                { label: localized(locale, "Capacity", "Capaciteit", "القدرة"), meta: localized(locale, "Hours returned", "Uren terug", "ساعات مستعادة"), icon: CalendarCheck2 },
            ],
        };
    }

    if (variant === "newsletter") {
        return {
            layout: "flow",
            eyebrow: localized(locale, "Inside each brief", "In elke brief", "داخل كل موجز"),
            title: localized(locale, "A signal becomes useful only when the source and operating move travel with it.", "Een signaal wordt pas bruikbaar als bron en operationele stap meereizen.", "لا تصبح الإشارة مفيدة إلا عندما يرافقها المصدر والخطوة التشغيلية."),
            description: localized(locale, "Two concise editions each month: observation, evidence, interpretation, action.", "Twee compacte edities per maand: observatie, bewijs, duiding, actie.", "عددان موجزان كل شهر: ملاحظة، دليل، تفسير، إجراء."),
            coreLabel: localized(locale, "Systems Brief", "Systems Brief", "موجز الأنظمة"),
            status: localized(locale, "Twice monthly · source-backed", "Tweemaal per maand · met bronnen", "مرتان شهريًا · مدعوم بالمصادر"),
            nodes: [
                { label: localized(locale, "Observe", "Observeer", "الملاحظة"), meta: localized(locale, "Field signal", "Praktijksignaal", "إشارة ميدانية"), icon: Radar },
                { label: localized(locale, "Verify", "Verifieer", "التحقق"), meta: localized(locale, "Named source", "Benoemde bron", "مصدر مُسمّى"), icon: FileCheck2 },
                { label: localized(locale, "Interpret", "Duid", "التفسير"), meta: localized(locale, "Why it matters", "Waarom het telt", "لماذا يهم"), icon: Search },
                { label: localized(locale, "Apply", "Pas toe", "التطبيق"), meta: localized(locale, "Operating move", "Operationele stap", "خطوة تشغيلية"), icon: Waypoints },
            ],
        };
    }

    if (variant === "booking") {
        return {
            layout: "stack",
            eyebrow: localized(locale, "Decision path", "Beslispad", "مسار القرار"),
            title: localized(locale, "Qualify first. Map only when the situation warrants it.", "Kwalificeer eerst. Breng pas in kaart als de situatie dat vraagt.", "أهّل أولًا، ولا ترسم الخريطة إلا عندما تستدعي الحالة ذلك."),
            description: localized(locale, "The free call establishes fit; the paid blueprint turns complexity into a written scope.", "Het gratis gesprek bepaalt de fit; de betaalde blueprint maakt complexiteit tot een geschreven scope.", "تحدد المكالمة المجانية الملاءمة، ويحوّل المخطط المدفوع التعقيد إلى نطاق مكتوب."),
            coreLabel: localized(locale, "Clear scope", "Heldere scope", "نطاق واضح"),
            status: localized(locale, "No free-audit theatre", "Geen gratis-audit-theater", "لا استعراض لتدقيق مجاني"),
            nodes: [
                { label: localized(locale, "Fit Call", "Fit Call", "مكالمة الملاءمة"), meta: localized(locale, "30 min · qualify", "30 min · kwalificeren", "٣٠ دقيقة · تأهيل"), icon: Handshake },
                { label: localized(locale, "Blueprint", "Blueprint", "المخطط"), meta: localized(locale, "90 min · map", "90 min · kaart", "٩٠ دقيقة · خريطة"), icon: Layers3 },
                { label: localized(locale, "Proposal", "Voorstel", "العرض"), meta: localized(locale, "Fixed scope", "Vaste scope", "نطاق ثابت"), icon: FileCheck2 },
            ],
        };
    }

    if (variant === "videos") {
        return {
            layout: "flow",
            eyebrow: localized(locale, "Screen-by-screen proof", "Scherm-voor-scherm bewijs", "دليل شاشة بشاشة"),
            title: localized(locale, "Walk through the operating record, not a highlight reel.", "Loop door het operationele dossier, niet door een promofilm.", "تجوّل في سجل التشغيل، لا في مقطع دعائي."),
            description: localized(locale, "Each walkthrough follows one workflow from signal to evidence and the next decision.", "Elke rondleiding volgt één workflow van signaal naar bewijs en de volgende beslissing.", "تتبع كل جولة سير عمل واحدًا من الإشارة إلى الدليل والقرار التالي."),
            coreLabel: localized(locale, "Workspace tour", "Workspace-tour", "جولة مساحة العمل"),
            status: localized(locale, "Demos, not promos", "Demo's, geen promo's", "عروض توضيحية لا دعائية"),
            nodes: [
                { label: localized(locale, "Signal", "Signaal", "الإشارة"), meta: localized(locale, "What changed", "Wat veranderde", "ما الذي تغيّر"), icon: Radar },
                { label: localized(locale, "Workflow", "Workflow", "سير العمل"), meta: localized(locale, "Who owns it", "Wie is eigenaar", "من يملكه"), icon: GitBranch },
                { label: localized(locale, "Evidence", "Bewijs", "الدليل"), meta: localized(locale, "What was recorded", "Wat is vastgelegd", "ما تم تسجيله"), icon: BookOpenCheck },
                { label: localized(locale, "Decision", "Besluit", "القرار"), meta: localized(locale, "What happens next", "Wat volgt", "ماذا يحدث بعد ذلك"), icon: Waypoints },
            ],
        };
    }

    return {
        layout: "orbit",
        eyebrow: localized(locale, "The operating view", "Het operationele overzicht", "عرض التشغيل"),
        title: evidenceTitle || localized(locale, "Can the next buyer and the next delivery step see the same system?", "Zien de volgende koper en leveringsstap hetzelfde systeem?", "هل يرى المشتري التالي وخطوة التنفيذ التالية النظام نفسه؟"),
        description: evidenceDescription || localized(locale, "Public presence, decisions, owned work, and commercial records stay connected.", "Publieke aanwezigheid, besluiten, eigen werk en commerciële dossiers blijven verbonden.", "يبقى الحضور العام والقرارات والعمل المملوك والسجلات التجارية مترابطة."),
        coreLabel: "",
        brandCore: true,
        status: localized(locale, "Operating layer live", "Operationele laag actief", "طبقة التشغيل فعّالة"),
        nodes: [
            { label: localized(locale, "Presence", "Aanwezigheid", "الحضور"), meta: localized(locale, "Buyer signal", "Kopersignaal", "إشارة المشتري"), icon: Globe2 },
            { label: localized(locale, "Evidence", "Bewijs", "الدليل"), meta: localized(locale, "Reviewed", "Beoordeeld", "تمت المراجعة"), icon: FileCheck2 },
            { label: localized(locale, "Decision", "Besluit", "القرار"), meta: localized(locale, "Owned next step", "Eigen volgende stap", "خطوة تالية مملوكة"), icon: Waypoints },
            { label: localized(locale, "Delivery", "Levering", "التنفيذ"), meta: localized(locale, "Visible progress", "Zichtbare voortgang", "تقدم ظاهر"), icon: BriefcaseBusiness },
            { label: localized(locale, "Control", "Controle", "التحكم"), meta: localized(locale, "Commercial record", "Commercieel dossier", "سجل تجاري"), icon: ShieldCheck },
        ],
    };
}

export function PublicPageHeroVisual({
    locale,
    variant,
    evidenceTitle,
    evidenceDescription,
    density = "default",
    brandName = "Workspace",
    brandLogoUrl,
}: PublicPageHeroVisualProps) {
    const copy = getVisualCopy(variant, locale, evidenceTitle, evidenceDescription);
    const resolvedBrandName = brandName.trim() || "Workspace";
    const safeBrandLogoUrl = brandLogoUrl?.startsWith("/") && !brandLogoUrl.startsWith("//")
        ? brandLogoUrl
        : undefined;

    return (
        <figure
            className={styles.frame}
            data-layout={copy.layout}
            data-density={density}
            data-node-count={copy.nodes.length}
            data-public-visual
            data-public-visual-variant={variant}
        >
            <div className={styles.window}>
                <div className={styles.chrome} aria-hidden="true">
                    <span className={styles.chromeDots}><i /><i /><i /></span>
                    <span>{resolvedBrandName} · {localized(locale, "operating view", "operationeel overzicht", "عرض التشغيل")}</span>
                    <span className={styles.liveStatus}><i />{localized(locale, "Live", "Actief", "فعّال")}</span>
                </div>
                <div className={styles.workspace}>
                    <div className={styles.summary} data-public-visual-node>
                        <p>{copy.eyebrow}</p>
                        <strong>{copy.title}</strong>
                        <span>{copy.description}</span>
                    </div>
                    <div className={styles.map}>
                        <svg className={styles.mapLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            {copy.layout === "orbit" ? (
                                <>
                                    <circle data-public-visual-path cx="50" cy="50" r="30" />
                                    <path data-public-visual-path d="M50 50 L50 8 M50 50 L91 38 M50 50 L75 89 M50 50 L25 89 M50 50 L9 38" />
                                </>
                            ) : copy.layout === "flow" ? (
                                <path data-public-visual-path d="M5 50 C22 50 24 50 33 50 S50 50 58 50 S75 50 95 50" />
                            ) : (
                                <path data-public-visual-path d="M50 4 C50 20 24 22 24 38 S76 56 76 70 S50 84 50 96" />
                            )}
                        </svg>
                        <div className={styles.core} data-public-visual-node>
                            {copy.brandCore && safeBrandLogoUrl ? (
                                <Image
                                    src={safeBrandLogoUrl}
                                    alt={resolvedBrandName}
                                    width={93}
                                    height={45}
                                    aria-hidden="true"
                                />
                            ) : (
                                <>
                                    <Network aria-hidden="true" />
                                    <span>{copy.coreLabel || resolvedBrandName}</span>
                                </>
                            )}
                        </div>
                        <ol className={styles.nodes}>
                            {copy.nodes.map((node) => {
                                const Icon = node.icon;
                                return (
                                    <li data-public-visual-node key={`${node.label}-${node.meta}`}>
                                        <span className={styles.nodeIcon}><Icon aria-hidden="true" /></span>
                                        <span><strong>{node.label}</strong><small>{node.meta}</small></span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>
                <div className={styles.statusBar}>
                    <span><CheckCircle2 aria-hidden="true" />{copy.status}</span>
                    <span>{localized(locale, "Owner · evidence · next decision", "Eigenaar · bewijs · volgende beslissing", "المالك · الدليل · القرار التالي")}</span>
                </div>
            </div>
            <figcaption className="sr-only">{copy.title} {copy.description}</figcaption>
        </figure>
    );
}
