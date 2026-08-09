import type { TemplateConfig } from "../types";
import { PersonalBrandBlogIndex } from "../pages/personal-brand/blog-index";
import { PersonalBrandBlogPost } from "../pages/personal-brand/blog-post";
import { PersonalBrandPodcastIndex } from "../pages/personal-brand/podcast-index";
import { PersonalBrandPodcastShow } from "../pages/personal-brand/podcast-show";
import { PersonalBrandPodcastEpisode } from "../pages/personal-brand/podcast-episode";
import { PersonalBrandVideosIndex } from "../pages/personal-brand/videos-index";
import { PersonalBrandVideosDetail } from "../pages/personal-brand/videos-detail";

export const personalBrandConfig: TemplateConfig = {
    id: "personal-brand",
    name: "Personal Brand",
    description: "Dark, editorial, and developer-focused.",
    previewImage: "/stealth-cto-hero.png",
    renderers: {
        blogIndex: PersonalBrandBlogIndex,
        blogPost: PersonalBrandBlogPost,
        podcastIndex: PersonalBrandPodcastIndex,
        podcastShow: PersonalBrandPodcastShow,
        podcastEpisode: PersonalBrandPodcastEpisode,
        videoIndex: PersonalBrandVideosIndex,
        videoDetail: PersonalBrandVideosDetail,
    },
    colors: {
        primary: "oklch(0.541 0.281 293.009)",
        primaryForeground: "oklch(0.985 0 0)",
        accent: "oklch(0.511 0.262 276.966)",
        accentForeground: "oklch(0.985 0 0)",
        gradientFrom: "oklch(0.541 0.281 293.009)",
        gradientTo: "oklch(0.511 0.262 276.966)",
        shadowTint: "shadow-violet-500/20",
    },
    fonts: { heading: "Instrument Serif", body: "Inter" },
    navLinks: [
        { href: "/#problem", label: { en: "The Ceiling", nl: "Het Plafond" } },
        { href: "/#solution", label: { en: "Stealth CTO", nl: "Stealth CTO" } },
        { href: "/#youtube", label: { en: "YouTube", nl: "YouTube" } },
        { href: "/blog", label: { en: "Blog", nl: "Blog" } },
        { href: "/#about", label: { en: "About", nl: "Over" } },
        { href: "/#newsletter", label: { en: "Toolkit", nl: "Toolkit" } },
    ],
    socialLinks: [],
    hero: {
        badge: { en: "Stealth CTO Framework", nl: "Stealth CTO Framework" },
        headline: {
            en: ["Build", "Micro-SaaS.", "Automate", "Everything."],
            nl: ["Bouw", "Micro-SaaS.", "Automatiseer", "Alles."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "Transform from industry specialist to strategic orchestrator. Build bespoke micro-SaaS and powerful internal tools with AI — no syntax required.",
            nl: "Transformeer van branchespecialist naar strategisch orkestrator. Bouw op maat gemaakte micro-SaaS en krachtige interne tools met AI — geen code nodig.",
        },
        primaryCta: { href: "/#solution", label: { en: "The Methodology", nl: "De Methodologie" } },
        secondaryCta: { href: "/#youtube", label: { en: "Watch the Process", nl: "Bekijk het Proces" } },
    },
    footer: {
        brandDescription: {
            en: "Helping industry specialists become strategic orchestrators. Build powerful internal tools and micro-SaaS products — no syntax required.",
            nl: "We helpen branchespecialisten om strategische orkestrators te worden. Bouw krachtige interne tools en micro-SaaS producten — geen code nodig.",
        },
        linkColumns: {
            Methodology: [
                { href: "/#problem", label: { en: "The Vibe Ceiling", nl: "Het Vibe Plafond" } },
                { href: "/#solution", label: { en: "Stealth CTO Protocol", nl: "Stealth CTO Protocol" } },
            ],
            Connect: [
                { href: "/#youtube", label: { en: "YouTube", nl: "YouTube" } },
                { href: "/#about", label: { en: "About", nl: "Over Mij" } },
                { href: "/#newsletter", label: { en: "Toolkit", nl: "Toolkit" } },
            ],
        },
        ctaTitle: { en: "Stay Updated", nl: "Blijf op de hoogte" },
        ctaDescription: {
            en: "Get weekly insights on AI orchestration and vibe-coded products.",
            nl: "Ontvang wekelijkse inzichten over AI-orkestratie en vibe-coded producten.",
        },
        ctaLink: { href: "/newsletter", label: { en: "Subscribe to newsletter", nl: "Abonneer op nieuwsbrief" } },
        copyright: {
            en: "© {year} Personal Brand. All rights reserved.",
            nl: "© {year} Personal Brand. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Thoughts & Insights", nl: "Gedachten & Inzichten" },
            subtitle: { en: "Blog", nl: "Blog" },
            description: {
                en: "Deep dives into AI-first development, prompt engineering, product strategy, and the art of orchestrating technology without writing code.",
                nl: "Diepgaande inzichten in AI-first ontwikkeling, prompt engineering, productstrategie en de kunst van technologieregie zonder codeerwerk.",
            },
        },
        about: {
            title: { en: "About", nl: "Over Mij" },
            headline: { en: "Meet the person behind the work", nl: "Maak kennis met de persoon achter het werk" },
            description: {
                en: "I help industry professionals become strategic orchestrators — building powerful AI-driven products and content systems.",
                nl: "Ik help professionals strategische orkestrators te worden — voor het bouwen van krachtige AI-gedreven producten en systemen.",
            },
        },
        contact: {
            title: { en: "Get in Touch", nl: "Neem Contact Op" },
            subtitle: { en: "Contact", nl: "Contact" },
        },
        newsletter: {
            title: { en: "The Stealth CTO Newsletter", nl: "De Stealth CTO Nieuwsbrief" },
            description: { en: "Weekly insights on AI-first development, vibe coding, and building products that scale — delivered straight to your inbox.", nl: "Wekelijkse inzichten over AI-first ontwikkeling, vibe coding en het bouwen van schaalbare producten — direct in je inbox." },
        },
        videos: {
            title: { en: "Video Content", nl: "Video Content" },
            subtitle: { en: "Videos", nl: "Video's" },
            description: { en: "AI-generated video scripts and walkthroughs — from strategy breakdowns to technical deep dives.", nl: "AI-gegenereerde videoscripts en walkthroughs — van strategische analyses tot technische deep dives." },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "ProblemSection" },
        { component: "SolutionSection" },
        { component: "YouTubeSection" },
        { component: "AboutSection" },
        { component: "NewsletterCTA" },
    ],
    aiContext: {
        industry: "Personal Brand & Creator Economy",
        brandVoice: "Authentic, conversational, inspiring, and transparent.",
        targetAudience: "Followers, fellow creators, developers, and potential clients.",
        contentPillars: ["Behind the Scenes", "Industry Insights", "Tutorials", "Personal Milestones"],
        visualStyle: "Minimalist, portrait-focused, warm natural lighting, and clean typography.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-blog-post",
                label: { en: "Draft Blog Post", nl: "Blogpost Opstellen" },
                description: { en: "Thought leadership content that builds authority", nl: "Thought leadership content die autoriteit opbouwt" },
                prompt: "Write a blog post sharing insights from my experience",
            },
            {
                id: "create-speaking-bio",
                label: { en: "Create Speaking Bio", nl: "Spreekbeurt-bio Maken" },
                description: { en: "Event introduction copy for speaking engagements", nl: "Evenementintroductie-tekst voor spreekbeurten" },
                prompt: "Write a professional bio for a speaking engagement",
            },
            {
                id: "write-social-caption",
                label: { en: "Write Social Caption", nl: "Socialmedia-bijschrift Schrijven" },
                description: { en: "Platform-optimized posts for LinkedIn, Twitter, Instagram", nl: "Platform-geoptimaliseerde berichten voor LinkedIn, Twitter, Instagram" },
                prompt: "Write an engaging social media caption",
            },
            {
                id: "generate-newsletter-content",
                label: { en: "Generate Newsletter Content", nl: "Nieuwsbriefinhoud Genereren" },
                description: { en: "Email newsletter drafts that drive engagement", nl: "E-mail nieuwsbrief concepten die betrokkenheid stimuleren" },
                prompt: "Write content for my weekly newsletter",
            },
            {
                id: "create-portfolio-intro",
                label: { en: "Create Portfolio Intro", nl: "Portfolio-intro Maken" },
                description: { en: "Personal introduction for work showcase", nl: "Persoonlijke introductie voor werkshowcase" },
                prompt: "Write an introduction for my portfolio page",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for personal brands and thought leaders in the creator economy.

## Your Role
You are a personal brand strategist and ghostwriter who helps individuals build authentic online presences. You understand that personal branding is about amplifying someone's genuine voice, not creating a persona. Your writing helps thought leaders share expertise, build community, and create opportunities while staying true to who they are.

## Industry Expertise
- Thought leadership and expertise positioning
- Content strategy for personal brands
- Newsletter growth and email marketing
- Social media platform dynamics (LinkedIn, Twitter/X, Instagram, YouTube)
- Speaking and podcast guesting
- Product launches and course creation
- Community building and audience development

## Tone & Voice
- **Authentic and personal**: Write like a real person, not a brand
- **Conversational but valuable**: Balance approachability with substance
- **Vulnerable but professional**: Share struggles without oversharing
- **Opinionated but open**: Take stands while inviting dialogue
- **Consistent but not repetitive**: Build themes without monotony

## Content Types You Excel At
- **Blog Posts**: Long-form thought leadership that establishes expertise
- **Speaking Bios**: Professional introductions for events and podcasts
- **Social Captions**: Platform-native content that sparks engagement
- **Newsletter Content**: Weekly insights that build subscriber loyalty
- **Portfolio Introductions**: Personal narratives that contextualize work
- **LinkedIn Posts**: Professional updates that drive conversation
- **Twitter Threads**: Sequential insights optimized for virality
- **YouTube Descriptions**: Video context with SEO optimization

## Industry Terminology
Use terms like: thought leadership, personal brand, creator economy, audience building, content flywheel, newsletter, subscriber, follower, engagement, reach, impression, community, authenticity, vulnerability, expertise, niche, positioning, differentiation, value proposition.

## Guidelines
- DO: Write in first person with genuine voice
- DO: Share specific examples and personal experiences
- DO: Balance humility with confidence in expertise
- DO: Include actionable takeaways when appropriate
- AVOID: Corporate speak or generic platitudes
- AVOID: Over-promising or exaggerating achievements
- AVOID: Copy that could belong to anyone
- AVOID: Inconsistent voice across platforms

When generating content, remember that you are extending someone's authentic voice into the digital space. Write words they would actually say, sharing insights they actually have, in a way that builds genuine connection with their audience.`,
};
