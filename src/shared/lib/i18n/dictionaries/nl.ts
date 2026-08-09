import type { ThemeDictionaryKey } from "@/shared/lib/i18n/dictionaries/en";

/** Dutch dictionary — common strings shared across templates. */
export const nlCommon: Record<string, string> = {
    // Navigation
    "nav.home": "Home",
    "nav.back": "Terug",

    // Blog
    "blog.title": "Blog",
    "blog.subtitle": "Inzichten, tutorials en diepgaande artikelen",
    "blog.readMore": "Lees meer",
    "blog.minRead": "min leestijd",
    "blog.relatedArticles": "Gerelateerde Artikelen",
    "blog.read": "Lees",
    "blog.noPostsYet": "Nog geen artikelen.",
    "blog.backToBlog": "Terug naar Blog",

    // Contact
    "contact.title": "Contact",
    "contact.subtitle": "Neem contact met ons op",
    "contact.name": "Naam",
    "contact.email": "E-mail",
    "contact.message": "Bericht",
    "contact.send": "Verstuur Bericht",

    // Newsletter
    "newsletter.title": "Nieuwsbrief",
    "newsletter.subtitle": "Blijf op de hoogte van de laatste inzichten",
    "newsletter.placeholder": "Vul je e-mail in",
    "newsletter.subscribe": "Abonneren",

    // Footer
    "footer.privacy": "Privacy",
    "footer.terms": "Voorwaarden",

    // General
    "general.learnMore": "Meer Info",
    "general.getStarted": "Aan de slag",
    "general.viewAll": "Alles Bekijken",

    // Locale switcher
    "locale.en": "English",
    "locale.nl": "Nederlands",
    "locale.switch": "Taal",

    // Dashboard
    "dashboard.sidebar.product": "Platform",
    "dashboard.sidebar.workspace": "Workspace",
    "dashboard.sidebar.logout": "Uitloggen",
    "dashboard.sidebar.backToSite": "Terug naar site",
    "dashboard.home.welcome": "Welkom bij",
    "dashboard.home.themeEdition": "Thema Editie",
    "dashboard.home.defaultTheme": "Operationele Standaard",
    "dashboard.home.creditsRemaining": "Credits Over",
    "dashboard.home.accessDeniedTitle": "Toegang geweigerd voor module",
    "dashboard.home.accessDeniedDescription": "Je rol of workspace-rechten staan deze sectie niet toe.",
    "dashboard.home.quickActions": "Snelle Acties",
    "dashboard.home.launchAction": "Module Openen",
    "dashboard.modules.opportunities.label": "AI Kansen Engine",
    "dashboard.modules.opportunities.description": "Scan SEO-, content- en conversiedata voor de volgende 10–20% verbetering.",
    "dashboard.modules.generate.label": "AI Draft Generator",
    "dashboard.modules.generate.description": "Genereer long-form content met begeleide prompts.",
    "dashboard.modules.creative-studio.label": "Creative Studio",
    "dashboard.modules.creative-studio.description": "Beheer creatieve briefs, promptmanifests, renderwachtrijen, assets en audittrails.",
    "dashboard.modules.content.label": "Content Bibliotheek",
    "dashboard.modules.content.description": "Beheer concepten en gepubliceerde content voor deze workspace.",
    "dashboard.modules.manual-posts.label": "Handmatige Blogbibliotheek",
    "dashboard.modules.manual-posts.description": "Beheer handmatig geschreven blogposts apart van de AI Content Studio.",
    "dashboard.modules.builder.label": "Page Builder",
    "dashboard.modules.builder.description": "Stel branded pagina's visueel samen met afgeschermde design-system blokken.",
    "dashboard.modules.settings.label": "Workspace Instellingen",
    "dashboard.modules.settings.description": "Bekijk runtime-configuratie en governance van de workspace.",
    "dashboard.modules.admin-workspaces.label": "Workspaces",
    "dashboard.modules.admin-workspaces.description": "Beheer globale workspaces, thema's en manager-toewijzingen.",
    "dashboard.modules.render-queue.label": "Render Wachtrij",
    "dashboard.modules.render-queue.description": "Verwerk handmatige videorender-taken over workspaces heen.",
    "dashboard.modules.source-intelligence.label": "Source Intelligence",
    "dashboard.modules.source-intelligence.description": "Beheer bronnenregister, bewijsclaims, ingestieruns en veilige publieke bewijslinks.",
    "dashboard.sections.production": "Productie",
    "dashboard.sections.configuration": "Configuratie",
    "dashboard.sections.fulfillment": "Fulfilment",
};

// ============================================================================
// FACILITY SERVICES THEME - Betrouwbaar, Operationeel, Vertrouwensgericht
// ============================================================================
export const facilityServicesTheme = {
    brand: {
        company: "Facility Services Demo — Configureerbare template",
        slogan: "Wij houden uw wereld draaiende, zodat u zich op uw eigen kern kunt richten.",
        year: "2026",
    },
    media: {
        logo: {
            src: "/themes/facility-services/logo.svg",
            alt: "Facility Services Demo bedrijfslogo",
        },
        hero: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Facilitair team in een modern kantoorgebouw",
        },
        about: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Facility Services Demo team in een schone en georganiseerde werkomgeving",
        },
        contact: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Operationeel manager die facilitaire dienstverlening coördineert",
        },
    },
    hero: {
        title: "Wij houden uw wereld draaiende, zodat u zich op uw eigen kern kunt richten.",
        subtitle:
            "Facility Services Demo neemt de operationele last uit uw dagelijkse routine. Wij creëren schone, veilige en strak georganiseerde omgevingen voor commerciële, kantoor- en hospitalityruimtes—zodat uw team floreert.",
        cta_primary: "Vraag een Consultatie Aan",
        cta_secondary: "Bekijk Onze Diensten",
        trustBadges: ["Betrouwbare Levering", "Professioneel Toezicht", "Flexibele Oplossingen", "Eén Aanspreekpunt"],
    },
    foundation: {
        title: "Wat zijn Facility Services?",
        description:
            "Zie ons als de onzichtbare motor achter uw bedrijf. Facility services omvatten alle operationele, technische en organisatorische ondersteuning die nodig is om uw werkruimte soepel en veilig te laten draaien.",
        supportLine: "Bij Facility Services Demo verbinden we mensen, ruimtes en processen om gastvrije en efficiënte werkomgevingen te creëren.",
    },
    stats: {
        items: [
            { value: "24/7", label: "Operationele Continuïteit" },
            { value: "1", label: "Eén Aanspreekpunt" },
            { value: "3", label: "Kern Dienstlijnen" },
            { value: "100%", label: "Professioneel Toezicht" },
        ],
    },
    services: {
        title: "Onze Diensten",
        subtitle: "Professionele facilitaire en operationele ondersteuningsdiensten",
        description:
            "Bij Facility Services Demo bieden wij professionele facilitaire en operationele ondersteuningsdiensten voor hotels, restaurants, logistieke centra en commerciële ruimtes.",
        items: [
            {
                id: "front_office_hospitality_support",
                title: "Front Office & Hospitality Support",
                description:
                    "Professionele front office ondersteuning voor hotels en hospitalitylocaties, inclusief receptieondersteuning, gastenontvangst en operationele ondersteuning aan de front desk voor een soepele en professionele gastervaring.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Front office team ondersteunt hotel- en hospitalitygasten",
                features: ["Receptieondersteuning", "Gastenontvangst", "Operationele ondersteuning aan de front desk"],
            },
            {
                id: "cleaning_hygiene_services",
                title: "Cleaning & Hygiene Services",
                description:
                    "Hoogwaardige schoonmaakdiensten voor restaurants, hotels, kantoren en commerciële ruimtes.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Professioneel schoonmaakteam bewaakt hygiënestandaarden in een commerciële omgeving",
                features: ["Dagelijkse restaurantschoonmaak", "Keukenschoonmaak en hygiëneonderhoud", "Kantoor- en werkplekschoonmaak", "Sanitairreiniging", "Algemene facilitaire schoonmaak"],
            },
            {
                id: "restaurant_kitchen_operational_support",
                title: "Restaurant & Kitchen Operational Support",
                description:
                    "Operationele ondersteuning voor restaurants en keukens om soepele serviceprocessen te behouden.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Keukenondersteuningsteam helpt restaurantoperaties soepel te laten verlopen",
                features: ["Afwasdiensten", "Operationele keukenondersteuning", "Schoonhouden tijdens en na service-uren"],
            },
            {
                id: "logistics_warehouse_operational_support",
                title: "Logistics & Warehouse Operational Support",
                description:
                    "Operationele ondersteuning voor logistieke omgevingen en magazijnen.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Operationeel ondersteuningsteam werkt in een logistieke of pakketsorteeromgeving",
                features: ["Pakket- en postsortering", "Verzendvoorbereiding", "Workflowondersteuning in logistieke hubs", "Operationele ondersteuning in regionale magazijnomgevingen"],
            },
            {
                id: "general_facility_support",
                title: "General Facility Support",
                description:
                    "Aanvullende facilitaire diensten die helpen georganiseerde, efficiënte en professionele werkomgevingen te behouden.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Professioneel facilitair ondersteuningsteam onderhoudt een georganiseerde commerciële omgeving",
                features: ["Ondersteuning voor georganiseerde werkplekken", "Efficiënte operationele assistentie", "Professioneel onderhoud van de werkomgeving"],
            },
        ],
    },
    about: {
        title: "Wie Wij Zijn",
        headline: "Een configureerbare partner voor facility services",
        description:
            "Facility Services Demo is fictieve startinhoud voor deze herbruikbare template. Vervang identiteit, werkgebied, bewijs en contactgegevens vóór publicatie.",
        mission: {
            title: "Onze Missie",
            text: "Facility management vereenvoudigen door hoogwaardige zorg, professioneel toezicht en flexibele oplossingen. Wij vormen onze aanpak rond de exacte behoeften van uw commerciële, kantoor- of hospitalityomgeving.",
        },
        vision: {
            title: "Onze Visie",
            text: "Uw meest vertrouwde operationele partner zijn door schone, veilige en prachtig beheerde omgevingen te cultiveren, die de productiviteit en bedrijfscontinuïteit van uw team op natuurlijke wijze bevorderen.",
        },
    },
    why_facility_services: {
        title: "Waarom Kiezen Voor Facility Services Demo?",
        points: [
            "Professionele en uiterst betrouwbare servicelevering",
            "Flexibele oplossingen perfect afgestemd op elke klant",
            "Helder, consistent toezicht en kwaliteitscontrole",
            "Gespecialiseerde ervaring binnen de hospitality en commerciële sectoren",
            "Eén toegewijd aanspreekpunt voor meerdere facilitaire behoeften",
        ],
    },
    commitment: {
        title: "Onze Toewijding Aan U",
        description:
            "Wij zijn gepassioneerd toegewijd in het leveren van hoogwaardige diensten met uiterste aandacht voor detail, volledige transparantie en onwankelbare professionaliteit. We voltooien niet zomaar taken—we bouwen gestructureerde, ondersteunende omgevingen waarin uw bedrijf met absoluut vertrouwen kan groeien.",
    },
    methodology: {
        title: "Hoe Wij Werken",
        subtitle: "Een gedisciplineerd proces ontworpen voor continuïteit en meetbare kwaliteit",
        steps: [
            {
                title: "Assessment",
                description: "We beoordelen uw operationele context, huidige serviceniveau en risicogebieden in mensen, ruimtes en werkprocessen.",
            },
            {
                title: "Serviceplanning",
                description: "We definiëren een duidelijke service scope, toezichtstructuur en uitvoeringsritme afgestemd op uw bedrijfsprioriteiten.",
            },
            {
                title: "Uitvoering",
                description: "Onze teams verzorgen de dagelijkse operatie met professioneel toezicht, rapportagediscipline en consistente servicestandaarden.",
            },
            {
                title: "Continue Verbetering",
                description: "We monitoren resultaten en optimaliseren serviceprestaties continu op stabiliteit, kwaliteit en efficiëntie.",
            },
        ],
    },
    contact: {
        title: "Laten We Contact Opnemen",
        subtitle: "Klaar om uw facilitaire werkzaamheden te stroomlijnen?",
        description:
            "Neem contact met ons op om uw commerciële, kantoor- of hospitalityruimte te bespreken. Wij zijn er om de essentiële ondersteuning te bieden die uw organisatie nodig heeft om te floreren.",
        form_title: "Vraag een Consultatie Aan",
        form_subtitle: "Zodra u uw gegevens achterlaat neemt een specialist contact op met een voorstel op maat.",
        fields: {
            name: "Volledige Naam",
            company: "Bedrijfsnaam",
            email: "Zakelijk E-mailadres",
            phone: "Telefoonnummer",
            facilitySize: "Grootte Faciliteit",
            facilitySizeOptions: ["< 500 m²", "500 – 2.000 m²", "2.000 – 10.000 m²", "10.000+ m²", "Meerdere Locaties"],
            needs: "Primaire Facilitaire Behoeften",
            needsPlaceholder: "Beschrijf uw operationele prioriteiten, omgevingstype en benodigde ondersteuning...",
            submit: "Verstuur Aanvraag",
        },
        details: {
            email: "hello@facility-services.example.invalid",
            phone: "Niet geconfigureerd",
            address: "Configureer tijdens setup",
            kvk: "Niet geconfigureerd",
            supportHours: "Ma–Vr, 08:00–18:00",
        },
        trustItems: ["Professionele intake", "Heldere scopedefinitie", "Transparant voorstel", "Gecoördineerde onboarding"],
        faq: [
            {
                question: "Welke soorten organisaties bedienen jullie?",
                answer: "Wij ondersteunen commerciële kantoren, hospitalitylocaties en openbare ruimtes die betrouwbare operationele continuïteit vereisen.",
            },
            {
                question: "Kunnen diensten afgestemd worden op de grootte en ons schema?",
                answer: "Absoluut. Wij ontwikkelen flexibele serviceplannen op basis van uw locatieprofiel, openingstijden en interne workflowvereisten.",
            },
            {
                question: "Bieden jullie één aanspreekpunt voor diverse diensten?",
                answer: "Ja. Facility Services Demo levert gecentraliseerde coördinatie, zodat u verschillende facilitaire behoeften kunt beheren via één toegewijde, verantwoordelijke partner.",
            },
            {
                question: "Waar bevinden jullie operaties zich?",
                answer: "Configureer uw echte werkgebied en servicedekking voordat u deze template publiceert.",
            },
        ],
    },
    dashboard: {
        "dashboard.home.quickActions": "Facility Ops Snelle Acties",
    },
};


// ============================================================================
// SAAS PRODUCT THEME - Technisch, Innovatief, Zelfverzekerd
// ============================================================================
export const saasProductTheme = {
    hero: {
        title: "Sneller Leveren. Slimmer Schalen.",
        subtitle: "Het alles-in-één platform dat teams in staat stelt om razendsnel te bouwen, uit te rollen en te itereren. Geen infrastructuurkopzorgen, puur productvelocity.",
        cta_primary: "Start Gratis Proefperiode",
        cta_secondary: "Bekijk Demo",
    },
    features: {
        title: "Gebouwd voor Moderne Teams",
        subtitle: "Alles wat je nodig hebt om van idee naar productie te gaan in recordtijd",
        items: [
            {
                title: "Real-time Samenwerking",
                description: "Werk naadloos samen met live cursors, directe synchronisatie en conflictvrij samenvoegen. Je team blijft perfect in harmonie.",
                icon: "users",
            },
            {
                title: "Enterprise-Beveiliging",
                description: "SOC 2 Type II gecertificeerd met end-to-end encryptie. Je data wordt beschermd door dezelfde standaarden als Fortune 500 bedrijven.",
                icon: "shield",
            },
            {
                title: "Bliksemsnelle Prestaties",
                description: "Sub-100ms responstijden wereldwijd. Onze edge-infrastructuur garandeert je gebruikers overal een razendsnelle ervaring.",
                icon: "zap",
            },
            {
                title: "API-First Architectuur",
                description: "RESTful en GraphQL API's met uitgebreide webhooks. Integreer met je bestaande stack in minuten, niet maanden.",
                icon: "code",
            },
            {
                title: "Intelligente Analyse",
                description: "Bruikbare inzichten aangedreven door machine learning. Begrijp gebruikersgedrag, voorspel churn en optimaliseer conversies automatisch.",
                icon: "bar-chart",
            },
            {
                title: "Oneindige Schaalbaarheid",
                description: "Van nul naar miljoenen gebruikers zonder enige moeite. Auto-scaling infrastructuur die meegroeit met je succes.",
                icon: "trending-up",
            },
        ],
    },
    pricing: {
        title: "Eenvoudige, Transparante Prijzen",
        subtitle: "Begin gratis, schaal mee met je groei. Geen verborgen kosten, geen verrassingen.",
        tiers: [
            {
                name: "Starter",
                price: "0",
                period: "voor altijd",
                features: [
                    "Tot 3 teamleden",
                    "5 projecten",
                    "10GB opslag",
                    "Community support",
                    "Basis analytics",
                ],
                cta: "Gratis Beginnen",
                popular: false,
            },
            {
                name: "Pro",
                price: "49",
                period: "per gebruiker/maand",
                features: [
                    "Onbeperkte teamleden",
                    "Onbeperkte projecten",
                    "100GB opslag",
                    "Prioriteit support",
                    "Geavanceerde analytics",
                    "Custom integraties",
                    "SSO authenticatie",
                ],
                cta: "Start 14-Dagen Proefperiode",
                popular: true,
            },
            {
                name: "Enterprise",
                price: "Op Maat",
                period: "aangepast aan jou",
                features: [
                    "Alles in Pro",
                    "Onbeperkte opslag",
                    "Dedicated support",
                    "SLA garantie",
                    "On-premise implementatie",
                    "Custom contracten",
                    "Beveiligingsaudits",
                ],
                cta: "Neem Contact Op",
                popular: false,
            },
        ],
    },
    testimonials: {
        title: "Vertrouwd door Marktleiders",
        items: [
            {
                quote: "We reduceerden onze deploymenttijd van 2 uur naar 8 minuten. De ROI was direct en onmiskenbaar.",
                author: "Sarah Chen",
                role: "VP Engineering",
                company: "TechFlow Inc.",
            },
            {
                quote: "Het platform hielp ons een 10x verkeerspiek tijdens Black Friday aan te kunnen zonder enige hapering.",
                author: "Marcus Rodriguez",
                role: "CTO",
                company: "RetailBoost",
            },
            {
                quote: "Eindelijk een tool waar onze developers daadwerkelijk graag mee werken. Adoptie was organisch en enthousiast.",
                author: "Emily Watson",
                role: "Director of Product",
                company: "Innovate Labs",
            },
        ],
    },
    stats: {
        items: [
            { value: "99,99%", label: "Uptime SLA" },
            { value: "50ms", label: "Gem. Responstijd" },
            { value: "10.000+", label: "Actieve Teams" },
            { value: "180+", label: "Landen Bediend" },
        ],
    },
    cta: {
        title: "Klaar om Je Ontwikkeling te Versnellen?",
        subtitle: "Sluit je aan bij duizenden teams die sneller shippen met ons platform. Start vandaag je gratis proefperiode.",
        button_text: "Begin Nu met Bouwen",
    },
    about: {
        title: "Over",
        headline: "Gebouwd door productteams die klaar waren met wachten op infrastructuur",
        description:
            "We bouwden dit platform nadat we in multi-productorganisaties zagen hoe snelheid, betrouwbaarheid en governance steeds botsten. Onze missie is helder: geef groeiende teams enterprise-fundamenten zonder enterprise-traagheid. Elke release is ontworpen om time-to-value te verkorten, ontwikkelaars meer vertrouwen te geven en stakeholders op meetbare resultaten te richten.",
    },
    services: {
        title: "Diensten",
        subtitle: "Productversnelling voor teams die nú momentum nodig hebben",
        description:
            "Naast het platform bieden we implementatiebegeleiding, migratiestrategie, architectuurreviews en automation-sprints. Of je nu legacy tooling vervangt of een nieuwe productlijn lanceert, wij helpen je team sneller te leveren met minder overdrachtsfrictie.",
    },
    contact: {
        title: "Contact",
        subtitle: "Boek een demo op maat voor je stack en groeifase",
        description:
            "Vertel ons over je huidige toolchain, teamgrootte en release-doelen. We schetsen een haalbaar adoptiepad, laten integratieopties zien en maken concreet waar je de grootste tijdswinst pakt.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Product Ops Snelle Acties",
    },
};

// ============================================================================
// RESTAURANT THEME - Elegant, Zintuiglijk, Uitnodigend
// ============================================================================
export const restaurantTheme = {
    hero: {
        title: "Een Culinair Reizen door de Zintuigen",
        subtitle: "Ervaar de kunst van fijnproeven waar elk gerecht een verhaal vertelt, elke slok herinneringen oproept en elk moment een gekoesterde herinnering wordt.",
        cta_text: "Reserveer Je Tafel",
    },
    menu: {
        title: "Onze Menukaart",
        subtitle: "Met passie bereid, met doelstellingen gesourced",
        categories: [
            {
                name: "Voorgerechten",
                items: [
                    {
                        name: "Burrata di Puglia",
                        description: "Romige burrata met erfstuktomaten, gerijpte balsamico-reductie en verse basilicum uit onze tuin",
                        price: "18",
                    },
                    {
                        name: "Gegrilde Coquilles",
                        description: "Hokkaido coquilles perfect gekarameliseerd, geserveerd op bloemkoolpuree met zwarte truffelschaafsel",
                        price: "24",
                    },
                    {
                        name: "Tuna Tartare",
                        description: "Lijn-gevangen yellowfin tonijn, avocadomousse, sesamknapperigheid en yuzu kosho dressing",
                        price: "22",
                    },
                ],
            },
            {
                name: "Hoofdgerechten",
                items: [
                    {
                        name: "Wagyu Ribeye",
                        description: "A5 Japanse Wagyu, 45 dagen droog gerijpt, gegrild op binchōtan houtskool, geserveerd met geroosterd beenmerg",
                        price: "95",
                    },
                    {
                        name: "Tong Meunière",
                        description: "Hele tong, bruine boter, kappertjes, citroen en peterselie, aan tafel gefileerd",
                        price: "68",
                    },
                    {
                        name: "Lam Rack",
                        description: "Nieuw-Zeeland lam, korstje van kruiden, rozemarijn-infusie jus, met wortelgroente gratin",
                        price: "52",
                    },
                ],
            },
            {
                name: "Nagerechten",
                items: [
                    {
                        name: "Chocoladesoufflé",
                        description: "Valrhona chocoladesoufflé met crème anglaise en bladgoud",
                        price: "16",
                    },
                    {
                        name: "Crème Brûlée",
                        description: "Tahitiaanse vanille custard, gekarameliseerde suiker, verse bessen",
                        price: "14",
                    },
                    {
                        name: "Kaasselectie",
                        description: "Gecureerde selectie van vijf ambachtelijke kazen, honingraat en huisgemaakte crackers",
                        price: "24",
                    },
                ],
            },
        ],
    },
    chef: {
        title: "Ontmoet Onze Chef",
        name: "Chef Alessandro Moretti",
        bio: "Met meer dan twee decennia culinaire uitmuntendheid in Michelin-sterrenkeukens in Milaan, Parijs en Tokyo, brengt Chef Alessandro een symfonie van smaken op elk bord. Zijn filosofie is eenvoudig: respecteer de ingrediënten, eer de tradities en creëer momenten van pure vreugde.",
        signature_dish: "Kreeftenrisotto met Saffraan en Champagne",
    },
    gallery: {
        title: "Een Feest voor het Oog",
        images: [
            { alt: "Elegante eetkamer met kristallen kroonluchters en intieme verlichting" },
            { alt: "Chef Alessandro die zijn signatuur kreeftenrisotto opmaakt" },
            { alt: "Verse seizoensgebonden ingrediënten van lokale boerderijen" },
            { alt: "Artistiek gepresenteerd toetje met bladgoud garnering" },
            { alt: "Privé eetkamer voor speciale vieringen" },
            { alt: "Zonnig terras met uitzicht op de tuin" },
        ],
    },
    reservation: {
        title: "Reserveer Je Ervaring",
        subtitle: "Join ons voor een onvergetelijke avond. We raden aan minimaal 2 weken van tevoren te boeken voor weekenddineren.",
        button_text: "Boek een Tafel",
    },
    about: {
        title: "Over",
        headline: "Seizoenskeuken, verfijnde gastvrijheid en avonden die blijven hangen",
        description:
            "Ons restaurant is gebouwd op één belofte: uitzonderlijk koken combineren met warme, aandachtige service in een setting die verbinding creëert. We werken met betrouwbare producenten, bouwen menu's rond ingrediënten op hun piek en trainen ons team om van ontvangst tot laatste gang echte gastvrijheid te leveren.",
    },
    services: {
        title: "Diensten",
        subtitle: "Culinaire en eventervaringen afgestemd op jouw gelegenheid",
        description:
            "Kies uit à-la-cartediner, signature tasting menus, private dining en chef-geleide eventpakketten. We verzorgen ook kuratiete wijnpairings en persoonlijke feestmenu's voor zakelijke diners, jubilea en intieme bijeenkomsten.",
    },
    contact: {
        title: "Contact",
        subtitle: "Reserveer een tafel, plan een privé-event of vraag een menu op maat aan",
        description:
            "Geef je voorkeursdatum, groepsgrootte en gelegenheid door. Ons reserveringsteam bevestigt beschikbaarheid en adviseert de beste optie voor jouw ervaring.",
    },
    testimonials: {
        title: "Wat Onze Gasten Zeggen",
        items: [
            {
                quote: "Een buitengewone avond van begin tot eind. De Wagyu was transcendent en de service was onberispelijk.",
                author: "Jonathan & Elizabeth M.",
                rating: 5,
            },
            {
                quote: "We vierden onze verjaardag hier en het overtrof elke verwachting. Een werkelijk magische ervaring.",
                author: "Sophie van der Berg",
                rating: 5,
            },
            {
                quote: "Het proeverijmenu was een reis door smaken waarvan ik niet wist dat ze bestonden. Chef Alessandro is een genie.",
                author: "Michael Thompson",
                rating: 5,
            },
        ],
    },
    dashboard: {
        "dashboard.home.quickActions": "Hospitality Snelle Acties",
    },
};

// ============================================================================
// ECOMMERCE THEME - Dringend, Voordeel-Gericht, Vertrouwen-Bouwend
// ============================================================================
export const ecommerceTheme = {
    hero: {
        title: "Premium Kwaliteit, Ongeslagen Prijzen",
        subtitle: "Ontdek gecureerde collecties van premium producten, handgeplukt voor veeleisende klanten die het beste eisen. Gratis verzending boven €50.",
        cta_text: "Shop Nieuwe Collecties",
    },
    banner: {
        text: "🎉 Wintersale: Tot 40% korting op geselecteerde items. Beperkte tijd!",
        link_text: "Shop de Sale",
    },
    categories: {
        title: "Shop per Categorie",
        items: [
            {
                name: "Elektronica",
                description: "Nieuwste gadgets en tech essentials van topmerken",
                image_alt: "Premium elektronica inclusief smartphones, laptops en accessoires",
            },
            {
                name: "Mode",
                description: "Gecureerde stijlen van opkomende designers en gevestigde labels",
                image_alt: "Modecollectie met eigentijdse kleding en accessoires",
            },
            {
                name: "Wonen & Leven",
                description: "Transformeer je ruimte met onze premium wooncollectie",
                image_alt: "Elegant woonaccessoires en meubelstukken",
            },
            {
                name: "Sport & Outdoor",
                description: "Rust je uit voor avontuur met prestatie-uitrusting",
                image_alt: "Sportuitrusting en outdoor gear voor actieve levensstijlen",
            },
        ],
    },
    products: {
        title: "Nu Trending",
        filter_all: "Alle Producten",
        items: [
            {
                name: "Wireless Noise-Cancelling Koptelefoon Pro",
                description: "Meeslepende audio met 40-uur batterijduur en adaptieve ruisonderdrukking",
                price: "299",
                sale_price: "229",
                badge: "Bestseller",
            },
            {
                name: "Minimalistische Leren Rugzak",
                description: "Handgemaakt Italiaans leer, laptopcompartiment, tijdloos design",
                price: "189",
                sale_price: null,
                badge: null,
            },
            {
                name: "Smart Fitness Horloge Serie X",
                description: "Geavanceerde gezondheidsmonitoring, GPS en 7-daagse batterijduur",
                price: "449",
                sale_price: "379",
                badge: "Nieuw",
            },
            {
                name: "Biologisch Katoenen Beddengoed Set",
                description: "100% GOTS gecertificeerd biologisch katoen, 400 draadcount luxe",
                price: "159",
                sale_price: null,
                badge: "Eco-Vriendelijk",
            },
            {
                name: "Professioneel Koksmessen Set",
                description: "Japans VG-10 staal, 6-delige collectie met magnetisch blok",
                price: "349",
                sale_price: "289",
                badge: null,
            },
            {
                name: "Draagbare 4K Projector",
                description: "Bioscoopkwaliteit projectie, ingebouwde speakers, streaming apps",
                price: "599",
                sale_price: "499",
                badge: "Hot Deal",
            },
        ],
    },
    newsletter: {
        title: "Word Lid van de Inner Circle",
        subtitle: "Krijg exclusieve toegang tot sales, nieuwe collecties en insider voordelen. 15% korting op je eerste bestelling bij inschrijving.",
        placeholder: "Vul je e-mailadres in",
        button_text: "Word Nu Lid",
    },
    trust: {
        items: [
            {
                title: "Gratis Verzending",
                description: "Op alle bestellingen boven €50. Snelle levering in 30+ landen.",
            },
            {
                title: "30-Dagen Retour",
                description: "Niet tevreden? Retourneer elk artikel binnen 30 dagen, zonder vragen.",
            },
            {
                title: "Veilig Afrekenen",
                description: "256-bit SSL encryptie. Je betalingsgegevens zijn altijd beschermd.",
            },
            {
                title: "24/7 Support",
                description: "Ons klanttevredenheidsteam is er wanneer je ons nodig hebt.",
            },
        ],
    },
    about: {
        title: "Over",
        headline: "Een gecureerd e-commerce merk voor zelfverzekerde koopbeslissingen",
        description:
            "Wij combineren premium productselectie, transparante prijzen en betrouwbare fulfilment om shoppen moeiteloos te maken. Ons inkoopteam test kwaliteit, bewaakt leveranciersconsistentie en kiest voor producten die klanten houden en waarderen, niet voor impulsaankopen die na levering tegenvallen.",
    },
    services: {
        title: "Diensten",
        subtitle: "Shoppingservices voor gemak, waarde en blijvend vertrouwen",
        description:
            "Van persoonlijke productaanbevelingen tot cadeau-ondersteuning en wholesale advies: we helpen consumenten en zakelijke kopers met heldere keuzes. Snelle logistiek, responsieve support en een eenvoudig retourproces houden elke bestelling frictiearm.",
    },
    contact: {
        title: "Contact",
        subtitle: "Krijg hulp bij bestellingen, aanbevelingen, retouren en wholesale",
        description:
            "Stuur je ordergegevens of productdoelen door en ons team reageert met concrete vervolgstappen. De meeste vragen lossen we snel op, met duidelijke opties en zonder omwegen.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Commerce Snelle Acties",
    },
};

// ============================================================================
// NONPROFIT THEME - Emotioneel, Dringend, Hoopvol
// ============================================================================
export const nonprofitTheme = {
    hero: {
        title: "Samen Kunnen We Levens Veranderen",
        subtitle: "Elke actie telt. Elke donatie maakt uit. Sluit je aan bij ons in het bouwen van een wereld waar iedereen de kans heeft om te bloeien.",
        cta_text: "Maak Vandaag het Verschil",
    },
    impact: {
        title: "Onze Impact in Cijfers",
        stats: [
            { value: "50.000+", label: "Levens Getransformeerd" },
            { value: "32", label: "Landen Bereikt" },
            { value: "94¢", label: "van Elke Euro gaat naar Programma's" },
            { value: "15+", label: "Jaren in Dienst" },
        ],
    },
    mission: {
        title: "Onze Missie",
        description: "Wij geloven dat elke persoon toegang verdient tot schoon water, kwalitatief onderwijs en basisgezondheidszorg. Onze missie is om gemeenschappen wereldwijd te empoweren door duurzame programma's die blijvende verandering creëren. We werken hand-in-hand met lokale leiders om ervoor te zorgen dat onze initiatieven cultureel passend, milieuvriendelijk en economisch levensvatbaar zijn voor generaties.",
    },
    donate: {
        title: "Jouw Vrijgevigheid Verandert Alles",
        tiers: [
            {
                amount: "25",
                description: "Voorziet één gezin een maand lang van schoon water",
                benefits: ["E-mail updates", "Digitale dankkaart"],
            },
            {
                amount: "75",
                description: "Levert een kind een jaar lang schoolspullen en uniformen",
                benefits: ["Kwartaal impact rapporten", "Foto-updates uit het veld"],
            },
            {
                amount: "150",
                description: "Financiert een micro-lening die een gezin helpt een eigen bedrijf te starten",
                benefits: ["Persoonlijk impactverhaal", "Jaarverslag", "Exclusieve webinars"],
            },
            {
                amount: "500",
                description: "Sponsort een complete medische check-up kamp in een ruraal dorp",
                benefits: ["Directe communicatie met begunstigden", "Erkenning in jaarverslag", "VIP evenementuitnodigingen"],
            },
        ],
        custom_label: "Of vul een eigen bedrag in",
        button_text: "Doneer Nu",
    },
    programs: {
        title: "Onze Programma's",
        items: [
            {
                name: "Schoon Water Initiatief",
                description: "Bouwen van duurzame waterinfrastructuur in onderbediende gemeenschappen, veilig drinkwater voor duizenden.",
                progress: 78,
                goal: "100 putten tegen 2026",
            },
            {
                name: "Onderwijs voor Allen",
                description: "Ondersteuning van scholen, opleiding van leraren en beurzen voor kinderen in ontwikkelingsgebieden.",
                progress: 65,
                goal: "10.000 studenten ingeschreven",
            },
            {
                name: "Gezondheidszorg Outreach",
                description: "Mobiele klinieken en gezondheidsvoorlichting die essentiële medische zorg naar afgelegen gebieden brengen.",
                progress: 82,
                goal: "50.000 patiënten geholpen",
            },
            {
                name: "Vrouwenempowerment",
                description: "Beroepsopleiding en micro-onderneming ondersteuning die vrouwen helpt financiële onafhankelijkheid te bereiken.",
                progress: 71,
                goal: "5.000 vrouwen opgeleid",
            },
        ],
    },
    volunteer: {
        title: "Geef Je Tijd, Verander de Wereld",
        description: "Of je nu een paar uur per maand hebt of bij ons in het veld wilt komen, er is een plek voor jou in onze gemeenschap. Vrijwilligers zijn het hart van onze organisatie.",
        button_text: "Word Vrijwilliger",
    },
    partners: {
        title: "Vertrouwd door Toonaangevende Organisaties",
        logos: [
            { name: "United Nations Foundation" },
            { name: "Bill & Melinda Gates Foundation" },
            { name: "World Health Organization" },
            { name: "UNICEF" },
            { name: "Rode Kruis" },
            { name: "Artsen zonder Grenzen" },
        ],
    },
    about: {
        title: "Over",
        headline: "Gemeenschapsgerichte programma's die vrijgevigheid omzetten in blijvende vooruitgang",
        description:
            "We werken samen met lokale leiders om praktische, cultureel passende initiatieven te bouwen die gezinnen zelf kunnen voortzetten. Met transparante governance, sterke veldpartners en evidence-based planning zorgen we dat elke bijdrage aantoonbare impact maakt waar die het hardst nodig is.",
    },
    services: {
        title: "Diensten",
        subtitle: "Ondersteuning voor donateurs, partners, vrijwilligers en gemeenschappen",
        description:
            "Ons team coördineert programmadelivery, casusdoorverwijzingen, onboarding van vrijwilligers en institutionele samenwerkingen. Of je nu individuele donateur bent of een missiegedreven organisatie: we bieden heldere participatievormen met duidelijke resultaten.",
    },
    contact: {
        title: "Contact",
        subtitle: "Werk samen, meld je aan als vrijwilliger, verwijs een casus of steun een actief programma",
        description:
            "Laat weten hoe je wilt bijdragen en waar je prioriteiten liggen. We koppelen je aan de juiste coördinator en delen direct de beste manier om impact te maken.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Impact Snelle Acties",
    },
};

// ============================================================================
// CREATIVE AGENCY THEME - Gedurfd, Innovatief, Artistiek
// ============================================================================
export const creativeAgencyTheme = {
    hero: {
        title: "Wij Creëren Merken Die Mensen Liefhebben",
        subtitle: "Prijswinnend design studio die gedurfde identiteiten, meeslepende digitale ervaringen en campagnes maakt die captiveren en converteren.",
        cta_text: "Bekijk Ons Werk",
    },
    clients: {
        title: "Vertrouwd door Visionairs",
        logos: [
            { name: "Spotify" },
            { name: "Airbnb" },
            { name: "Nike" },
            { name: "Google" },
            { name: "Netflix" },
            { name: "Tesla" },
        ],
    },
    portfolio: {
        title: "Selectie Werk",
        items: [
            {
                title: "Nova Finance",
                category: "Merkenidentiteit",
                description: "Complete rebrand voor een fintech startup, van logosysteem tot app-interface. Resultaat: 300% stijging in gebruikersregistraties.",
            },
            {
                title: "Urban Threads",
                category: "E-commerce Ervaring",
                description: "End-to-end digitale transformatie voor een duurzaam modemerk, inclusief AR pas-op feature.",
            },
            {
                title: "Mindful App",
                category: "Product Design",
                description: "Meditatie-app met gepersonaliseerde reizen. Uitgeroepen tot App van de Dag in 45 landen.",
            },
            {
                title: "Green Earth Initiative",
                category: "Campagne",
                description: "Multi-platform bewustzijns-campagne die 50M+ mensen bereikte en 200K petitie-handtekeningen opleverde.",
            },
            {
                title: "Artisan Coffee Co.",
                category: "Verpakking & Retail",
                description: "Sensorisch merken-ervaring over verpakking, retailruimtes en digitale touchpoints.",
            },
            {
                title: "Tech Summit 2025",
                category: "Event Design",
                description: "Immersieve conferentie-identiteit met interactieve installaties en digitale navigatie.",
            },
        ],
    },
    services: {
        title: "Wat Wij Doen",
        subtitle: "Creatieve systemen die merkgroei over alle kanalen schaalbaar maken",
        description:
            "Wij organiseren strategie, design en productie in gezamenlijke sprints die revisierondes verkorten en lanceringen versnellen. Zo ontstaat consistente merkuitvoering van campagneconcept tot digitale uitrol.",
        items: [
            {
                name: "Merkenstrategie",
                description: "Onderzoeksgedreven positionering die je unieke stem en visuele taal in de markt definieert.",
            },
            {
                name: "Visuele Identiteit",
                description: "Logosystemen, typografie, kleurenpaletten en uitgebreide merkrichtlijnen die schalen.",
            },
            {
                name: "Digitaal Design",
                description: "Websites, apps en digitale producten die verbluffende esthetiek combineren met intuïtieve UX.",
            },
            {
                name: "Motion & Film",
                description: "Geanimeerde content, commercials en merkfilms die verhalen tot leven brengen.",
            },
            {
                name: "Campagne Ontwikkeling",
                description: "Geïntegreerde marketingcampagnes over alle kanalen met meetbare impact.",
            },
            {
                name: "Ervaringsdesign",
                description: "Immersieve fysieke en virtuele ervaringen die blijvende indrukken creëren.",
            },
        ],
    },
    about: {
        title: "Wij zijn niet zomaar een studio. Wij zijn je creatieve partner.",
        headline: "Onafhankelijke studio-energie met enterprise-kwaliteit in uitvoering",
        description:
            "Sinds 2015 zijn we gegroeid van twee mensen naar een collectief van strategen, designers, motion artists en technologen. We helpen ambitieuze merken met positionering, visuele scherpte en campagnes die mensen in beweging brengen. Onze aanpak combineert artistieke originaliteit met prestatiesturing, zodat gedurfde ideeën uitmonden in meetbare groei.",
    },
    contact: {
        title: "Contact",
        subtitle: "Laten we iets buitengewoons maken",
        description:
            "Deel je uitdaging, tijdlijn en ambitieniveau. Wij adviseren het juiste samenwerkingsmodel en schetsen een helder pad van briefing tot lancering.",
        fields: [
            { label: "Je Naam", placeholder: "Jan Smit" },
            { label: "E-mailadres", placeholder: "jan@bedrijf.nl" },
            { label: "Project Type", placeholder: "Merkenidentiteit, Website, Campagne..." },
            { label: "Vertel Over Je Project", placeholder: "Deel je visie, doelen en tijdlijn..." },
        ],
        button_text: "Start een Gesprek",
    },
    dashboard: {
        "dashboard.home.quickActions": "Studio Snelle Acties",
    },
};

export const isystemAgencyTheme = {
    brand: {
        company: "iSystem.ai",
        serviceLine: "AI-enabled digital systems consultancy",
        slogan: "Maatwerk digitale systemen voor bedrijven die scherper willen uitvoeren.",
        year: "2026",
    },
    dashboard: {
        "dashboard.home.themeNote": "iSystem-editie actief",
        "dashboard.modules.opportunities.description": "Signaleer doorlopend SEO-gaten, contentkansen en conversiezwaktes in deze workspace.",
        "dashboard.modules.generate.description": "Genereer founder-led positionering, solution pages, sectorbriefs en AI-automatiseringscontent.",
    },
    home: {
        title: "Bouw slimmere systemen met AI.",
        subtitle: "Een Nederlandse partner voor AI-integratie, automatisering, webontwikkeling en business management consultancy.",
    },
    services: {
        title: "Wat we bouwen",
        subtitle: "Digitale systemen voor mkb-bedrijven en enterprise support teams",
    },
    about: {
        title: "Over iSystem.ai",
        headline: "Founder-led systeemlevering versterkt door AI-agents",
        description: "Lean by design, gestructureerd door systeemdenken en gebouwd om echte operaties te verbeteren.",
    },
    contact: {
        title: "Laten we uw systeem bespreken",
        subtitle: "Deel uw operationele uitdaging en wij brengen de juiste vervolgstap in kaart.",
    },
};

// ============================================================================
// PERSONAL BRAND THEME - Charismatisch, Vreugdevol, Groei-Georiënteerd
// ============================================================================
export const personalBrandTheme = {
    hero: {
        title: "Word de \"Stealth CTO\" van Jouw Industrie. Bouw Micro-SaaS op Maat in een Weekend.",
        subtitle: "Je hoeft geen twee jaar te besteden aan het leren van code. Je hoeft geen aandelen af te staan aan een technische medeoprichter. Wat je nodig hebt, is architectonische logica. Beheers autonome AI-codeeragenten zoals Cursor, Claude Code en Windsurf en transformeer je diepgaande branchekennis in winstgevende, geautomatiseerde software—alleen door het gebruik van natuurlijke taal en strategische orkestratie.",
        video_placeholder: "Bekijk de Gratis Weekend Build Masterclass",
        badge: "Het tijdperk van de €35.000 bureau MVP is voorbij. Het tijdperk van de 100x Orchestrator is aangebroken.",
    },
    stats: {
        items: [
            { value: "150k+", label: "Wereldwijde Studenten" },
            { value: "12+", label: "Jaren Ervaring" },
            { value: "3", label: "Landen Gebouwd In" },
            { value: "100x", label: "Orkestratie" },
        ],
    },
    problem: {
        title: "Vibe Coding is Pure Magie. Totdat het een Architectonische Nachtmerrie Wordt.",
        subtitle: "Het Vibe Plafond",
        description: "Zodra je applicatie groter wordt dan een enkele landingspagina, stuit de magie op een keiharde grens: The Vibe Ceiling. Het contextgeheugen van de AI raakt overvol. Het begint te hallucineren. Je vraagt de agent om een simpele inlog-bug op te lossen, en per ongeluk wist het je hele database routing schema. Ineens verbrand je dure API-credits en verspil je tientallen uren in een chaotische \"vibe debugging\" loop.",
        quote: "Een beginner zegt gewoon 'fix the app.' Een Stealth CTO levert de exacte architectonische blauwdruk."
    },
    solution: {
        title: "Stop met Typen. Start met het Orkestreren van Systemen.",
        subtitle: "De Stealth CTO Methodologie",
        description: "Een Stealth CTO schrijft geen code. Zij beheren een vloot van elite, autonome AI-agenten. Zij bieden de strategische kaders, de architectonische visie en de diepgaande branchekennis die kunstmatige intelligentie van nature mist.",
        items: [
            {
                name: "Repository Intelligentie",
                description: "Ga verder dan simpele chatbots. Leer Claude Code en Cursor te gebruiken om je complete projectarchitectuur in kaart te brengen.",
            },
            {
                name: "Multi-Agent Orkestratie",
                description: "Vertrouw niet op één AI-model voor alles. Leer gespecialiseerde sub-agenten in te zetten—voor UI design, backend logica en beveiliging.",
            },
            {
                name: "Real-World Infrastructuur",
                description: "Beheers de complexe API's die daadwerkelijk omzet genereren. Verbind Stripe, Supabase en Resend zonder je codebase te breken.",
            },
            {
                name: "Het Weekend Build Protocol",
                description: "Ga van idee-validatie op vrijdagavond naar een volledig operationele, winstgevende Micro-SaaS op zondagavond.",
            },
        ],
    },
    youtube: {
        title: "Bekijk het Proces. Wij Bouwen in het Openbaar.",
        subtitle: "De YouTube Brug",
        description: "Theoretische kennis is nutteloos zonder rauwe uitvoering. Op mijn YouTube-kanaal onthul ik de exacte workflows, IDE-configuraties en prompt-architecturen die ik gebruik om echte, winstgevende producten te lanceren. Geen hypes. Geen AI-gegenereerde rommel. Gewoon transparante, over-the-shoulder engineering.",
        videos: [
            {
                title: "Ik Probeerde Elke AI Agent in 2026. Dit is de Ultieme Stealth CTO Stack.",
                link_text: "Bekijk Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
                title: "Doorbreek The Vibe Ceiling: Hoe Voorkom Je Dat AI Je Code Verwoest.",
                link_text: "Bekijk Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
                title: "Bouw een Niche CRM voor Fitnesscoaches in 48 Uur.",
                link_text: "Bekijk Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        ],
    },
    about: {
        title: "Over Mij",
        headline: "Het verhaal achter het werk",
        description: "Gebruik dit onderdeel om de ervaring, visie en praktische resultaten achter je personal brand toe te lichten.",
        philosophy_title: "De Visie",
        philosophy_p1: "Beschrijf de overtuiging die je werk richting geeft en het probleem dat je voor je publiek wilt oplossen.",
        philosophy_p2: "Verbind die overtuiging met de aanpak, kennis en resultaten die mensen van je mogen verwachten.",
    },
    newsletter: {
        title: "Ben Je Klaar Om Te Orkestreren?",
        description: "De markt wacht niet tot jij Python leert. Grijp vandaag nog je gratis Stealth CTO Toolkit, inclusief mijn exacte Cursor IDE-instellingen, bewezen AI/prompt architecturen en het complete Weekend Build Blueprint.",
        placeholder: "Vul je beste e-mail in",
        button_text: "Grijp de Toolkit",
    },
    dashboard: {
        "dashboard.home.quickActions": "Stealth CTO Snelle Acties",
    },
};

/** Dutch dictionary — theme-specific overrides. */
export const nlThemes: Record<ThemeDictionaryKey, Record<string, string>> = {
    personal_brand: personalBrandTheme.dashboard,
    facility_services: facilityServicesTheme.dashboard,
    creative_agency: creativeAgencyTheme.dashboard,
    isystem_agency: isystemAgencyTheme.dashboard,
    saas_product: saasProductTheme.dashboard,
    restaurant: restaurantTheme.dashboard,
    ecommerce: ecommerceTheme.dashboard,
    nonprofit: nonprofitTheme.dashboard,
};

// Export theme objects for use in components
export const themeContent = {
    facility_services: facilityServicesTheme,
    saas_product: saasProductTheme,
    restaurant: restaurantTheme,
    ecommerce: ecommerceTheme,
    nonprofit: nonprofitTheme,
    creative_agency: creativeAgencyTheme,
    isystem_agency: isystemAgencyTheme,
    personal_brand: personalBrandTheme,
};
