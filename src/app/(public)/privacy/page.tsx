import type { Metadata } from "next";
import { headers } from "next/headers";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSiteSettings } from "@/features/templates/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { DEFAULT_LOCALE, LOCALE_HEADER_KEY, isSupportedLocale } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported: Locale = locale === "nl" || locale === "ar" ? locale : "en";
    const c = COPY[supported];
    return buildSecondaryPageMetadata({
        path: "/privacy",
        title: c.eyebrow,
        description: c.intro(settings.siteName, settings.siteDomain),
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

const COPY: Record<Locale, {
    eyebrow: string;
    title: (siteName: string) => string;
    intro: (siteName: string, siteDomain: string) => string;
    s1Title: string;
    s1Body: string;
    s2Title: string;
    s2Body: string;
    s3Title: string;
    s3Body: (siteName: string) => string;
    s4Title: string;
    s4Body: string;
    s5Title: string;
    s5Body: string;
    s6Title: string;
    s6Body: string;
    s7Title: string;
    s7Body: (email: string) => React.ReactNode;
}> = {
    en: {
        eyebrow: "Privacy Policy",
        title: (s) => `Privacy Policy for ${s}`,
        intro: (s, d) => `This Privacy Policy explains how ${s} collects, uses, stores, and protects personal data submitted through ${d} and related business communications.`,
        s1Title: "1. What We Collect",
        s1Body: "We may collect personal and business information that you voluntarily provide to us, including your name, company name, email address, phone number, project details, and inquiry notes when you submit a contact request.",
        s2Title: "2. How We Use Your Information",
        s2Body: "We use your information to respond to inquiries, prepare service proposals, communicate with you about digital systems, automation, consultancy, or implementation support, improve our website experience, and maintain internal records of business requests.",
        s3Title: "3. Legal Basis",
        s3Body: (s) => `We process personal data when necessary to respond to your request, pursue legitimate business interests, comply with legal obligations, or prepare contractual discussions related to ${s} services.`,
        s4Title: "4. Storage and Security",
        s4Body: "Inquiry submissions are stored in secure business systems and protected through reasonable technical and organizational safeguards. Access is restricted to authorized personnel who need the information to process your inquiry.",
        s5Title: "5. Sharing of Data",
        s5Body: "We do not sell your personal data. We may share limited information with trusted service providers involved in website hosting, secure data storage, email delivery, or business operations, only when necessary for service delivery or legal compliance.",
        s6Title: "6. Your Rights",
        s6Body: "Depending on applicable law, you may have the right to request access, correction, deletion, restriction, or objection regarding your personal data. You may also request information about how your data is processed.",
        s7Title: "7. Contact",
        s7Body: (email) => (<>For privacy-related questions or data requests, contact us at <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
    nl: {
        eyebrow: "Privacybeleid",
        title: (s) => `Privacybeleid voor ${s}`,
        intro: (s, d) => `Dit privacybeleid legt uit hoe ${s} persoonlijke gegevens verzamelt, gebruikt, opslaat en beschermt die via ${d} en gerelateerde zakelijke communicatie worden ingediend.`,
        s1Title: "1. Wat wij verzamelen",
        s1Body: "We kunnen persoonlijke en zakelijke informatie verzamelen die u vrijwillig aan ons verstrekt, waaronder uw naam, bedrijfsnaam, e-mailadres, telefoonnummer, projectdetails en notities bij contactaanvragen.",
        s2Title: "2. Hoe wij uw gegevens gebruiken",
        s2Body: "We gebruiken uw gegevens om vragen te beantwoorden, voorstellen voor te bereiden, met u te communiceren over digitale systemen, automatisering, consultancy of implementatieondersteuning, de website-ervaring te verbeteren en interne records bij te houden.",
        s3Title: "3. Wettelijke grondslag",
        s3Body: (s) => `We verwerken persoonlijke gegevens wanneer dat nodig is om uw verzoek te behandelen, gerechtvaardigde zakelijke belangen na te streven, wettelijke verplichtingen na te leven of contractuele besprekingen voor te bereiden met betrekking tot ${s}-diensten.`,
        s4Title: "4. Opslag en beveiliging",
        s4Body: "Aanvragen worden opgeslagen in beveiligde systemen en beschermd door redelijke technische en organisatorische maatregelen. Toegang is beperkt tot bevoegd personeel dat de informatie nodig heeft om uw verzoek te verwerken.",
        s5Title: "5. Delen van gegevens",
        s5Body: "We verkopen uw persoonlijke gegevens niet. We kunnen beperkte informatie delen met vertrouwde dienstverleners betrokken bij hosting, opslag, e-mailbezorging of bedrijfsvoering, alleen wanneer dat nodig is voor dienstverlening of wettelijke naleving.",
        s6Title: "6. Uw rechten",
        s6Body: "Afhankelijk van de toepasselijke wetgeving heeft u mogelijk het recht om inzage, correctie, verwijdering, beperking of bezwaar te vragen voor uw persoonlijke gegevens. U kunt ook informatie opvragen over de verwerking.",
        s7Title: "7. Contact",
        s7Body: (email) => (<>Voor privacyvragen of gegevensverzoeken neemt u contact op via <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
    ar: {
        eyebrow: "سياسة الخصوصية",
        title: (s) => `سياسة الخصوصية لـ ${s}`,
        intro: (s, d) => `توضّح سياسة الخصوصية هذه كيف يقوم ${s} بجمع البيانات الشخصية المُرسَلة عبر ${d} والاتصالات التجارية ذات الصلة، واستخدامها وتخزينها وحمايتها.`,
        s1Title: "١. ما الذي نجمعه",
        s1Body: "قد نجمع معلومات شخصية وتجارية تقدّمونها لنا طوعًا، بما في ذلك الاسم واسم الشركة والبريد الإلكتروني ورقم الهاتف وتفاصيل المشروع وملاحظات الاستفسار عند إرسال طلب تواصل.",
        s2Title: "٢. كيف نستخدم بياناتكم",
        s2Body: "نستخدم بياناتكم للردّ على الاستفسارات، وإعداد عروض الخدمات، والتواصل معكم بشأن الأنظمة الرقمية والأتمتة والاستشارات أو دعم التنفيذ، وتحسين تجربة الموقع، والاحتفاظ بسجلّات داخلية لطلبات الأعمال.",
        s3Title: "٣. الأساس القانوني",
        s3Body: (s) => `نعالج البيانات الشخصية عند الضرورة للردّ على طلبكم، أو لتحقيق مصالح تجارية مشروعة، أو للامتثال للالتزامات القانونية، أو لإعداد مناقشات تعاقدية تتعلّق بخدمات ${s}.`,
        s4Title: "٤. التخزين والأمان",
        s4Body: "تُخزَّن طلبات الاستفسار في أنظمة أعمال آمنة، ومحميّة بضمانات تقنية وتنظيمية معقولة. الوصول مقصور على الموظفين المخوَّلين الذين يحتاجون إلى المعلومات لمعالجة طلبكم.",
        s5Title: "٥. مشاركة البيانات",
        s5Body: "لا نبيع بياناتكم الشخصية. قد نشارك معلومات محدودة مع مزوّدي خدمات موثوقين معنيّين باستضافة الموقع وتخزين البيانات الآمن وتسليم البريد الإلكتروني أو عمليات الأعمال، فقط عند الحاجة لتقديم الخدمة أو للامتثال القانوني.",
        s6Title: "٦. حقوقكم",
        s6Body: "بحسب القانون المعمول به، قد يحقّ لكم طلب الوصول إلى بياناتكم الشخصية أو تصحيحها أو حذفها أو تقييدها أو الاعتراض على معالجتها. كما يحقّ لكم الاستفسار عن كيفية معالجة بياناتكم.",
        s7Title: "٧. التواصل",
        s7Body: (email) => (<>للأسئلة المتعلّقة بالخصوصية أو طلبات البيانات، تواصلوا معنا عبر <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
};

export default async function PrivacyPage() {
    const settings = await getSiteSettings();
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
    const locale: Locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
    const t = COPY[locale];
    const contactEmail = settings.contactEmail ?? `contact@${settings.siteDomain}`;
    const siteName = settings.siteName;
    const siteDomain = settings.siteDomain;

    // Admin-editable Markdown override per locale takes precedence over the
    // bundled hand-written sections below. Fall back to en when the active
    // locale is missing, then to the structured sections when no override is
    // set at all.
    const privacyMarkdownMap = settings.legalPagesI18n?.privacy;
    const overrideMarkdown = privacyMarkdownMap?.[locale]?.trim()
        || privacyMarkdownMap?.en?.trim()
        || "";

    if (overrideMarkdown) {
        return (
            <div className="min-h-screen bg-white px-6 py-24 text-slate-900 md:px-10 lg:px-16">
                <div className="mx-auto max-w-4xl prose prose-slate prose-headings:font-extrabold prose-h1:text-4xl md:prose-h1:text-5xl prose-h2:text-2xl prose-p:leading-8 prose-a:text-[#0d4f8c]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{overrideMarkdown}</ReactMarkdown>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white px-6 py-24 text-slate-900 md:px-10 lg:px-16">
            <div className="mx-auto max-w-4xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {t.eyebrow}
                </p>
                <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                    {t.title(siteName)}
                </h1>
                <p className="mb-10 text-base leading-8 text-slate-600 md:text-lg">
                    {t.intro(siteName, siteDomain)}
                </p>

                <div className="space-y-10 text-slate-700">
                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s1Title}</h2>
                        <p className="leading-8">{t.s1Body}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s2Title}</h2>
                        <p className="leading-8">{t.s2Body}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s3Title}</h2>
                        <p className="leading-8">{t.s3Body(siteName)}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s4Title}</h2>
                        <p className="leading-8">{t.s4Body}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s5Title}</h2>
                        <p className="leading-8">{t.s5Body}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s6Title}</h2>
                        <p className="leading-8">{t.s6Body}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s7Title}</h2>
                        <p className="leading-8">{t.s7Body(contactEmail)}</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
