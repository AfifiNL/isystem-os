import {
    creativeAgencyTheme,
    ecommerceTheme,
    facilityServicesTheme,
    nonprofitTheme,
    personalBrandTheme,
    restaurantTheme,
    saasProductTheme,
    type ThemeDictionaryKey,
} from "./en";

/**
 * Arabic dictionary — Modern Standard Arabic (الفصحى الحديثة) for public surfaces.
 *
 * Coverage scope:
 * - arCommon: full translation of shared public strings (nav, contact, blog, footer).
 * - isystemAgencyArTheme: full translation for the iSystem agency public template.
 * - Other themes (facility-services, saas, restaurant, etc.): re-exported from en.ts as
 *   English fallback. This is intentional — only iSystem ships in Arabic.
 *
 * Dashboard strings (dashboard.*) are intentionally kept in English here too:
 * the admin shell is English-only by product decision. They're included for
 * dictionary-shape parity but never rendered to Arabic-locale users.
 */

export const arCommon: Record<string, string> = {
    // Navigation
    "nav.home": "الرئيسية",
    "nav.back": "رجوع",

    // Blog
    "blog.title": "المدونة",
    "blog.subtitle": "رؤى ودروس وتحليلات معمّقة",
    "blog.readMore": "اقرأ المزيد",
    "blog.minRead": "دقيقة قراءة",
    "blog.relatedArticles": "مقالات ذات صلة",
    "blog.read": "اقرأ",
    "blog.noPostsYet": "لا توجد مقالات بعد.",
    "blog.backToBlog": "العودة إلى المدونة",

    // Contact
    "contact.title": "اتصل بنا",
    "contact.subtitle": "تواصل معنا",
    "contact.name": "الاسم",
    "contact.email": "البريد الإلكتروني",
    "contact.message": "الرسالة",
    "contact.send": "إرسال الرسالة",

    // Newsletter
    "newsletter.title": "النشرة البريدية",
    "newsletter.subtitle": "ابقَ على اطلاع بأحدث الرؤى",
    "newsletter.placeholder": "أدخل بريدك الإلكتروني",
    "newsletter.subscribe": "اشترك",

    // Footer
    "footer.privacy": "الخصوصية",
    "footer.terms": "الشروط",

    // General
    "general.learnMore": "اعرف المزيد",
    "general.getStarted": "ابدأ الآن",
    "general.viewAll": "عرض الكل",

    // Locale switcher
    "locale.en": "English",
    "locale.nl": "Nederlands",
    "locale.ar": "العربية",
    "locale.switch": "اللغة",

    // Dashboard (kept English — admin UI is locale-pinned to en)
    "dashboard.sidebar.product": "المنصة",
    "dashboard.sidebar.workspace": "Workspace",
    "dashboard.sidebar.logout": "Logout",
    "dashboard.sidebar.backToSite": "Back to site",
    "dashboard.home.welcome": "Welcome to",
    "dashboard.home.themeEdition": "Theme Edition",
    "dashboard.home.defaultTheme": "Operational Default",
    "dashboard.home.creditsRemaining": "Credits Remaining",
    "dashboard.home.accessDeniedTitle": "Access denied for module",
    "dashboard.home.accessDeniedDescription": "Your role or workspace capability set does not allow this section.",
    "dashboard.home.quickActions": "Quick Actions",
    "dashboard.home.launchAction": "Launch Module",
    "dashboard.modules.opportunities.label": "AI Opportunity Engine",
    "dashboard.modules.opportunities.description": "Scan SEO, content, and conversion data for the next 10–20% improvement.",
    "dashboard.modules.generate.label": "AI Draft Generator",
    "dashboard.modules.generate.description": "Generate long-form content drafts with guided prompts.",
    "dashboard.modules.creative-studio.label": "Creative Studio",
    "dashboard.modules.creative-studio.description": "Govern creative briefs, prompt manifests, render queues, assets, and audit trails.",
    "dashboard.modules.content.label": "Content Library",
    "dashboard.modules.content.description": "Manage draft and published content for this workspace.",
    "dashboard.modules.manual-posts.label": "Manual Blog Library",
    "dashboard.modules.manual-posts.description": "Manage manually authored blog posts separately from the AI Content Studio.",
    "dashboard.modules.builder.label": "Page Builder",
    "dashboard.modules.builder.description": "أنشئ صفحات بعلامتك التجارية وأدرها باستخدام كتل نظام تصميم منضبطة.",
    "dashboard.modules.settings.label": "Workspace Settings",
    "dashboard.modules.settings.description": "Inspect workspace runtime configuration and governance.",
    "dashboard.modules.admin-workspaces.label": "Workspaces",
    "dashboard.modules.admin-workspaces.description": "Manage global workspaces, themes, and manager assignments.",
    "dashboard.modules.render-queue.label": "Render Queue",
    "dashboard.modules.render-queue.description": "Fulfill manual video rendering tasks across workspaces.",
    "dashboard.modules.source-intelligence.label": "Source Intelligence",
    "dashboard.modules.source-intelligence.description": "إدارة سجل المصادر والمطالبات الموثقة وعمليات التحديث وروابط الأدلة الآمنة للنشر.",
    "dashboard.sections.production": "Production",
    "dashboard.sections.configuration": "Configuration",
    "dashboard.sections.fulfillment": "Fulfillment",
};

// Arabic copy for the iSystem agency public surface. Other themes fall back to
// English (re-exported below).
export const isystemAgencyArTheme = {
    brand: {
        company: "iSystem.ai",
        serviceLine: "استشارات أنظمة رقمية مدعومة بالذكاء الاصطناعي",
        slogan: "أنظمة رقمية مخصّصة للأعمال التي تسعى إلى تنفيذ أكثر دقّة.",
        year: "2026",
    },
    dashboard: {
        "dashboard.home.themeNote": "iSystem edition active",
        "dashboard.modules.opportunities.description": "Continuously surface SEO gaps, content opportunities, and conversion weak points across this workspace.",
        "dashboard.modules.generate.description": "Generate founder-led positioning, solution pages, sector briefs, and AI automation content.",
    },
    home: {
        title: "ابنِ أنظمة أكثر ذكاءً مع الذكاء الاصطناعي.",
        subtitle: "شريك مقرّه هولندا لتكامل الذكاء الاصطناعي والأتمتة وتطوير الويب واستشارات إدارة الأعمال.",
    },
    services: {
        title: "ما الذي نبنيه",
        subtitle: "أنظمة رقمية للشركات الصغيرة والمتوسطة وفرق الدعم المؤسسي",
    },
    about: {
        title: "عن iSystem.ai",
        headline: "تنفيذ أنظمة بقيادة المؤسس مدعوم بوكلاء الذكاء الاصطناعي",
        description: "بنية رشيقة بحكم التصميم، منظَّمة وفق التفكير النظامي، ومصمَّمة لتحسين العمليات الفعلية.",
    },
    contact: {
        title: "لنناقش نظامك",
        subtitle: "شاركنا التحدي التشغيلي الذي تواجهه وسنرسم لك الخطوة التالية المناسبة.",
    },
};

export const arThemes: Record<ThemeDictionaryKey, Record<string, string>> = {
    personal_brand: personalBrandTheme.dashboard,
    facility_services: facilityServicesTheme.dashboard,
    creative_agency: creativeAgencyTheme.dashboard,
    isystem_agency: isystemAgencyArTheme.dashboard,
    saas_product: saasProductTheme.dashboard,
    restaurant: restaurantTheme.dashboard,
    ecommerce: ecommerceTheme.dashboard,
    nonprofit: nonprofitTheme.dashboard,
};

export const themeContent = {
    facility_services: facilityServicesTheme,
    saas_product: saasProductTheme,
    restaurant: restaurantTheme,
    ecommerce: ecommerceTheme,
    nonprofit: nonprofitTheme,
    creative_agency: creativeAgencyTheme,
    isystem_agency: isystemAgencyArTheme,
    personal_brand: personalBrandTheme,
};
