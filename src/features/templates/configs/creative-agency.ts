import type { TemplateConfig } from "../types";

export const creativeAgencyConfig: TemplateConfig = {
    id: "creative-agency",
    name: "Creative Agency",
    description: "Bold creative & design agency portfolio",
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "oklch(0.70 0.20 30)",
        primaryForeground: "oklch(0.15 0 0)",
        accent: "oklch(0.80 0.15 80)",
        accentForeground: "oklch(0.15 0 0)",
        gradientFrom: "oklch(0.70 0.20 30)",
        gradientTo: "oklch(0.80 0.15 80)",
        shadowTint: "shadow-orange-500/20",
    },
    fonts: { heading: "Outfit", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/work", label: { en: "Work", nl: "Werk" } },
        { href: "/about", label: { en: "Studio", nl: "Studio" } },
        { href: "/blog", label: { en: "Journal", nl: "Journaal" } },
        { href: "/contact", label: { en: "Let's Talk", nl: "Contact" } },
    ],
    socialLinks: [
        { href: "#", icon: "Instagram", label: "Instagram" },
        { href: "#", icon: "Dribbble", label: "Dribbble" },
        { href: "#", icon: "Linkedin", label: "LinkedIn" },
    ],
    hero: {
        badge: { en: "Award-Winning Studio", nl: "Bekroonde Studio" },
        headline: {
            en: ["We", "craft", "digital", "experiences."],
            nl: ["Wij", "creëren", "digitale", "ervaringen."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "A multidisciplinary creative studio specializing in brand identity, web design, and immersive digital experiences.",
            nl: "Een multidisciplinaire creatieve studio gespecialiseerd in merkidentiteit, webdesign en meeslepende digitale ervaringen.",
        },
        primaryCta: { href: "/work", label: { en: "View Our Work", nl: "Bekijk Ons Werk" } },
        secondaryCta: { href: "/contact", label: { en: "Start a Project", nl: "Start een Project" } },
    },
    footer: {
        brandDescription: {
            en: "Pushing creative boundaries since day one. We design, build, and launch digital products that stand out.",
            nl: "Creatieve grenzen verleggen vanaf dag één. Wij ontwerpen, bouwen en lanceren digitale producten die opvallen.",
        },
        linkColumns: {
            Studio: [
                { href: "/work", label: { en: "Work", nl: "Werk" } },
                { href: "/about", label: { en: "About", nl: "Over" } },
                { href: "/blog", label: { en: "Journal", nl: "Journaal" } },
            ],
            Connect: [
                { href: "/contact", label: { en: "Contact", nl: "Contact" } },
                { href: "/careers", label: { en: "Careers", nl: "Vacatures" } },
            ],
        },
        ctaTitle: { en: "Have a Project?", nl: "Een project in gedachten?" },
        ctaDescription: {
            en: "We'd love to hear about your next big idea.",
            nl: "We horen graag over uw volgende grote idee.",
        },
        ctaLink: { href: "/contact", label: { en: "Get in touch", nl: "Neem contact op" } },
        copyright: {
            en: "© {year} Creative Agency. All rights reserved.",
            nl: "© {year} Creative Agency. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Insights & Ideas", nl: "Inzichten & Ideeën" },
            subtitle: { en: "Our Thinking", nl: "Onze Gedachten" },
            description: { en: "Thoughts on design, culture, and technology.", nl: "Gedachten over design, cultuur en technologie." },
        },
        about: {
            title: { en: "Studio", nl: "Studio" },
            headline: { en: "We are makers.", nl: "Wij zijn makers." },
            description: { en: "A collective of designers and technologists.", nl: "Een collectief van designers en technologen." },
        },
        contact: {
            title: { en: "Say Hello", nl: "Zeg Hallo" },
            subtitle: { en: "Let's collaborate", nl: "Laten we samenwerken" },
        },
        newsletter: {
            title: { en: "Journal", nl: "Journaal" },
            description: { en: "A monthly digest of our best work and thoughts.", nl: "Een maandelijkse samenvatting van ons beste werk en onze gedachten." },
        },
        videos: {
            title: { en: "Showreel", nl: "Showreel" },
            subtitle: { en: "Watch our work", nl: "Bekijk ons werk" },
            description: { en: "Video case studies and behind the scenes.", nl: "Video casestudies en achter de schermen." },
        },
        projects: {
            title: { en: "Selected Works", nl: "Geselecteerde Werken" },
            subtitle: { en: "Our Portfolio", nl: "Ons Portfolio" },
            description: { en: "Explore our recent client collaborations.", nl: "Bekijk onze recente klantengeschiedenis." }
        }
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "ProjectGrid" },
        { component: "ServicesList" },
        { component: "TestimonialSlider" },
        {
            component: "ContentPreview",
            props: {
                title: { en: "Latest Insights", nl: "Nieuwste Inzichten" },
                description: { en: "Read our latest articles on design and culture.", nl: "Lees onze nieuwste artikelen over design en cultuur." },
                cta: { en: "View all posts →", nl: "Bekijk alle berichten →" }
            }
        },
        { component: "NewsletterCTA" },
    ],
    aiContext: {
        industry: "Creative Agency & Design Studio",
        brandVoice: "Edgy, innovative, bold, confident, and highly aesthetic.",
        targetAudience: "Marketing directors, founders, and creative peers seeking top-tier design.",
        contentPillars: ["Design Philosophy", "Case Studies", "Industry Trends", "Studio Culture"],
        visualStyle: "Vibrant, high-contrast, edgy typography, dynamic compositions, and award-winning design aesthetics.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-case-study",
                label: { en: "Draft Case Study", nl: "Case Study Opstellen" },
                description: { en: "Project showcase narratives with process insights", nl: "Projectshowcase-verhalen met procesinzichten" },
                prompt: "Write a compelling case study for a recent client project",
            },
            {
                id: "create-portfolio-copy",
                label: { en: "Create Portfolio Copy", nl: "Portfoliotekst Maken" },
                description: { en: "Work descriptions that highlight creative excellence", nl: "Werkbeschrijvingen die creatieve uitmuntendheid benadrukken" },
                prompt: "Write portfolio copy for a design project",
            },
            {
                id: "write-service-page",
                label: { en: "Write Service Page", nl: "Dienstenpagina Schrijven" },
                description: { en: "Offering explanations that communicate value", nl: "Aanbiedingsuitleg die waarde communiceert" },
                prompt: "Write copy for a creative service offering page",
            },
            {
                id: "generate-pitch-content",
                label: { en: "Generate Pitch Deck Content", nl: "Pitch Deck Inhoud Genereren" },
                description: { en: "Client presentation copy that wins business", nl: "Klantpresentatie-tekst die zaken wint" },
                prompt: "Write content for a client pitch deck",
            },
            {
                id: "create-studio-journal",
                label: { en: "Create Studio Journal Entry", nl: "Studio Journaal Maken" },
                description: { en: "Behind-the-scenes insights and design thinking", nl: "Achter-de-schermen inzichten en design thinking" },
                prompt: "Write a journal entry about our creative process",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for creative agencies and design studios.

## Your Role
You are a creative wordsmith who speaks the language of design. You understand that great creative work needs equally great storytelling, and your writing elevates visual portfolios into compelling narratives. You help agencies articulate their value, showcase their process, and win dream clients through words that match their visual excellence.

## Industry Expertise
- Brand strategy and identity development
- UX/UI design principles and design systems
- Motion design and video production
- Advertising and campaign development
- Creative direction and art direction
- Client relationship management and pitch strategy
- Design thinking and creative methodology

## Tone & Voice
- **Bold and confident**: Make statements, not suggestions
- **Design-literate**: Use industry terminology correctly and naturally
- **Process-proud**: Showcase the thinking behind the work
- **Results-oriented**: Connect creative decisions to business outcomes
- **Distinctive**: Write copy that could only come from a creative studio

## Content Types You Excel At
- **Case Studies**: Project narratives that reveal process, challenges, and creative solutions
- **Portfolio Copy**: Work descriptions that give context and highlight excellence
- **Service Pages**: Offering explanations that communicate value without commoditizing
- **Pitch Decks**: Presentation content that persuades and inspires
- **Studio Journals**: Thought leadership on design philosophy and creative culture
- **Award Submissions**: Competition entries that frame work for judges
- **Capability Decks**: Agency overview documents for new business

## Industry Terminology
Use terms like: brand identity, visual language, design system, user experience, creative direction, art direction, concept development, wireframe, prototype, iteration, design sprint, stakeholder alignment, brand strategy, touchpoint, omnichannel, responsive, accessibility, micro-interaction, motion design, visual hierarchy.

## Guidelines
- DO: Connect creative decisions to strategic outcomes
- DO: Describe process in ways that demonstrate expertise
- DO: Use specific, evocative language over generic descriptors
- DO: Balance confidence with humility about collaboration
- AVOID: Generic agency speak that could apply anywhere
- AVOID: Over-explaining design fundamentals to sophisticated clients
- AVOID: Underselling the strategic value of creative work

When generating content, remember that you are not just describing work—you are extending the creative vision into words. Write with the same craft and intentionality that your clients bring to their visual work.`,
};
