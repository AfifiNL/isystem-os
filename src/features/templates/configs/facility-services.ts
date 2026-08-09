import type { TemplateConfig } from "../types";
import { FacilityServicesBlogIndex } from "../pages/facility-services/blog-index";
import { FacilityServicesBlogPost } from "../pages/facility-services/blog-post";

export const facilityServicesConfig: TemplateConfig = {
    id: "facility-services",
    name: "Facility Services",
    description: "Facility management & cleaning services company",
    previewImage: "/themes/facility-services/hero.jpg",
    colors: {
        primary: "#002f58",
        primaryForeground: "#ffffff",
        accent: "#0d4f8c",
        accentForeground: "#ffffff",
        gradientFrom: "#002f58",
        gradientTo: "#0d4f8c",
        shadowTint: "shadow-[#002f58]/20",
    },
    fonts: { heading: "Inter", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/services", label: { en: "Services", nl: "Diensten" } },
        { href: "/about", label: { en: "About", nl: "Over Ons" } },
        { href: "/blog", label: { en: "Insights", nl: "Inzichten" } },
        { href: "/contact", label: { en: "Contact", nl: "Contact" } },
    ],
    socialLinks: [
        { href: "https://social.example.invalid/facility-services/linkedin", icon: "Linkedin", label: "LinkedIn" },
        { href: "https://social.example.invalid/facility-services/instagram", icon: "Instagram", label: "Instagram" },
    ],
    hero: {
        badge: { en: "Configurable Facility Operations", nl: "Configureerbare Facilitaire Operatie" },
        headline: {
            en: ["Making", "your", "business", "day", "effortless."],
            nl: ["Uw", "werkdag", "compleet", "moeiteloos."],
        },
        gradientWordStart: 4,
        subtitle: {
            en: "Professional facility services covering cleaning, maintenance, and hospitality support — delivered through a single point of contact for your workspace.",
            nl: "Professionele facilitaire diensten voor schoonmaak, onderhoud en hospitality — via één centraal aanspreekpunt voor uw werkplek.",
        },
        primaryCta: { href: "/contact", label: { en: "Partner with Us", nl: "Partner Worden" } },
        secondaryCta: { href: "/services", label: { en: "Explore Our Services", nl: "Ontdek Onze Diensten" } },
    },
    footer: {
        brandDescription: {
            en: "Facility Services Demo delivers professional facility services, simplifying operations so you can focus entirely on your core business.",
            nl: "Facility Services Demo levert professionele facilitaire diensten en vereenvoudigt uw operaties, zodat u zich volledig kunt richten op uw kerndoelen.",
        },
        linkColumns: {
            "Our Services": [
                { href: "/services#cleaning", label: { en: "Cleaning & Maintenance", nl: "Schoonmaak & Onderhoud" } },
                { href: "/services#facility", label: { en: "Facility Management", nl: "Facilitair Management" } },
                { href: "/services#hospitality", label: { en: "Hospitality & Horeca", nl: "Hospitality & Horeca" } },
            ],
            Company: [
                { href: "/about", label: { en: "Our Strategy", nl: "Onze Strategie" } },
                { href: "/contact", label: { en: "Contact Us", nl: "Neem Contact Op" } },
            ],
        },
        ctaTitle: { en: "Streamline Your Facility Services", nl: "Stroomlijn Uw Facilitaire Diensten" },
        ctaDescription: {
            en: "Get in touch to discuss a central point of accountability for your spaces.",
            nl: "Neem contact op om een centraal aanspreekpunt voor uw ruimtes te bespreken.",
        },
        ctaLink: { href: "/contact", label: { en: "Request a Consultation", nl: "Consultatie Aanvragen" } },
        copyright: {
            en: "© {year} Facility Services Demo. Replace this demo identity before publishing.",
            nl: "© {year} Facility Services Demo. Vervang deze demo-identiteit vóór publicatie.",
        },
    },
    pages: {
        blog: {
            title: { en: "Operational Insights", nl: "Operationele Inzichten" },
            subtitle: { en: "Facility Updates", nl: "Facilitaire Updates" },
            description: {
                en: "Strategic insights, operational excellence guides, and trends in professional facility services.",
                nl: "Strategische inzichten, operationele gidsen en trends in professionele facilitaire diensten.",
            },
        },
        about: {
            title: { en: "About Facility Services Demo", nl: "Over Facility Services Demo" },
            headline: { en: "A configurable facility services partner", nl: "Een configureerbare facilitaire partner" },
            description: {
                en: "We deliver integrated, reliable support that helps businesses operate smoothly while reducing operational friction.",
                nl: "Wij leveren geïntegreerde, betrouwbare ondersteuning die bedrijven helpt soepel te functioneren.",
            },
        },
        contact: {
            title: { en: "Partner with Facility Services Demo", nl: "Kies Facility Services Demo als Partner" },
            subtitle: { en: "Contact", nl: "Contact" },
        },
        newsletter: {
            title: { en: "Facility Excellence Newsletter", nl: "Facility Excellence Nieuwsbrief" },
            description: { en: "Practical insights on facility management and operational efficiency, delivered to your inbox.", nl: "Praktische inzichten over facilitair beheer en operationele efficiëntie, direct in uw inbox." },
        },
        videos: {
            title: { en: "Our Approach", nl: "Onze Aanpak" },
            subtitle: { en: "Operations", nl: "Operaties" },
            description: { en: "Discover our standardized SOPs and dedicated teams in action.", nl: "Ontdek onze gestandaardiseerde SOP's en toegewijde teams in actie." },
        },
        services: {
            title: { en: "Our Services", nl: "Onze Diensten" },
            subtitle: { en: "Facility Solutions", nl: "Facilitaire Oplossingen" },
            description: {
                en: "Three core service lines working together as one coordinated operation — that is the Facility Services Demo promise.",
                nl: "Drie kerndienstlijnen die samenwerken als één gecoördineerde operatie — dat is de Facility Services Demo belofte.",
            },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "ServicesGrid" },
        { component: "TestimonialsCarousel" },
        { component: "ServiceAreas" },
        { component: "QuoteRequestForm" },
    ],
    aiContext: {
        industry: "Commercial Cleaning & Facility Management",
        brandVoice: "Professional, analytical, highly reliable, and B2B-focused.",
        targetAudience: "Office managers, facility directors, and commercial property owners.",
        contentPillars: ["Workplace Hygiene", "B2B Service Standards", "Sustainability in Cleaning", "Health & Safety Checklists"],
        visualStyle: "Crisp corporate photography, professional cleaning staff in uniform, sparkling clean office environments, and blue-tinted trust visuals.",
    },
    renderers: {
        blogIndex: FacilityServicesBlogIndex,
        blogPost: FacilityServicesBlogPost,
    },
};
