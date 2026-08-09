import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import type { Locale } from "@/features/templates/types";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { createIsystemCaseStudyPageData } from "@/features/public-site/isystem-public-page-seeds";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";

const COPY = {
    eyebrow: { en: "Case study — legal sector", nl: "Case study — juridische sector", ar: "دراسة حالة — القطاع القانوني" },
    headline: {
        en: "Migrating a regional law firm onto one governed workspace.",
        nl: "Een regionaal advocatenkantoor migreren naar één governed workspace.",
        ar: "نقل مكتب محاماة إقليمي إلى مساحة عمل محوكمة واحدة.",
    },
    summary: {
        en: "29 long-form English legal articles. Bilingual structure. Author profiles, internal-link graph, GDPR posture, public intake portal. One vendor, one ledger, one operator.",
        nl: "29 lange Engelstalige juridische artikelen. Tweetalige structuur. Auteursprofielen, interne-linkgraaf, GDPR-instellingen, publiek intake-portaal. Eén leverancier, één grootboek, één operator.",
        ar: "29 مقالًا قانونيًا مطوّلًا بالإنجليزية. بنية ثنائية اللغة. ملفات مؤلفين، رسم بياني للروابط الداخلية، إعدادات GDPR، بوابة استقبال عامة. مزوّد واحد، سجل واحد، مشغّل واحد.",
    },
    clientHeader: { en: "The client", nl: "De cliënt", ar: "العميل" },
    clientBody: {
        en: "A MENA-region legal client with a bilingual (Arabic + English) commercial practice serving cross-border clients. Practice areas, jurisdiction, and firm name are confidential at the client's preference; this case study describes only the structural deployment. Additional details are shared only when relevant and with the client's written permission.",
        nl: "Een juridische cliënt in de MENA-regio met een tweetalige (Arabisch + Engels) handelspraktijk voor grensoverschrijdende cliënten. Praktijkgebieden, jurisdictie en kantoornaam blijven op verzoek van de cliënt vertrouwelijk; deze case study beschrijft alleen de structurele implementatie. Aanvullende details delen we alleen wanneer dat relevant is en met schriftelijke toestemming van de cliënt.",
        ar: "عميل قانوني في منطقة الشرق الأوسط وشمال إفريقيا بممارسة تجارية ثنائية اللغة (عربية + إنجليزية) تخدم عملاء عابرين للحدود. تبقى مجالات الممارسة والاختصاص واسم المكتب طي الكتمان وفقًا لتفضيل العميل؛ تصف دراسة الحالة هذه التطبيق الهيكلي فقط. هوية العميل الكاملة ومقاييس الارتباط متاحة عند الطلب بعد مكالمة استكشاف، بإذن خطّي من العميل.",
    },
    problemHeader: { en: "The problem", nl: "Het probleem", ar: "المشكلة" },
    problemBody: {
        en: "The firm had a respectable archive of long-form legal content drafted by senior partners, sitting on a previous-generation CMS that didn't preserve internal-link structure, didn't have a real bilingual story, and required separate vendors for newsletter dispatch, intake, and SEO. Authority was being created and immediately under-leveraged: every new article was an island.",
        nl: "Het kantoor had een respectabel archief van lange juridische content geschreven door senior partners, op een vorige-generatie CMS dat geen interne-linkstructuur bewaarde, geen echt tweetalig verhaal had, en aparte leveranciers nodig had voor nieuwsbriefverzending, intake en SEO. Autoriteit werd gecreëerd en direct onderbenut: elk nieuw artikel was een eiland.",
        ar: "كان لدى المكتب أرشيف محترم من المحتوى القانوني الطويل الذي كتبه شركاء كبار، على نظام إدارة محتوى من جيل سابق لا يحفظ بنية الروابط الداخلية، ولا يمتلك قصة ثنائية اللغة حقيقية، ويتطلب مزوّدين منفصلين لإرسال النشرة البريدية والاستقبال والسيو. كانت السلطة تُبنى ولا يُستفاد منها على الفور: كل مقال جديد جزيرة منعزلة.",
    },
    systemHeader: { en: "The system deployed", nl: "Het uitgerolde systeem", ar: "النظام المُنشَر" },
    systemBullets: {
        en: [
            "Workspace provisioning with brand setup, navigation, footer, and GDPR posture configured",
            "Migration of 29 long-form English articles via custom import scripts (preserving asset references, headings, and metadata)",
            "Bilingual structure: per-article locale (EN + AR), sticky locale preference, RTL handling for Arabic, language-aware navigation",
            "Author profiles for senior partners with bylines, bio cards, and social links surfaced on the public blog",
            "Internal-link graph initialised across the firm's practice areas (kept generic at the client's preference)",
            "Public intake portal under /portal with role-gated access and consent-driven client provisioning",
            "Anti-abuse honeypot + form-start timing on every public form; role-gated mutations on the workspace",
        ],
        nl: [
            "Workspace-inrichting met merk-setup, navigatie, footer en GDPR-instellingen geconfigureerd",
            "Migratie van 29 lange Engelstalige artikelen via custom import-scripts (behoud van asset-referenties, headings en metadata)",
            "Tweetalige structuur: locale per artikel (EN + AR), sticky locale-voorkeur, RTL-handling voor Arabisch, taal-bewuste navigatie",
            "Auteursprofielen voor senior partners met bylines, bio-cards en social links op de publieke blog",
            "Interne-linkgraaf geïnitialiseerd over de praktijkgebieden van het kantoor (op verzoek van de cliënt generiek gehouden)",
            "Publiek intake-portaal onder /portal met role-gated toegang en consent-gedreven cliënt-provisioning",
            "Anti-abuse honeypot + form-start timing op elk publiek formulier; role-gated mutaties op de werkruimte",
        ],
        ar: [
            "تجهيز مساحة العمل مع إعداد العلامة والتنقّل والتذييل وإعدادات GDPR",
            "نقل 29 مقالًا مطوّلًا بالإنجليزية عبر برامج استيراد مخصصة (الحفاظ على مراجع الأصول والعناوين والبيانات الوصفية)",
            "بنية ثنائية اللغة: لغة لكل مقال (إنجليزية + عربية)، تفضيل لغة لاصق، دعم RTL للعربية، تنقّل واعٍ باللغة",
            "ملفات مؤلفين للشركاء الكبار بتوقيعات وبطاقات سيرة وروابط اجتماعية تظهر على المدوّنة العامة",
            "تهيئة رسم بياني للروابط الداخلية عبر مجالات ممارسة المكتب (مُبهَمة وفق تفضيل العميل)",
            "بوابة استقبال عامة تحت /portal بصلاحيات أدوار وتجهيز عملاء قائم على الموافقة",
            "فخّ مكافحة الإساءة + توقيت بدء النموذج على كل نموذج عام؛ تعديلات مساحة العمل بصلاحيات الأدوار",
        ],
    },
    outcomeHeader: { en: "Outcome", nl: "Resultaat", ar: "النتيجة" },
    outcomeBullets: {
        en: [
            "29 articles migrated, indexed, and rendering across the firm's bilingual website",
            "Bilingual surface live across content, navigation, and chrome — Arabic with RTL design audited",
            "Single workspace replaces what was previously a CMS + a separate intake form vendor + a separate newsletter tool",
            "Founder direct contact retained — no agency layer, no account manager, partners speak to the operator",
            "Ongoing engagement: workspace continues running, with monthly reviews and additions to the link graph",
        ],
        nl: [
            "29 artikelen gemigreerd, geïndexeerd en zichtbaar op de tweetalige website van het kantoor",
            "Tweetalige surface live over content, navigatie en chrome — Arabisch met RTL-design geaudit",
            "Eén werkruimte vervangt wat eerder een CMS + aparte intake-form-leverancier + aparte nieuwsbrieftool was",
            "Direct founder-contact behouden — geen agency-laag, geen account-manager, partners praten met de operator",
            "Doorlopend mandaat: de werkruimte blijft draaien, met maandelijkse reviews en uitbreidingen op de linkgraaf",
        ],
        ar: [
            "29 مقالًا منقولًا ومفهرسًا ومنشورًا على موقع المكتب ثنائي اللغة",
            "سطح ثنائي اللغة حيٌّ عبر المحتوى والتنقّل والإطار — العربية مع تصميم RTL مدقَّق",
            "مساحة عمل واحدة تحلّ محل ما كان سابقًا CMS + مزوّد نموذج استقبال منفصل + أداة نشرة بريدية منفصلة",
            "تواصل مباشر مع المؤسس مُحتفَظ به — بلا طبقة وكالة، بلا مدير حسابات، الشركاء يتحدثون مع المشغّل",
            "ارتباط مستمر: مساحة العمل تواصل العمل بمراجعات شهرية وإضافات إلى رسم الروابط",
        ],
    },
    transparencyHeader: {
        en: "What this case study deliberately doesn't claim",
        nl: "Wat deze case study bewust niet claimt",
        ar: "ما لا تدّعيه دراسة الحالة عمدًا",
    },
    transparencyBody: {
        en: "We do not publish revenue impact, organic-traffic deltas, or specific lead-volume changes for this client because those metrics belong to the firm and we will not claim attribution we cannot verify. The documented outcome is structural: 29 articles, a bilingual workspace, an internal-link graph, and a governed publishing process on one platform. Additional details remain subject to the client's written permission.",
        nl: "We publiceren geen omzetimpact, organische-verkeersverschillen of specifieke veranderingen in leadvolume, omdat die cijfers aan het kantoor toebehoren en we geen attributie claimen die we niet kunnen verifiëren. Het gedocumenteerde resultaat is structureel: 29 artikelen, een tweetalige werkomgeving, een interne-linkgrafiek en een beheerst publicatieproces op één platform. Aanvullende details blijven afhankelijk van schriftelijke toestemming van de cliënt.",
        ar: "لا نَنشُر تأثيرَ الإيرادات أو فروقات حركة المرور العضوية أو تغييرات حجم العملاء المحتملين المحددة لهذا العميل لأن (أ) تلك المقاييس ملك للمكتب و(ب) لن نطالب بنسبٍ لا يمكننا تدقيقه. النتيجة القابلة للتحقق هي هيكلية: 29 مقالًا، مساحة عمل ثنائية اللغة، رسم روابط، موقف حوكمة، الكل على منصة واحدة. الادعاءات التسويقية التي لا يمكننا إثباتها من سجل مساحة العمل أو المستودع لا تدخل في دراسة الحالة — هذا الانضباط جزء من الخندق التنافسي. دراسة الحالة الكاملة، بما فيها اسم العميل والمقاييس، متاحة عند الطلب بعد مكالمة استكشاف، بإذن خطّي من العميل.",
    },
    cta: {
        en: "Plan a 30-min call with Hossam — your firm's deployment will look different from this one",
        nl: "Plan een gesprek van 30 minuten met Hossam — de deployment voor uw kantoor wordt anders dan deze",
        ar: "احجز مكالمة 30 دقيقة مع حسام — تطبيق مكتبك سيختلف عن هذا",
    },
};

function pick<T extends { en: string; nl: string; ar: string }>(field: T, locale: Locale): string {
    if (locale === "nl") return field.nl;
    if (locale === "ar") return field.ar;
    return field.en;
}

const TITLE: Record<Locale, string> = {
    en: "Case study — legal firm migration",
    nl: "Case study — migratie advocatenkantoor",
    ar: "دراسة حالة — هجرة مكتب محاماة",
};

const DESCRIPTION: Record<Locale, string> = {
    en: "29 long-form legal articles, bilingual structure, internal-link graph, GDPR posture, public intake portal — migrated onto one governed iSystem workspace. Anonymized regional law firm.",
    nl: "29 lange juridische artikelen, tweetalige structuur, interne-linkgraaf, GDPR-instellingen, publiek intake-portaal — gemigreerd naar één governed iSystem-werkruimte. Geanonimiseerd regionaal advocatenkantoor.",
    ar: "29 مقالًا قانونيًا مطوّلًا، بنية ثنائية اللغة، رسم بياني للروابط الداخلية، إعدادات GDPR، بوابة استقبال عامة — نُقلت إلى مساحة عمل iSystem محوكمة واحدة. مكتب محاماة إقليمي مجهول الاسم.",
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, settings, locale } = await getActiveTemplate();
    if (config.id !== "isystem-agency") {
        return { robots: { index: false, follow: false } };
    }
    const resolvedLocale = (locale ?? "en") as Locale;
    const metadata = buildSecondaryPageMetadata({
        path: "/case-studies/legal-firm",
        title: TITLE[resolvedLocale],
        description: DESCRIPTION[resolvedLocale] || pickSiteDescription(settings, resolvedLocale),
        locale: resolvedLocale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        ogType: "article",
        localized: true,
    });
    return config.id === "isystem-agency"
        ? { ...metadata, robots: { index: false, follow: true } }
        : metadata;
}

export default async function LegalCaseStudyPage() {
    const { config, settings, locale: rawLocale } = await getActiveTemplate();
    if (config.id !== "isystem-agency") notFound();
    const locale = (rawLocale ?? "en") as Locale;
    const isRtl = locale === "ar";

    if (isPublicV2Route(config.id, settings.publicSiteRenderer, "case-study")) {
        const data = createIsystemCaseStudyPageData();
        data.root.props.locale = locale;
        return (
            <PublicPageRenderer
                definition={resolvePublicPageDefinition("/case-studies/legal-firm")!}
                data={data}
                locale={locale}
                mode="published"
            />
        );
    }

    return (
        <main
            dir={isRtl ? "rtl" : "ltr"}
            className="min-h-screen pb-20 [background:var(--template-surface-canvas)] text-[var(--template-text-primary)]"
        >
            <section className="container mx-auto max-w-4xl px-4 pt-16 md:px-6 md:pt-24">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--template-text-accent)]">
                    {pick(COPY.eyebrow, locale)}
                </p>
                <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-5xl">{pick(COPY.headline, locale)}</h1>
                <p className="text-lg leading-relaxed text-[var(--template-text-secondary)]">{pick(COPY.summary, locale)}</p>
            </section>

            <article className="container mx-auto mt-16 max-w-4xl space-y-12 px-4 md:px-6">
                <section>
                    <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pick(COPY.clientHeader, locale)}</h2>
                    <p className="text-[var(--template-text-secondary)]">{pick(COPY.clientBody, locale)}</p>
                </section>

                <section>
                    <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pick(COPY.problemHeader, locale)}</h2>
                    <p className="text-[var(--template-text-secondary)]">{pick(COPY.problemBody, locale)}</p>
                </section>

                <section>
                    <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pick(COPY.systemHeader, locale)}</h2>
                    <ul className="space-y-2 text-[var(--template-text-secondary)]">
                        {COPY.systemBullets[locale].map((bullet, idx) => (
                            <li key={idx} className="flex gap-3">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--template-text-accent)]" />
                                <span>{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h2 className="mb-3 text-xl font-semibold text-[var(--template-text-accent)]">{pick(COPY.outcomeHeader, locale)}</h2>
                    <ul className="space-y-2 text-[var(--template-text-secondary)]">
                        {COPY.outcomeBullets[locale].map((bullet, idx) => (
                            <li key={idx} className="flex gap-3">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-300/80" />
                                <span>{bullet}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="rounded-2xl border border-amber-300/30 bg-white/[0.03] p-6">
                    <h2 className="mb-3 text-base font-semibold text-amber-200">{pick(COPY.transparencyHeader, locale)}</h2>
                    <p className="text-sm text-[var(--template-text-secondary)]">{pick(COPY.transparencyBody, locale)}</p>
                </section>
            </article>

            <section className="container mx-auto mt-16 max-w-4xl px-4 md:px-6">
                <Link
                    href={localizeHref(locale, "/contact")}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--template-text-accent)] px-6 py-3 text-sm font-semibold text-slate-900 transition hover:scale-[1.02]"
                >
                    {pick(COPY.cta, locale)}
                    <span aria-hidden>{isRtl ? "←" : "→"}</span>
                </Link>
            </section>
        </main>
    );
}
