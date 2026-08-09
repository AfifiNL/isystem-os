import type { TemplateConfig } from "../types";

export const ecommerceConfig: TemplateConfig = {
    id: "ecommerce",
    name: "E-Commerce",
    description: "Online retail & product showcase",
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "oklch(0.55 0.20 340)",
        primaryForeground: "oklch(0.985 0 0)",
        accent: "oklch(0.65 0.15 320)",
        accentForeground: "oklch(0.985 0 0)",
        gradientFrom: "oklch(0.55 0.20 340)",
        gradientTo: "oklch(0.65 0.15 320)",
        shadowTint: "shadow-pink-500/20",
    },
    fonts: { heading: "Inter", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/shop", label: { en: "Shop", nl: "Winkel" } },
        { href: "/collections", label: { en: "Collections", nl: "Collecties" } },
        { href: "/about", label: { en: "About", nl: "Over Ons" } },
        { href: "/contact", label: { en: "Contact", nl: "Contact" } },
    ],
    socialLinks: [
        { href: "#", icon: "Instagram", label: "Instagram" },
        { href: "#", icon: "Twitter", label: "Twitter" },
        { href: "#", icon: "Facebook", label: "Facebook" },
    ],
    hero: {
        badge: { en: "New Collection", nl: "Nieuwe Collectie" },
        headline: {
            en: ["Discover", "your", "perfect", "style."],
            nl: ["Ontdek", "jouw", "perfecte", "stijl."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "Curated products designed for the modern lifestyle. Free shipping on orders over €50.",
            nl: "Gecureerde producten ontworpen voor de moderne levensstijl. Gratis verzending bij bestellingen boven de €50.",
        },
        primaryCta: { href: "/shop", label: { en: "Shop Now", nl: "Shop Nu" } },
        secondaryCta: { href: "/collections", label: { en: "Browse Collections", nl: "Bekijk Collecties" } },
    },
    footer: {
        brandDescription: {
            en: "Quality products, fair prices, and fast delivery. Your satisfaction is our priority.",
            nl: "Kwaliteitsproducten, eerlijke prijzen en snelle levering. Uw tevredenheid is onze prioriteit.",
        },
        linkColumns: {
            Shop: [
                { href: "/shop", label: { en: "All Products", nl: "Alle Producten" } },
                { href: "/collections", label: { en: "Collections", nl: "Collecties" } },
                { href: "/sale", label: { en: "Sale", nl: "Uitverkoop" } },
            ],
            Support: [
                { href: "/contact", label: { en: "Contact", nl: "Contact" } },
                { href: "/faq", label: { en: "FAQ", nl: "Veelgestelde Vragen" } },
                { href: "/returns", label: { en: "Returns", nl: "Retourneren" } },
            ],
        },
        ctaTitle: { en: "Get 10% Off", nl: "10% Korting" },
        ctaDescription: { en: "Sign up for exclusive deals.", nl: "Meld je aan voor exclusieve deals." },
        ctaLink: { href: "/newsletter", label: { en: "Subscribe", nl: "Abonneren" } },
        copyright: {
            en: "© {year} E-Commerce Store. All rights reserved.",
            nl: "© {year} E-Commerce Winkel. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Style & Guides", nl: "Stijl & Gidsen" },
            subtitle: { en: "The Lookbook", nl: "Het Lookbook" },
            description: { en: "Trends, styling tips, and new arrivals.", nl: "Trends, stylingtips en nieuwe collecties." },
        },
        about: {
            title: { en: "Our Craft", nl: "Ons Vakmanschap" },
            headline: { en: "Designed with purpose", nl: "Ontworpen met een doel" },
            description: { en: "Creating premium goods for everyday life.", nl: "Premium producten voor het dagelijks leven." },
        },
        contact: {
            title: { en: "Support", nl: "Klantenservice" },
            subtitle: { en: "We're here to help", nl: "We zijn hier om te helpen" },
        },
        newsletter: {
            title: { en: "Join the List", nl: "Meld je aan" },
            description: { en: "Get 10% off your first order.", nl: "Ontvang 10% korting op je eerste bestelling." },
        },
        videos: {
            title: { en: "Product Demos", nl: "Productdemo's" },
            subtitle: { en: "Watch the details", nl: "Bekijk de details" },
            description: { en: "Deep dives into our key pieces.", nl: "Diepgaande info over onze belangrijkste stukken." },
        },
    },
    homeSections: [
        { component: "CategoryGrid" },
        { component: "FeaturedProducts" },
        { component: "NewsletterCTA" },
    ],
    aiContext: {
        industry: "E-Commerce & Retail",
        brandVoice: "Persuasive, trendy, concise, and FOMO-driven.",
        targetAudience: "Online shoppers, trend-followers, and consumer buyers.",
        contentPillars: ["Product Spotlight", "Styling Guides", "New Arrivals", "Seasonal Sales"],
        visualStyle: "High-fashion aesthetic, bright studio lighting, minimalist product shots, and lifestyle context.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-product-description",
                label: { en: "Draft Product Description", nl: "Productbeschrijving Opstellen" },
                description: { en: "High-converting product copy that sells", nl: "Converterende producttekst die verkoopt" },
                prompt: "Write a compelling product description for our online store",
            },
            {
                id: "create-sale-banner",
                label: { en: "Create Sale Banner Copy", nl: "Sale-banner Tekst Maken" },
                description: { en: "Promotional messaging for sales and discounts", nl: "Promotionele teksten voor uitverkoop en kortingen" },
                prompt: "Write attention-grabbing copy for our sale banner",
            },
            {
                id: "write-category-intro",
                label: { en: "Write Category Intro", nl: "Categorie-intro Schrijven" },
                description: { en: "Collection page introductions and context", nl: "Introductions en context voor collectiepagina's" },
                prompt: "Write an engaging introduction for a product category page",
            },
            {
                id: "generate-review-response",
                label: { en: "Generate Review Response", nl: "Beoordelingsreactie Genereren" },
                description: { en: "Thoughtful replies to customer reviews", nl: "Doordachte reacties op klantbeoordelingen" },
                prompt: "Write a response to a customer review",
            },
            {
                id: "create-abandoned-cart-email",
                label: { en: "Create Abandoned Cart Email", nl: "Verlaten-winkelwagen E-mail Maken" },
                description: { en: "Recovery emails for incomplete purchases", nl: "Herstel-e-mails voor onvolledige aankopen" },
                prompt: "Write an abandoned cart recovery email",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for e-commerce and online retail businesses.

## Your Role
You are a conversion-focused copywriter and e-commerce marketing expert. You understand the psychology of online shopping and craft content that moves customers from browsing to buying. Your writing balances persuasion with authenticity, driving sales while building brand loyalty.

## Industry Expertise
- Conversion rate optimization (CRO) and A/B testing
- Product photography direction and visual merchandising
- Email marketing flows: welcome, abandoned cart, post-purchase
- SEO for e-commerce: product schema, long-tail keywords, category optimization
- Social commerce and influencer marketing
- Customer lifetime value (CLV) and retention strategies
- Seasonal merchandising and promotional calendars

## Tone & Voice
- **Persuasive but honest**: Highlight benefits without misleading claims
- **Urgency-driven**: Create legitimate FOMO through scarcity and timing
- **Lifestyle-focused**: Connect products to aspirations and experiences
- **Scannable**: Front-load key information for quick decision-making
- **Customer-centric**: Address pain points and desires directly

## Content Types You Excel At
- **Product Descriptions**: Benefit-focused copy that addresses objections and drives purchase decisions
- **Sale Banners**: Attention-grabbing promotional copy with clear CTAs
- **Category Introductions**: SEO-optimized collection pages that guide discovery
- **Review Responses**: Professional, grateful replies that demonstrate customer care
- **Abandoned Cart Emails**: Recovery sequences that address hesitation without pressure
- **Product Emails**: Launch announcements, restock notifications, and recommendation engines
- **Social Captions**: Platform-optimized content for Instagram, TikTok, and Pinterest

## Industry Terminology
Use terms like: conversion rate, average order value (AOV), cart abandonment, checkout optimization, product variant, SKU, inventory, restock, limited edition, flash sale, bundle, upsell, cross-sell, free shipping threshold, customer reviews, social proof.

## Guidelines
- DO: Lead with the primary benefit or outcome
- DO: Include specific details (materials, dimensions, care instructions)
- DO: Address common objections proactively
- DO: Use power words that trigger emotional responses
- AVOID: Generic descriptions that could apply to any product
- AVOID: Exaggerated claims that erode trust
- AVOID: Forgetting mobile-first reading patterns

When generating content, remember that every word is an opportunity to reduce friction and increase desire. Write to convert, but write to retain customers for life.`,
};
