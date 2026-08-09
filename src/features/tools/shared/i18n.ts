import type { ToolLocale } from "./types";

/**
 * Shared trilingual dictionary for the public /tools surface chrome —
 * EmailGate, AffiliateRail, ToolShell aside, share page, common buttons,
 * stat-tile labels, rate-limit / anti-abuse messages.
 *
 * Per the master production brief:
 *   - EN tilts toward sober EU register (no American sales energy).
 *   - NL is ≈ 30% shorter than EN, uses "vrijblijvend" for "no obligation",
 *     "je" for SME audience, allergic to adjective density. Native review
 *     required before production rollout.
 *   - AR is calm MSA, B2B register.
 */

interface ToolsChromeStrings {
    common: {
        loading: string;
        retry: string;
        next: string;
        edit: string;
        runAgain: string;
        copyLink: string;
        copied: string;
        downloadPdf: string;
        share: string;
        learnMore: string;
        bookCallCta: string;
        bookCallNote: string;
        partnerLinksDisclosure: string;
    };
    stat: {
        readiness: string;
        readinessPotential: string;
        hoursPerMonth: string;
        yearlySavings: string;
        monthlyWaste: string;
        netYearOne: string;
        payback: string;
        score: string;
        grade: string;
        checks: string;
        riskScore: string;
        riskLow: string;
        riskMedium: string;
        riskHigh: string;
        cookieBanner: string;
        trackersDetected: string;
        languages: string;
        cached: string;
    };
    rate: {
        oneUsePerDayHour: string;
        oneUsePerDayHours: (hours: number) => string;
        rateLimitGeneric: string;
        ipBlocked: string;
        botBlocked: string;
        dwellTooShort: string;
        invalidInput: string;
        somethingWrong: string;
    };
    emailGate: {
        eyebrow: string;
        eyebrowAlt: string;
        body: string;
        reportDeliveryNote: string;
        firstName: string;
        firstNameOptional: string;
        email: string;
        emailPlaceholder: string;
        consent: string;
        privacyPolicy: string;
        sending: string;
        submit: string;
        successHeadline: string;
        successBody: string;
        downloadPdf: string;
        copyShareLink: string;
        copied: string;
    };
    affiliate: {
        eyebrow: string;
        heading: string;
        subheading: string;
    };
    shell: {
        freeToolPrefix: string;
        freeToolMinutes: (m: number) => string;
        faqEyebrow: string;
        faqHeading: string;
        workWith: string;
        ctaNote: string;
        relatedEyebrow: string;
        relatedHeading: string;
    };
    share: {
        eyebrow: string;
        generatedOn: (date: string) => string;
        runYourself: string;
        talkToHossam: string;
        footer: string;
    };
    hub: {
        notForHeading: string;
        notForLabel: string;
    };
}

export const TOOLS_CHROME: Record<ToolLocale, ToolsChromeStrings> = {
    en: {
        common: {
            loading: "Loading…",
            retry: "Try again",
            next: "Next",
            edit: "Edit",
            runAgain: "Re-run with different inputs",
            copyLink: "Copy link",
            copied: "Copied",
            downloadPdf: "Download as PDF",
            share: "Share",
            learnMore: "Read more",
            bookCallCta: "Plan a 30-minute call with Hossam",
            bookCallNote: "No slides. No pitch deck. EN or NL.",
            partnerLinksDisclosure:
                "These are partner links. We may earn a commission if you sign up — it doesn't cost you anything extra, and we only list tools we use in production.",
        },
        stat: {
            readiness: "Readiness",
            readinessPotential: "potential",
            hoursPerMonth: "Hours / month",
            yearlySavings: "Yearly savings",
            monthlyWaste: "Monthly waste",
            netYearOne: "Net year 1",
            payback: "Payback",
            score: "Score",
            grade: "Grade",
            checks: "Checks",
            riskScore: "Risk score",
            riskLow: "Low risk",
            riskMedium: "Medium risk",
            riskHigh: "High risk",
            cookieBanner: "Cookie banner",
            trackersDetected: "Trackers detected",
            languages: "Languages",
            cached: "Cached scan",
        },
        rate: {
            oneUsePerDayHour: "This tool is one use per day. Please come back in about an hour.",
            oneUsePerDayHours: (h) => `This tool is one use per day. Please come back in about ${h} hours.`,
            rateLimitGeneric: "Rate limit reached. Please try again later.",
            ipBlocked:
                "We've temporarily restricted this surface for your network. If this is unexpected, email hossam@isystem.ai.",
            botBlocked:
                "Automated access isn't allowed on this surface. If you're a real user, please try again from a regular browser.",
            dwellTooShort: "Please take a moment to fill in the form before submitting.",
            invalidInput: "Some inputs aren't valid — please review and try again.",
            somethingWrong: "Something went wrong. Please try again.",
        },
        emailGate: {
            eyebrow: "Email me the report",
            eyebrowAlt: "Email me the business case",
            body: "Get this result in your inbox with the inputs, recommendations, and a link back to this diagnostic.",
            reportDeliveryNote: "If there is a useful next step, Hossam may send one short note tied to this tool result. No drip campaigns.",
            firstName: "First name",
            firstNameOptional: "optional",
            email: "Work email",
            emailPlaceholder: "you@company.com",
            consent: "Send me the report and one short follow-up from Hossam. One-click unsubscribe.",
            privacyPolicy: "privacy policy",
            sending: "Sending…",
            submit: "Send report",
            successHeadline: "Saved. Check your inbox.",
            successBody:
                "Confirmation email is on its way. You can also save this page as a PDF or share the result link.",
            downloadPdf: "Download as PDF",
            copyShareLink: "Copy share link",
            copied: "Copied",
        },
        affiliate: {
            eyebrow: "Tools we recommend",
            heading: "Hand-picked partners",
            subheading:
                "These are partner links. We may earn a commission if you sign up — it doesn't cost you anything extra, and we only list tools we use in production.",
        },
        shell: {
            freeToolPrefix: "Free tool",
            freeToolMinutes: (m) => `${m} min`,
            faqEyebrow: "FAQ",
            faqHeading: "Frequently asked questions",
            workWith: "Work with iSystem",
            ctaNote: "No slides. No pitch deck. EN or NL.",
            relatedEyebrow: "Other free tools",
            relatedHeading: "Other diagnostics in the iSystem toolkit",
        },
        share: {
            eyebrow: "Shared result · iSystem",
            generatedOn: (d) => `Generated ${d}`,
            runYourself: "Run the tool yourself",
            talkToHossam: "Talk to iSystem",
            footer: "Free public tools by iSystem.ai",
        },
        hub: {
            notForHeading: "Not built for:",
            notForLabel: "Honesty matters more than reach",
        },
    },
    nl: {
        common: {
            loading: "Laden…",
            retry: "Opnieuw proberen",
            next: "Volgende",
            edit: "Bewerken",
            runAgain: "Opnieuw met andere invoer",
            copyLink: "Kopieer link",
            copied: "Gekopieerd",
            downloadPdf: "Download als PDF",
            share: "Deel",
            learnMore: "Lees meer",
            bookCallCta: "Plan 30 minuten met Hossam",
            bookCallNote: "Geen dia's. Geen pitchdeck. NL of EN.",
            partnerLinksDisclosure:
                "Dit zijn partnerlinks. We kunnen een commissie krijgen als je je aanmeldt — jij betaalt niets extra, en we noemen alleen tools die we zelf gebruiken.",
        },
        stat: {
            readiness: "Readiness",
            readinessPotential: "potentieel",
            hoursPerMonth: "Uren / maand",
            yearlySavings: "Jaarlijkse besparing",
            monthlyWaste: "Verspilling / maand",
            netYearOne: "Netto jaar 1",
            payback: "Terugverdientijd",
            score: "Score",
            grade: "Cijfer",
            checks: "Checks",
            riskScore: "Risicoscore",
            riskLow: "Laag risico",
            riskMedium: "Gemiddeld risico",
            riskHigh: "Hoog risico",
            cookieBanner: "Cookiebanner",
            trackersDetected: "Trackers gedetecteerd",
            languages: "Talen",
            cached: "Cache-resultaat",
        },
        rate: {
            oneUsePerDayHour: "Deze tool is één gebruik per dag. Probeer over ongeveer een uur opnieuw.",
            oneUsePerDayHours: (h) => `Deze tool is één gebruik per dag. Probeer over ongeveer ${h} uur opnieuw.`,
            rateLimitGeneric: "Limiet bereikt. Probeer het later opnieuw.",
            ipBlocked:
                "We hebben deze surface tijdelijk beperkt voor jouw netwerk. Mail hossam@isystem.ai als dit onverwacht is.",
            botBlocked:
                "Geautomatiseerde toegang is hier niet toegestaan. Probeer opnieuw vanuit een gewone browser als je een echte gebruiker bent.",
            dwellTooShort: "Vul het formulier even rustig in voor je verzendt.",
            invalidInput: "Een paar velden kloppen niet — check en probeer opnieuw.",
            somethingWrong: "Er ging iets mis. Probeer het opnieuw.",
        },
        emailGate: {
            eyebrow: "Mail me het rapport",
            eyebrowAlt: "Mail me de business case",
            body: "Ontvang dit resultaat per mail met invoer, aanbevelingen en een link terug naar deze diagnose.",
            reportDeliveryNote: "Als er een nuttige vervolgstap is, kan Hossam één korte mail sturen bij dit resultaat. Geen drip-campagnes.",
            firstName: "Voornaam",
            firstNameOptional: "optioneel",
            email: "Zakelijk e-mail",
            emailPlaceholder: "jij@bedrijf.nl",
            consent: "Stuur me het rapport en één korte follow-up van Hossam. Met één klik uit te schrijven.",
            privacyPolicy: "privacybeleid",
            sending: "Verzenden…",
            submit: "Stuur rapport",
            successHeadline: "Opgeslagen. Check je inbox.",
            successBody:
                "Bevestigingsmail is onderweg. Je kunt deze pagina ook als PDF bewaren of de link delen.",
            downloadPdf: "Download als PDF",
            copyShareLink: "Kopieer deellink",
            copied: "Gekopieerd",
        },
        affiliate: {
            eyebrow: "Aanbevolen tools",
            heading: "Handmatig gekozen partners",
            subheading:
                "Dit zijn partnerlinks. We kunnen een commissie krijgen — jij betaalt niets extra. We noemen alleen tools die we zelf in productie gebruiken.",
        },
        shell: {
            freeToolPrefix: "Gratis tool",
            freeToolMinutes: (m) => `${m} min`,
            faqEyebrow: "FAQ",
            faqHeading: "Veelgestelde vragen",
            workWith: "Werken met iSystem",
            ctaNote: "Geen dia's. Geen pitchdeck. NL of EN.",
            relatedEyebrow: "Andere vrijblijvende tools",
            relatedHeading: "Andere diagnoses in de iSystem-toolkit",
        },
        share: {
            eyebrow: "Gedeeld resultaat · iSystem",
            generatedOn: (d) => `Gegenereerd op ${d}`,
            runYourself: "Run de tool zelf",
            talkToHossam: "Praat met iSystem",
            footer: "Gratis publieke tools van iSystem.ai",
        },
        hub: {
            notForHeading: "Niet voor:",
            notForLabel: "Eerlijkheid telt meer dan bereik",
        },
    },
    ar: {
        common: {
            loading: "جارٍ التحميل…",
            retry: "حاول مرة أخرى",
            next: "التالي",
            edit: "تعديل",
            runAgain: "أعد التشغيل بمدخلات مختلفة",
            copyLink: "انسخ الرابط",
            copied: "تم النسخ",
            downloadPdf: "تنزيل بصيغة PDF",
            share: "مشاركة",
            learnMore: "اقرأ المزيد",
            bookCallCta: "احجز 30 دقيقة مع حسام",
            bookCallNote: "بلا شرائح. بلا عرض مبيعات. بالإنجليزية أو الهولندية.",
            partnerLinksDisclosure:
                "هذه روابط شراكة. قد نتقاضى عمولة إن سجّلت — لن تدفع أي مبلغ إضافي، ولا نُرشّح إلا أدوات نستخدمها فعلاً.",
        },
        stat: {
            readiness: "الجاهزية",
            readinessPotential: "إمكان",
            hoursPerMonth: "ساعات / شهر",
            yearlySavings: "وفر سنوي",
            monthlyWaste: "هدر شهري",
            netYearOne: "صافي السنة الأولى",
            payback: "فترة الاسترداد",
            score: "النتيجة",
            grade: "التقدير",
            checks: "الفحوصات",
            riskScore: "درجة المخاطر",
            riskLow: "مخاطر منخفضة",
            riskMedium: "مخاطر متوسّطة",
            riskHigh: "مخاطر مرتفعة",
            cookieBanner: "بانر الكوكيز",
            trackersDetected: "أدوات تتبّع مكتشَفة",
            languages: "اللغات",
            cached: "نتيجة مخزّنة",
        },
        rate: {
            oneUsePerDayHour: "هذه الأداة استخدام واحد يوميًا. عُد بعد ساعة تقريبًا.",
            oneUsePerDayHours: (h) => `هذه الأداة استخدام واحد يوميًا. عُد بعد نحو ${h} ساعة.`,
            rateLimitGeneric: "بلغت الحد. حاول لاحقًا.",
            ipBlocked:
                "قيّدنا هذه الواجهة مؤقتًا لشبكتك. راسل hossam@isystem.ai إن كان ذلك غير متوقّع.",
            botBlocked:
                "الوصول الآلي غير مسموح هنا. إن كنت مستخدمًا حقيقيًا فأعد المحاولة من متصفّح عادي.",
            dwellTooShort: "خذ لحظة لملء النموذج قبل الإرسال.",
            invalidInput: "بعض المدخلات غير صحيحة — راجع ثم أعد المحاولة.",
            somethingWrong: "حدث خطأ ما. حاول مرة أخرى.",
        },
        emailGate: {
            eyebrow: "أرسل لي التقرير",
            eyebrowAlt: "أرسل لي دراسة الجدوى",
            body: "استلم هذه النتيجة في بريدك مع المدخلات والتوصيات ورابط العودة إلى هذا التشخيص.",
            reportDeliveryNote: "إذا وُجدت خطوة تالية مفيدة، قد يرسل حسام رسالة قصيرة واحدة مرتبطة بهذه النتيجة. بلا حملات تنقيطية.",
            firstName: "الاسم الأول",
            firstNameOptional: "اختياري",
            email: "البريد المهني",
            emailPlaceholder: "you@company.com",
            consent: "أرسل التقرير ومتابعة قصيرة واحدة من حسام. إلغاء بنقرة واحدة.",
            privacyPolicy: "سياسة الخصوصية",
            sending: "جارٍ الإرسال…",
            submit: "أرسل التقرير",
            successHeadline: "تم الحفظ. تحقّق من بريدك.",
            successBody:
                "رسالة التأكيد في الطريق. يمكنك أيضًا حفظ هذه الصفحة بصيغة PDF أو مشاركة رابط النتيجة.",
            downloadPdf: "تنزيل بصيغة PDF",
            copyShareLink: "انسخ رابط المشاركة",
            copied: "تم النسخ",
        },
        affiliate: {
            eyebrow: "أدوات نُرشّحها",
            heading: "شركاء مختارون يدويًا",
            subheading:
                "هذه روابط شراكة. قد نتقاضى عمولة عند تسجيلك — دون أي تكلفة إضافية عليك. لا نُرشّح إلا أدوات نستخدمها في الإنتاج.",
        },
        shell: {
            freeToolPrefix: "أداة مجانية",
            freeToolMinutes: (m) => `${m} دقيقة`,
            faqEyebrow: "الأسئلة الشائعة",
            faqHeading: "أسئلة يطرحها العملاء",
            workWith: "العمل مع iSystem",
            ctaNote: "بلا شرائح. بلا عرض مبيعات. بالإنجليزية أو الهولندية.",
            relatedEyebrow: "أدوات مجانية أخرى",
            relatedHeading: "تشخيصات أخرى في عُدّة iSystem",
        },
        share: {
            eyebrow: "نتيجة مشتركة · iSystem",
            generatedOn: (d) => `أُنشئت ${d}`,
            runYourself: "شغّل الأداة بنفسك",
            talkToHossam: "تواصل مع iSystem",
            footer: "أدوات عامّة مجانية من iSystem.ai",
        },
        hub: {
            notForHeading: "ليست مصمَّمة لـ:",
            notForLabel: "الصدق أهم من الانتشار",
        },
    },
};

export function getToolsChrome(locale: ToolLocale): ToolsChromeStrings {
    return TOOLS_CHROME[locale];
}
