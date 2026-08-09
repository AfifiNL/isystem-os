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
        path: "/terms",
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
    s1Body: (siteName: string) => string;
    s2Title: string;
    s2Body: string;
    s3Title: string;
    s3Body: (siteName: string) => string;
    s4Title: string;
    s4Body: (siteName: string) => string;
    s5Title: string;
    s5Body: (siteName: string) => string;
    s6Title: string;
    s6Body: string;
    s7Title: string;
    s7Body: (email: string) => React.ReactNode;
}> = {
    en: {
        eyebrow: "Terms & Conditions",
        title: (s) => `Terms of Use for ${s}`,
        intro: (s, d) => `These Terms of Use govern access to and use of ${d}, including inquiries, service information, and other digital content made available by ${s}.`,
        s1Title: "1. Use of the Website",
        s1Body: (s) => `You may use this website to learn about ${s} services, submit business inquiries, and communicate with our team. You agree not to misuse the website, interfere with its operation, or submit false, misleading, or unlawful information.`,
        s2Title: "2. Service Information",
        s2Body: "All content on this website is provided for general informational purposes. Service descriptions, operational capabilities, and response times may be adjusted or clarified through direct consultation and written agreements.",
        s3Title: "3. No Automatic Contract",
        s3Body: (s) => `Submitting a contact request or inquiry through the website does not create a binding service agreement. Any formal engagement with ${s} will be subject to written confirmation, scope agreement, and applicable commercial terms.`,
        s4Title: "4. Intellectual Property",
        s4Body: (s) => `Website copy, branding, visuals, and operational materials displayed on this site are owned by or licensed to ${s}. They may not be copied, distributed, or reused without prior written permission.`,
        s5Title: "5. Limitation of Liability",
        s5Body: (s) => `We aim to keep the website accurate and available, but we do not guarantee uninterrupted access or absolute completeness of all content. To the maximum extent permitted by law, ${s} is not liable for indirect or consequential damages arising from website use.`,
        s6Title: "6. Changes",
        s6Body: "We may update these Terms of Use from time to time to reflect operational, legal, or service changes. Continued use of the website after updates means you accept the revised terms.",
        s7Title: "7. Contact",
        s7Body: (email) => (<>For questions regarding these terms, contact us at <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
    nl: {
        eyebrow: "Algemene voorwaarden",
        title: (s) => `Gebruiksvoorwaarden voor ${s}`,
        intro: (s, d) => `Deze gebruiksvoorwaarden regelen de toegang tot en het gebruik van ${d}, waaronder aanvragen, service-informatie en andere digitale content beschikbaar gesteld door ${s}.`,
        s1Title: "1. Gebruik van de website",
        s1Body: (s) => `U kunt deze website gebruiken om meer te weten te komen over de diensten van ${s}, zakelijke aanvragen in te dienen en met ons team te communiceren. U gaat ermee akkoord de website niet te misbruiken, de werking niet te verstoren en geen valse, misleidende of onwettige informatie te verstrekken.`,
        s2Title: "2. Service-informatie",
        s2Body: "Alle content op deze website is bedoeld voor algemene informatieve doeleinden. Servicebeschrijvingen, operationele mogelijkheden en responstijden kunnen via direct overleg en schriftelijke afspraken worden aangepast of verduidelijkt.",
        s3Title: "3. Geen automatisch contract",
        s3Body: (s) => `Het indienen van een contactaanvraag via de website creëert geen bindende serviceovereenkomst. Elke formele samenwerking met ${s} is onderworpen aan schriftelijke bevestiging, scope-afspraken en toepasselijke commerciële voorwaarden.`,
        s4Title: "4. Intellectueel eigendom",
        s4Body: (s) => `Websitecontent, branding, visuals en operationele materialen op deze site zijn eigendom van of in licentie gegeven aan ${s}. Ze mogen niet worden gekopieerd, verspreid of hergebruikt zonder voorafgaande schriftelijke toestemming.`,
        s5Title: "5. Beperking van aansprakelijkheid",
        s5Body: (s) => `We streven ernaar de website nauwkeurig en beschikbaar te houden, maar we garanderen geen ononderbroken toegang of absolute volledigheid van alle content. Voor zover wettelijk toegestaan is ${s} niet aansprakelijk voor indirecte of gevolgschade voortvloeiend uit websitegebruik.`,
        s6Title: "6. Wijzigingen",
        s6Body: "We kunnen deze gebruiksvoorwaarden van tijd tot tijd bijwerken om operationele, juridische of servicewijzigingen weer te geven. Door de website te blijven gebruiken na updates aanvaardt u de gewijzigde voorwaarden.",
        s7Title: "7. Contact",
        s7Body: (email) => (<>Voor vragen over deze voorwaarden neemt u contact op via <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
    ar: {
        eyebrow: "الشروط والأحكام",
        title: (s) => `شروط استخدام ${s}`,
        intro: (s, d) => `تنظّم شروط الاستخدام هذه الوصول إلى ${d} واستخدامه، بما في ذلك الاستفسارات ومعلومات الخدمات وسائر المحتوى الرقمي الذي يُتيحه ${s}.`,
        s1Title: "١. استخدام الموقع",
        s1Body: (s) => `يحقّ لكم استخدام هذا الموقع للتعرّف على خدمات ${s} وتقديم استفسارات الأعمال والتواصل مع فريقنا. وتوافقون على عدم إساءة استخدام الموقع أو التدخّل في تشغيله أو تقديم معلومات كاذبة أو مضلّلة أو غير قانونية.`,
        s2Title: "٢. معلومات الخدمات",
        s2Body: "جميع المحتويات على هذا الموقع مقدَّمة لأغراض معلوماتية عامة. قد يتمّ تعديل أو توضيح أوصاف الخدمات والقدرات التشغيلية وأوقات الاستجابة من خلال الاستشارة المباشرة والاتفاقات الخطية.",
        s3Title: "٣. لا يوجد عقد تلقائي",
        s3Body: (s) => `إنّ إرسال طلب تواصل أو استفسار عبر الموقع لا يُنشئ اتفاقية خدمة ملزِمة. وأي تعاون رسمي مع ${s} يخضع لتأكيد خطي واتفاق على النطاق والشروط التجارية المعمول بها.`,
        s4Title: "٤. الملكية الفكرية",
        s4Body: (s) => `جميع نصوص الموقع والعلامات التجارية والعناصر البصرية والمواد التشغيلية المعروضة هنا مملوكة لـ ${s} أو مرخَّصة له، ولا يجوز نسخها أو توزيعها أو إعادة استخدامها دون إذن خطي مسبق.`,
        s5Title: "٥. تحديد المسؤولية",
        s5Body: (s) => `نسعى للحفاظ على دقّة الموقع وتوفّره، لكننا لا نضمن الوصول دون انقطاع أو الاكتمال المطلق لجميع المحتويات. وإلى أقصى حدّ يسمح به القانون، لا تتحمّل ${s} المسؤولية عن الأضرار غير المباشرة أو التبعية الناتجة عن استخدام الموقع.`,
        s6Title: "٦. التعديلات",
        s6Body: "قد نقوم بتحديث شروط الاستخدام هذه من حين لآخر لتعكس التغييرات التشغيلية أو القانونية أو الخدمية. ويعني استمراركم في استخدام الموقع بعد التحديثات قبولكم للشروط المُعدَّلة.",
        s7Title: "٧. التواصل",
        s7Body: (email) => (<>للأسئلة المتعلّقة بهذه الشروط، تواصلوا معنا عبر <a className="font-semibold text-[#0d4f8c]" href={`mailto:${email}`}>{email}</a>.</>),
    },
};

export default async function TermsPage() {
    const settings = await getSiteSettings();
    const headerStore = await headers();
    const headerLocale = headerStore.get(LOCALE_HEADER_KEY);
    const locale: Locale = isSupportedLocale(headerLocale) ? headerLocale : DEFAULT_LOCALE;
    const t = COPY[locale];
    const contactEmail = settings.contactEmail ?? `contact@${settings.siteDomain}`;
    const siteName = settings.siteName;
    const siteDomain = settings.siteDomain;

    const termsMarkdownMap = settings.legalPagesI18n?.terms;
    const overrideMarkdown = termsMarkdownMap?.[locale]?.trim()
        || termsMarkdownMap?.en?.trim()
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
                        <p className="leading-8">{t.s1Body(siteName)}</p>
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
                        <p className="leading-8">{t.s4Body(siteName)}</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-2xl font-bold text-slate-900">{t.s5Title}</h2>
                        <p className="leading-8">{t.s5Body(siteName)}</p>
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
