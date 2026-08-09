import type { TemplateConfig } from "../types";

export const restaurantConfig: TemplateConfig = {
    id: "restaurant",
    name: "Restaurant",
    description: "Restaurant & hospitality showcase",
    previewImage: "/stealth-cto-hero.png",
    colors: {
        primary: "oklch(0.55 0.18 35)",
        primaryForeground: "oklch(0.985 0 0)",
        accent: "oklch(0.75 0.10 85)",
        accentForeground: "oklch(0.20 0 0)",
        gradientFrom: "oklch(0.55 0.18 35)",
        gradientTo: "oklch(0.75 0.10 85)",
        shadowTint: "shadow-amber-500/20",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    navLinks: [
        { href: "/", label: { en: "Home", nl: "Home" } },
        { href: "/menu", label: { en: "Menu", nl: "Menu" } },
        { href: "/about", label: { en: "Our Story", nl: "Ons Verhaal" } },
        { href: "/reservations", label: { en: "Reservations", nl: "Reserveringen" } },
        { href: "/contact", label: { en: "Contact", nl: "Contact" } },
    ],
    socialLinks: [
        { href: "#", icon: "Instagram", label: "Instagram" },
        { href: "#", icon: "Facebook", label: "Facebook" },
    ],
    hero: {
        badge: { en: "Fine Dining Experience", nl: "Culinaire Ervaring" },
        headline: {
            en: ["Taste", "the", "art", "of", "cuisine."],
            nl: ["Proef", "de", "kunst", "van", "culinair."],
        },
        gradientWordStart: 2,
        subtitle: {
            en: "An unforgettable culinary journey through seasonal ingredients and timeless recipes in the heart of Amsterdam.",
            nl: "Een onvergetelijke culinaire reis door seizoensgebonden ingrediënten en tijdloze recepten in het hart van Amsterdam.",
        },
        primaryCta: { href: "/reservations", label: { en: "Book a Table", nl: "Reserveer een Tafel" } },
        secondaryCta: { href: "/menu", label: { en: "View Menu", nl: "Bekijk Menu" } },
    },
    footer: {
        brandDescription: {
            en: "A culinary destination where tradition meets innovation. Open daily from 17:00.",
            nl: "Een culinaire bestemming waar traditie en innovatie samenkomen. Dagelijks geopend vanaf 17:00.",
        },
        linkColumns: {
            Restaurant: [
                { href: "/menu", label: { en: "Menu", nl: "Menu" } },
                { href: "/about", label: { en: "Our Story", nl: "Ons Verhaal" } },
                { href: "/reservations", label: { en: "Reservations", nl: "Reserveringen" } },
            ],
            Info: [
                { href: "/contact", label: { en: "Contact", nl: "Contact" } },
                { href: "/events", label: { en: "Private Events", nl: "Privé Evenementen" } },
            ],
        },
        ctaTitle: { en: "Join Us Tonight", nl: "Kom Vanavond" },
        ctaDescription: { en: "Reserve your table for an unforgettable evening.", nl: "Reserveer uw tafel voor een onvergetelijke avond." },
        ctaLink: { href: "/reservations", label: { en: "Make a reservation", nl: "Maak een reservering" } },
        copyright: {
            en: "© {year} Restaurant. All rights reserved.",
            nl: "© {year} Restaurant. Alle rechten voorbehouden.",
        },
    },
    pages: {
        blog: {
            title: { en: "Culinary Notes", nl: "Culinaire Notities" },
            subtitle: { en: "From the Kitchen", nl: "Uit de Keuken" },
            description: { en: "Recipes, ingredient stories, and chef updates.", nl: "Recepten, verhalen over ingrediënten en updates van de chef." },
        },
        about: {
            title: { en: "Our Story", nl: "Ons Verhaal" },
            headline: { en: "A Taste of Home", nl: "Een Smaak van Thuis" },
            description: { en: "Founded with a passion for authentic flavors.", nl: "Opgericht met passie voor authentieke smaken." },
        },
        contact: {
            title: { en: "Reservations & Info", nl: "Reserveringen & Info" },
            subtitle: { en: "Join us", nl: "Kom erbij" },
        },
        newsletter: {
            title: { en: "Join the Club", nl: "Word Lid" },
            description: { en: "Exclusive tasting events and seasonal menus.", nl: "Exclusieve proeverijen en seizoensmenu's." },
        },
        videos: {
            title: { en: "Behind the Line", nl: "Achter de Schermen" },
            subtitle: { en: "Watch us cook", nl: "Zie ons koken" },
            description: { en: "Kitchen action and recipe tutorials.", nl: "Actie in de keuken en recept tutorials." },
        },
    },
    homeSections: [
        { component: "HeroSection" },
        { component: "MenuPreviewGrid" },
        { component: "ReservationCTA" },
        { component: "GalleryGrid" },
        {
            component: "ContentPreview",
            props: {
                title: { en: "From the Kitchen", nl: "Uit de Keuken" },
                description: { en: "Latest recipes and stories from our chefs.", nl: "Nieuwste recepten en verhalen van onze chef-koks." },
                cta: { en: "Read our stories →", nl: "Lees onze verhalen →" }
            }
        },
    ],
    aiContext: {
        industry: "Restaurant & Culinary Hospitality",
        brandVoice: "Sensory, warm, inviting, and passionately descriptive.",
        targetAudience: "Foodies, local diners, and culinary enthusiasts.",
        contentPillars: ["Seasonal Menus", "Ingredient Sourcing", "Chef's Notes", "Event Highlights"],
        visualStyle: "Cinematic food photography, moody ambient lighting, rich colors, and close-up textures.",
    },
    dashboard: {
        quick_actions: [
            {
                id: "draft-menu-description",
                label: { en: "Draft Menu Description", nl: "Menubeschrijving Opstellen" },
                description: { en: "Create appetizing descriptions for menu items", nl: "Maak smakelijke beschrijvingen voor menu-items" },
                prompt: "Write an appetizing menu description for a new dish",
            },
            {
                id: "create-event-announcement",
                label: { en: "Create Event Announcement", nl: "Evenement Aankondigen" },
                description: { en: "Promotional copy for special events, tastings, and holidays", nl: "Promotionele tekst voor speciale evenementen, proeverijen en feestdagen" },
                prompt: "Write an announcement for our upcoming restaurant event",
            },
            {
                id: "write-chef-story",
                label: { en: "Write Chef's Story", nl: "Chef's Verhaal Schrijven" },
                description: { en: "Behind-the-scenes content about the culinary team", nl: "Achter-de-schermen content over het culinaire team" },
                prompt: "Tell the story of our chef and their culinary journey",
            },
            {
                id: "compose-reservation-reminder",
                label: { en: "Compose Reservation Reminder", nl: "Reserveringsherinnering Opstellen" },
                description: { en: "Booking confirmation and reminder templates", nl: "Bevestigings- en herinneringssjablonen voor reserveringen" },
                prompt: "Write a reservation confirmation message",
            },
            {
                id: "create-seasonal-menu-intro",
                label: { en: "Create Seasonal Menu Intro", nl: "Seizoensmenu Intro Maken" },
                description: { en: "Introduction copy for new seasonal menus", nl: "Introductietekst voor nieuwe seizoensmenu's" },
                prompt: "Write an introduction for our new seasonal menu",
            },
        ],
    },
    ai_system_context: `You are the AI Content Assistant for restaurants and culinary hospitality businesses.

## Your Role
You are a culinary storyteller and hospitality marketing expert. You understand that food is an experience that engages all senses, and your writing captures the artistry, passion, and tradition behind every dish. You help restaurants communicate their unique identity, from fine dining establishments to cozy neighborhood bistros.

## Industry Expertise
- Culinary arts and cooking techniques
- Wine pairings and beverage programs
- Seasonal ingredient sourcing and farm-to-table practices
- Restaurant operations and service standards
- Hospitality marketing and guest experience
- Food photography direction and plating aesthetics
- Dietary accommodations and allergen communication

## Tone & Voice
- **Sensory and evocative**: Paint pictures with words that make readers taste, smell, and see the food
- **Warm and welcoming**: Create a sense of anticipation and belonging
- **Passionate but not pretentious**: Share expertise without intimidation
- **Authentic**: Honor the traditions and stories behind dishes
- **Inviting**: Encourage guests to experience rather than just consume

## Content Types You Excel At
- **Menu Descriptions**: Evocative dish descriptions that highlight ingredients, techniques, and flavor profiles
- **Event Announcements**: Compelling copy for wine dinners, chef's tables, holiday specials, and tasting events
- **Chef's Stories**: Narrative content about culinary philosophy, training, and inspiration
- **Reservation Communications**: Confirmation messages, reminder templates, and pre-visit correspondence
- **Seasonal Menu Introductions**: Context for menu changes, ingredient spotlights, and seasonal transitions
- **Social Media Captions**: Engaging posts for food photography and behind-the-scenes content
- **Newsletter Content**: Updates on new dishes, events, and restaurant news

## Industry Terminology
Use terms like: farm-to-table, seasonal, locally-sourced, artisanal, tasting menu, prix fixe, sommelier, charcuterie, fromage, amuse-bouche, mise en place, sous vide, reduction, emulsion, terroir, pairing, reserve, cuvée.

## Guidelines
- DO: Describe flavors, textures, and aromas in vivid detail
- DO: Connect dishes to their cultural or regional origins
- DO: Highlight sourcing relationships and ingredient quality
- DO: Create a sense of occasion and anticipation
- AVOID: Overusing superlatives without substance
- AVOID: Making dishes sound complicated or intimidating
- AVOID: Forgetting dietary restrictions and accessibility

When generating content, transport the reader to your table. Make them feel the warmth of the dining room, hear the gentle clink of glasses, and anticipate that first unforgettable bite.`,
};
