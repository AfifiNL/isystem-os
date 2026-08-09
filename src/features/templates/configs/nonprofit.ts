import type { TemplateConfig } from "../types";

export const nonprofitConfig: TemplateConfig = {
    id: "nonprofit",
    name: "Nonprofit",
    description: "Nonprofit & NGO organization",
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "oklch(0.55 0.15 145)",
        primaryForeground: "oklch(0.985 0 0)",
        accent: "oklch(0.65 0.12 110)",
        accentForeground: "oklch(0.15 0 0)",
        gradientFrom: "oklch(0.55 0.15 145)",
        gradientTo: "oklch(0.65 0.12 110)",
        shadowTint: "shadow-emerald-500/20",
    },
    fonts: { heading: "Inter", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/mission", label: { en: "Our Mission", nl: "Onze Missie" } },
        { href: "/programs", label: { en: "Programs", nl: "Programma's" } },
        { href: "/blog", label: { en: "News", nl: "Nieuws" } },
        { href: "/donate", label: { en: "Donate", nl: "Doneer" } },
    ],
    socialLinks: [
        { href: "#", icon: "Twitter", label: "Twitter" },
        { href: "#", icon: "Facebook", label: "Facebook" },
        { href: "#", icon: "Instagram", label: "Instagram" },
        { href: "#", icon: "Linkedin", label: "LinkedIn" },
    ],
    hero: {
        badge: { en: "Making a Difference", nl: "Het Verschil Maken" },
        headline: {
            en: ["Together", "we", "change", "lives."],
            nl: ["Samen", "veranderen", "wij", "levens."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "Join our mission to create lasting impact in communities around the world through sustainable programs.",
            nl: "Sluit je aan bij onze missie om blijvende impact te creëren in gemeenschappen wereldwijd door duurzame programma's.",
        },
        primaryCta: { href: "/donate", label: { en: "Donate Now", nl: "Doneer Nu" } },
        secondaryCta: { href: "/mission", label: { en: "Learn More", nl: "Meer Info" } },
    },
    footer: {
        brandDescription: {
            en: "A global nonprofit dedicated to empowering communities through education, healthcare, and sustainable development.",
            nl: "Een wereldwijde non-profitorganisatie die gemeenschappen versterkt door onderwijs, gezondheidszorg en duurzame ontwikkeling.",
        },
        linkColumns: {
            Organization: [
                { href: "/mission", label: { en: "Our Mission", nl: "Onze Missie" } },
                { href: "/programs", label: { en: "Programs", nl: "Programma's" } },
                { href: "/about", label: { en: "About Us", nl: "Over Ons" } },
            ],
            "Get Involved": [
                { href: "/donate", label: { en: "Donate", nl: "Doneer" } },
                { href: "/volunteer", label: { en: "Volunteer", nl: "Vrijwilliger" } },
                { href: "/contact", label: { en: "Contact", nl: "Contact" } },
            ],
        },
        ctaTitle: { en: "Support Our Cause", nl: "Steun Ons Doel" },
        ctaDescription: { en: "Your donation makes a tangible difference.", nl: "Uw donatie maakt een tastbaar verschil." },
        ctaLink: { href: "/donate", label: { en: "Donate today", nl: "Doneer vandaag" } },
        copyright: {
            en: "© {year} Nonprofit Foundation. All rights reserved.",
            nl: "© {year} Stichting Nonprofit. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Impact Stories", nl: "Impact Verhalen" },
            subtitle: { en: "News", nl: "Nieuws" },
            description: {
                en: "Updates on our missions, stories from the field, and how your donations help.",
                nl: "Updates over onze missies, verhalen uit het veld en hoe uw donaties helpen.",
            },
        },
        about: {
            title: { en: "Our Mission", nl: "Onze Missie" },
            headline: { en: "Driving Real Change", nl: "Echte Verandering Stimuleren" },
            description: {
                en: "We are dedicated to environmental conservation and empowering local communities worldwide.",
                nl: "Wij zetten ons in voor milieubehoud en het versterken van lokale gemeenschappen wereldwijd.",
            },
        },
        contact: {
            title: { en: "Partner With Us", nl: "Werk Met Ons Samen" },
            subtitle: { en: "Contact", nl: "Contact" },
        },
        newsletter: {
            title: { en: "Impact Newsletter", nl: "Impact Nieuwsbrief" },
            description: { en: "Read stories of change and see how your support is making a difference.", nl: "Lees verhalen over verandering en zie hoe uw steun het verschil maakt." },
        },
        videos: {
            title: { en: "Stories from the Field", nl: "Verhalen uit de Praktijk" },
            subtitle: { en: "Watch", nl: "Bekijk" },
            description: { en: "Watch documentaries and short films about the communities we support.", nl: "Bekijk documentaires en korte films over de gemeenschappen die we steunen." },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "ImpactCounters" },
        { component: "MissionStatement" },
        { component: "DonationCTA" },
        {
            component: "ContentPreview",
            props: {
                title: { en: "Latest Updates", nl: "Laatste Nieuws" },
                description: { en: "Read the latest stories of impact from our global initiatives.", nl: "Lees de nieuwste verhalen over de impact van onze wereldwijde initiatieven." },
                cta: { en: "Read all stories →", nl: "Lees alle verhalen →" }
            }
        },
        { component: "NewsletterCTA" },
    ],
    aiContext: {
        industry: "Nonprofit & Charity Organization",
        brandVoice: "Empathetic, inspiring, urgent, and deeply human.",
        targetAudience: "Donors, volunteers, community members, and philanthropic partners.",
        contentPillars: ["Impact Stories", "Campaign Updates", "Volunteer Spotlights", "Educational Awareness"],
        visualStyle: "Documentary-style photography, emotional portraits, earthy tones, and hopeful lighting.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-impact-story",
                label: { en: "Draft Impact Story", nl: "Impactverhaal Opstellen" },
                description: { en: "Beneficiary success stories that inspire giving", nl: "Succesverhalen van begunstigden die inspireren tot geven" },
                prompt: "Write an inspiring impact story about how donations made a difference",
            },
            {
                id: "create-campaign-appeal",
                label: { en: "Create Campaign Appeal", nl: "Campagne-appèl Maken" },
                description: { en: "Donation request copy for fundraising campaigns", nl: "Donatieverzoeken voor fondsenwervingscampagnes" },
                prompt: "Write a compelling donation appeal for our fundraising campaign",
            },
            {
                id: "write-grant-narrative",
                label: { en: "Write Grant Narrative", nl: "Subsidieverhaal Schrijven" },
                description: { en: "Grant application content and program descriptions", nl: "Subsidieaanvraag inhoud en programmaomschrijvingen" },
                prompt: "Write a narrative section for a grant application",
            },
            {
                id: "compose-volunteer-spotlight",
                label: { en: "Compose Volunteer Spotlight", nl: "Vrijwilliger in de Schijnwerpers" },
                description: { en: "Recognition content for dedicated volunteers", nl: "Erkenningscontent voor toegewijde vrijwilligers" },
                prompt: "Write a spotlight feature celebrating one of our volunteers",
            },
            {
                id: "create-newsletter-appeal",
                label: { en: "Create Newsletter Appeal", nl: "Nieuwsbrief-appèl Maken" },
                description: { en: "Email content for donor engagement", nl: "E-mailcontent voor betrokkenheid van donateurs" },
                prompt: "Write a newsletter section encouraging ongoing support",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for nonprofit organizations and charitable causes.

## Your Role
You are a compassionate storyteller and fundraising communications expert. You understand that behind every statistic is a human story, and your writing bridges the gap between donor generosity and real-world impact. You help nonprofits communicate urgency without exploitation, and hope without naivety.

## Industry Expertise
- Fundraising strategy and donor psychology
- Grant writing and foundation communications
- Impact measurement and outcomes reporting
- Volunteer management and recognition
- Advocacy and awareness campaigns
- Major gifts and planned giving communications
- Corporate partnership development

## Tone & Voice
- **Empathetic and human**: Center the people and communities you serve
- **Urgent but not manipulative**: Create legitimate urgency around real needs
- **Hopeful and inspiring**: Show what's possible with support
- **Transparent**: Be honest about challenges and how funds are used
- **Gratitude-filled**: Always acknowledge the gift of trust and resources

## Content Types You Excel At
- **Impact Stories**: Narrative accounts of how donations created meaningful change
- **Campaign Appeals**: Urgent, specific requests tied to concrete outcomes
- **Grant Narratives**: Compelling program descriptions with measurable objectives
- **Volunteer Spotlights**: Recognition content that celebrates service
- **Annual Reports**: Year-end summaries combining data with human stories
- **Thank You Letters**: Personalized gratitude that reinforces donor relationships
- **Advocacy Content**: Awareness-raising pieces that mobilize action

## Industry Terminology
Use terms like: impact, beneficiary, donor, stakeholder, mission-driven, program outcomes, theory of change, capacity building, sustainable development, community-led, grassroots, philanthropic, unrestricted funds, restricted funds, matching gift, recurring donation, volunteer hours, in-kind donation.

## Guidelines
- DO: Lead with human stories, support with data
- DO: Be specific about how donations will be used
- DO: Show the direct line from gift to outcome
- DO: Include clear, accessible calls to action
- AVOID: Poverty porn or exploitative imagery
- AVOID: Guilt-based messaging that manipulates
- AVOID: Jargon that excludes external audiences
- AVOID: Promises you cannot verify or deliver

When generating content, remember that you are not just asking for money—you are inviting people to be part of something larger than themselves. Honor both the generosity of donors and the dignity of those you serve.`,
};
