import type { TemplateConfig } from "../types";

export const saasProductConfig: TemplateConfig = {
    id: "saas-product",
    name: "SaaS Product",
    description: "B2B SaaS product landing & marketing",
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "oklch(0.55 0.25 265)",
        primaryForeground: "oklch(0.985 0 0)",
        accent: "oklch(0.65 0.20 195)",
        accentForeground: "oklch(0.985 0 0)",
        gradientFrom: "oklch(0.55 0.25 265)",
        gradientTo: "oklch(0.65 0.20 195)",
        shadowTint: "shadow-blue-500/20",
    },
    fonts: { heading: "Inter", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/features", label: { en: "Features", nl: "Functies" } },
        { href: "/pricing", label: { en: "Pricing", nl: "Prijzen" } },
        { href: "/blog", label: { en: "Blog", nl: "Blog" } },
        { href: "/contact", label: { en: "Contact", nl: "Contact" } },
    ],
    socialLinks: [
        { href: "#", icon: "Twitter", label: "Twitter" },
        { href: "#", icon: "Github", label: "GitHub" },
        { href: "#", icon: "Linkedin", label: "LinkedIn" },
    ],
    hero: {
        badge: { en: "Now in Beta", nl: "Nu in Beta" },
        headline: {
            en: ["Ship", "faster.", "Scale", "smarter."],
            nl: ["Lever", "sneller.", "Schaal", "slimmer."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "The all-in-one platform that helps your team build, deploy, and iterate at record speed.",
            nl: "Het alles-in-één platform waarmee uw team razendsnel bouwt, implementeert en itereert.",
        },
        primaryCta: { href: "/signup", label: { en: "Start Free Trial", nl: "Start Gratis Proef" } },
        secondaryCta: { href: "/features", label: { en: "See Features", nl: "Bekijk Functies" } },
    },
    footer: {
        brandDescription: {
            en: "Enterprise-grade tooling for modern development teams. Ship with confidence.",
            nl: "Enterprise-grade tooling voor moderne ontwikkelteams. Lever met vertrouwen.",
        },
        linkColumns: {
            Product: [
                { href: "/features", label: { en: "Features", nl: "Functies" } },
                { href: "/pricing", label: { en: "Pricing", nl: "Prijzen" } },
                { href: "/changelog", label: { en: "Changelog", nl: "Wijzigingen" } },
            ],
            Resources: [
                { href: "/blog", label: { en: "Blog", nl: "Blog" } },
                { href: "/docs", label: { en: "Documentation", nl: "Documentatie" } },
                { href: "/contact", label: { en: "Support", nl: "Ondersteuning" } },
            ],
        },
        ctaTitle: { en: "Ready to Ship?", nl: "Klaar om te leveren?" },
        ctaDescription: { en: "Start building for free today.", nl: "Begin vandaag gratis met bouwen." },
        ctaLink: { href: "/signup", label: { en: "Get started", nl: "Aan de slag" } },
        copyright: {
            en: "© {year} SaaS Product Inc. All rights reserved.",
            nl: "© {year} SaaS Product Inc. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Product Blog", nl: "Product Blog" },
            subtitle: { en: "Resources", nl: "Bronnen" },
            description: {
                en: "Product updates, tutorials, and best practices for scaling your workflow.",
                nl: "Productupdates, tutorials en best practices voor het opschalen van uw workflow.",
            },
        },
        about: {
            title: { en: "Our Mission", nl: "Onze Missie" },
            headline: { en: "Building Tools for Modern Teams", nl: "Tools Bouwen voor Moderne Teams" },
            description: {
                en: "We believe software should be fast, beautiful, and get out of your way.",
                nl: "Wij geloven dat software snel, mooi en onopvallend moet zijn.",
            },
        },
        contact: {
            title: { en: "Contact Sales", nl: "Neem Contact Op met Sales" },
            subtitle: { en: "Support", nl: "Ondersteuning" },
        },
        newsletter: {
            title: { en: "Product Updates", nl: "Product Updates" },
            description: { en: "Get the latest features, tips, and webinars delivered straight to your inbox.", nl: "Ontvang de nieuwste functies, tips en webinars rechtstreeks in uw inbox." },
        },
        videos: {
            title: { en: "Video Tutorials", nl: "Video Tutorials" },
            subtitle: { en: "Learn", nl: "Leren" },
            description: { en: "Step-by-step guides and feature walkthroughs to help your team succeed.", nl: "Stapsgewijze handleidingen en productwalkthroughs om uw team te helpen slagen." },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "FeaturesGrid" },
        { component: "ProductDemoCards" },
        { component: "PricingTable" },
        { component: "TestimonialsCarousel" },
        {
            component: "ContentPreview",
            props: {
                title: { en: "Resources & Updates", nl: "Bronnen & Updates" },
                description: { en: "Learn how to get the most out of our platform.", nl: "Leer hoe u het meeste uit ons platform haalt." },
                cta: { en: "Visit the blog →", nl: "Bezoek het blog →" }
            }
        },
        { component: "NewsletterCTA" },
    ],
    aiContext: {
        industry: "B2B SaaS & Tech Startups",
        brandVoice: "Instructional, authoritative, tech-savvy, clear, and product-led.",
        targetAudience: "Founders, product managers, software engineers, and B2B buyers.",
        contentPillars: ["Product Updates", "Engineering Deep Dives", "Growth Hacks", "Customer Success Stories"],
        visualStyle: "Modern, minimal dashboard screenshots, abstract 3D shapes, clean typography, and gradient tech elements.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-release-notes",
                label: { en: "Draft Release Notes", nl: "Release-notities Opstellen" },
                description: { en: "Generate comprehensive release notes for new features and updates", nl: "Genereer uitgebreide release-notities voor nieuwe functies en updates" },
                prompt: "Write detailed release notes for our latest product update",
            },
            {
                id: "write-api-docs",
                label: { en: "Write API Documentation", nl: "API-documentatie Schrijven" },
                description: { en: "Create technical API documentation with examples", nl: "Maak technische API-documentatie met voorbeelden" },
                prompt: "Create comprehensive API documentation for our endpoints",
            },
            {
                id: "compose-feature-announcement",
                label: { en: "Compose Feature Announcement", nl: "Functie-aankondiging Samenstellen" },
                description: { en: "Marketing copy for announcing new features to users", nl: "Marketingtekst voor het aankondigen van nieuwe functies aan gebruikers" },
                prompt: "Write an engaging feature announcement for our latest release",
            },
            {
                id: "generate-changelog",
                label: { en: "Generate Changelog Entry", nl: "Wijzigingenlog Genereren" },
                description: { en: "Version update documentation with changes", nl: "Versie-update documentatie met wijzigingen" },
                prompt: "Create a structured changelog entry for the latest version",
            },
            {
                id: "write-onboarding-email",
                label: { en: "Write Onboarding Email", nl: "Onboarding-e-mail Schrijven" },
                description: { en: "Welcome email sequence for new users", nl: "Welkomst-e-mailreeks voor nieuwe gebruikers" },
                prompt: "Draft an onboarding email sequence for new SaaS users",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for B2B SaaS and technology companies.

## Your Role
You are an expert content strategist and technical writer specializing in the SaaS industry. You understand the unique challenges of communicating complex software products to technical and business audiences alike. Your writing helps SaaS companies drive product adoption, reduce churn, and establish thought leadership.

## Industry Expertise
- B2B software product marketing and positioning
- Technical documentation and API references
- Developer experience (DX) and developer relations
- Product-led growth strategies and freemium models
- Enterprise sales cycles and stakeholder communication
- SaaS metrics: ARR, MRR, churn, CAC, LTV, NRR
- Competitive analysis and market positioning

## Tone & Voice
- **Clear and precise**: Eliminate jargon unless writing for developers
- **Confident but not arrogant**: Demonstrate expertise without condescension
- **Product-focused**: Lead with value propositions and outcomes
- **Technically accurate**: Ensure all technical claims are verifiable
- **Action-oriented**: Include clear next steps and CTAs

## Content Types You Excel At
- **Release Notes**: Structured updates highlighting new features, improvements, and fixes with migration guidance
- **API Documentation**: Endpoint descriptions, request/response examples, authentication flows, and error handling
- **Feature Announcements**: Compelling narratives that connect features to user outcomes
- **Changelog Entries**: Concise, versioned documentation following Keep a Changelog format
- **Technical Blog Posts**: Deep dives into architecture, engineering decisions, and best practices
- **Case Studies**: Customer success stories with measurable outcomes
- **Onboarding Content**: Email sequences, in-app copy, and getting started guides

## Industry Terminology
Use terms like: API, SDK, webhook, endpoint, authentication, authorization, rate limiting, SLA, uptime, deployment, CI/CD, microservices, scalability, latency, throughput, integration, webhook, REST, GraphQL, webhook events, idempotency, pagination.

## Guidelines
- DO: Connect features to business outcomes and user benefits
- DO: Include code examples and technical specifications when relevant
- DO: Use data and metrics to support claims
- DO: Structure content with clear hierarchies and scannable sections
- AVOID: Vague marketing speak without substance
- AVOID: Overpromising on capabilities or performance
- AVOID: Assuming all readers have the same technical background

When generating content, always consider the reader's journey stage (awareness, consideration, decision, adoption) and tailor complexity accordingly. Balance technical depth with accessibility.`,
};
