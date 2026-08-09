export type ThemeDictionaryKey =
    | "personal_brand"
    | "facility_services"
    | "creative_agency"
    | "isystem_agency"
    | "saas_product"
    | "restaurant"
    | "ecommerce"
    | "nonprofit";

/** English dictionary — common strings shared across templates. */
export const enCommon: Record<string, string> = {
    // Navigation
    "nav.home": "Home",
    "nav.back": "Back",

    // Blog
    "blog.title": "Blog",
    "blog.subtitle": "Insights, tutorials, and deep dives",
    "blog.readMore": "Read more",
    "blog.minRead": "min read",
    "blog.relatedArticles": "Related Articles",
    "blog.read": "Read",
    "blog.noPostsYet": "No posts yet.",
    "blog.backToBlog": "Back to Blog",

    // Contact
    "contact.title": "Contact",
    "contact.subtitle": "Get in touch with us",
    "contact.name": "Name",
    "contact.email": "Email",
    "contact.message": "Message",
    "contact.send": "Send Message",

    // Newsletter
    "newsletter.title": "Newsletter",
    "newsletter.subtitle": "Stay updated with the latest insights",
    "newsletter.placeholder": "Enter your email",
    "newsletter.subscribe": "Subscribe",

    // Footer
    "footer.privacy": "Privacy",
    "footer.terms": "Terms",

    // General
    "general.learnMore": "Learn More",
    "general.getStarted": "Get Started",
    "general.viewAll": "View All",

    // Locale switcher
    "locale.en": "English",
    "locale.nl": "Nederlands",
    "locale.switch": "Language",

    // Dashboard
    "dashboard.sidebar.product": "Platform",
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
    "dashboard.modules.builder.description": "Visually compose and manage branded pages with constrained design-system blocks.",
    "dashboard.modules.settings.label": "Workspace Settings",
    "dashboard.modules.settings.description": "Inspect workspace runtime configuration and governance.",
    "dashboard.modules.admin-workspaces.label": "Workspaces",
    "dashboard.modules.admin-workspaces.description": "Manage global workspaces, themes, and manager assignments.",
    "dashboard.modules.render-queue.label": "Render Queue",
    "dashboard.modules.render-queue.description": "Fulfill manual video rendering tasks across workspaces.",
    "dashboard.modules.source-intelligence.label": "Source Intelligence",
    "dashboard.modules.source-intelligence.description": "Govern source registry, evidence claims, ingestion runs, and public-safe proof links.",
    "dashboard.sections.production": "Production",
    "dashboard.sections.configuration": "Configuration",
    "dashboard.sections.fulfillment": "Fulfillment",
};

// ============================================================================
// FACILITY SERVICES THEME - Reliable, Operational, Trust-Focused
// ============================================================================
export const facilityServicesTheme = {
    brand: {
        company: "Facility Services Demo",
        serviceLine: "Facility solution services",
        slogan: "We keep your world running so you can focus on yours.",
        year: "2026",
    },
    media: {
        logo: {
            src: "/themes/facility-services/logo.svg",
            alt: "Facility Services Demo corporate logo",
        },
        hero: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Facility team maintaining a modern corporate building",
        },
        about: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Facility Services Demo team in a clean and organized office environment",
        },
        contact: {
            src: "/themes/facility-services/hero.jpg",
            alt: "Operations manager coordinating facility services",
        },
    },
    hero: {
        title: "We Keep Your World Running So You Can Focus on Yours.",
        title_line_one: "We Keep Your World Running",
        title_line_two: "So You Can Focus on Yours",
        subtitle:
            "Facility Services Demo takes the operational hassle out of your daily routine. We create clean, safe, and highly organized environments for commercial, office, and hospitality spaces—so your team can thrive.",
        cta_primary: "Request a Consultation",
        cta_secondary: "Explore Our Services",
        trustBadges: ["Reliable Delivery", "Professional Supervision", "Flexible Solutions", "One Point of Contact"],
    },
    foundation: {
        title: "What Are Facility Services?",
        description:
            "Think of us as the invisible engine behind your business. Facility services encompass all the operational, technical, and organizational support needed to keep your workspace running smoothly and safely.",
        supportLine: "At Facility Services Demo, we connect people, spaces, and processes to create welcoming and efficient work environments.",
    },
    stats: {
        items: [
            { value: "24/7", label: "Operational Continuity" },
            { value: "1", label: "Single Point of Contact" },
            { value: "3", label: "Core Service Lines" },
            { value: "100%", label: "Professional Oversight" },
        ],
    },
    services: {
        title: "Our Services",
        subtitle: "Professional facility and operational support services",
        description:
            "At Facility Services Demo, we provide professional facility and operational support services for hotels, restaurants, logistics centers, and commercial spaces.",
        items: [
            {
                id: "front_office_hospitality_support",
                title: "Front Office & Hospitality Support",
                description:
                    "Professional front office support for hotels and hospitality venues, including reception assistance, guest welcoming, and front desk operational support to ensure a smooth and professional guest experience.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Front office team supporting hotel and hospitality guests",
                features: ["Reception assistance", "Guest welcoming", "Front desk operational support"],
            },
            {
                id: "cleaning_hygiene_services",
                title: "Cleaning & Hygiene Services",
                description:
                    "High-quality cleaning services for restaurants, hotels, offices, and commercial spaces.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Professional cleaning team maintaining hygiene standards in a commercial facility",
                features: ["Daily restaurant cleaning", "Kitchen cleaning and hygiene maintenance", "Office and workspace cleaning", "Restroom sanitation", "General facility cleaning"],
            },
            {
                id: "restaurant_kitchen_operational_support",
                title: "Restaurant & Kitchen Operational Support",
                description:
                    "Operational support for restaurants and kitchens to help maintain smooth service operations.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Kitchen support team helping maintain restaurant service operations",
                features: ["Dishwashing services", "Kitchen operational support", "Maintaining cleanliness during and after service hours"],
            },
            {
                id: "logistics_warehouse_operational_support",
                title: "Logistics & Warehouse Operational Support",
                description:
                    "Operational support for logistics environments and warehouses.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Operational support team working in a logistics or parcel sorting environment",
                features: ["Package and parcel sorting", "Shipment preparation", "Workflow support in logistics hubs", "Operational assistance in regional warehouse environments"],
            },
            {
                id: "general_facility_support",
                title: "General Facility Support",
                description:
                    "Additional facility services that help maintain organized, efficient, and professional working environments.",
                image: "/themes/facility-services/hero.jpg",
                alt: "Professional facility support team maintaining an organized commercial environment",
                features: ["Organized workplace support", "Efficient operational assistance", "Professional environment upkeep"],
            },
        ],
    },
    about: {
        title: "Who We Are",
        headline: "A configurable facility services partner",
        description:
            "Facility Services Demo is fictional starter content for this reusable template. Replace its identity, service region, proof, and contact details before publishing.",
        mission: {
            title: "Our Mission",
            text: "To simplify facility management through high-quality care, professional supervision, and flexible solutions. We tailor our approach to fit the exact needs of your commercial, office, or hospitality environment.",
        },
        vision: {
            title: "Our Vision",
            text: "To be your most trusted operational partner by cultivating clean, safe, and beautifully managed environments that naturally boost your team's productivity and business continuity.",
        },
    },
    why_facility_services: {
        title: "Why Choose Facility Services Demo?",
        points: [
            "Professional and deeply reliable service delivery",
            "Flexible solutions adapted perfectly to each client",
            "Clear, consistent supervision and quality control",
            "Specialized experience within the hospitality and commercial sectors",
            "A single, dedicated point of contact for multiple facility needs",
        ],
    },
    commitment: {
        title: "Our Commitment to You",
        description:
            "We are passionately committed to delivering high-quality services with meticulous attention to detail, complete transparency, and unwavering professionalism. We don't just complete tasks—we build structured, supportive environments that allow your business to grow with absolute confidence.",
    },
    methodology: {
        title: "How We Work",
        subtitle: "A disciplined process designed for continuity and measurable quality",
        steps: [
            {
                title: "Assessment",
                description: "We assess your operational context, current service level, and risk areas across people, spaces, and workflows.",
            },
            {
                title: "Service Planning",
                description: "We define a clear service scope, supervision structure, and execution cadence aligned with your business priorities.",
            },
            {
                title: "Execution",
                description: "Our teams deliver daily operations with professional oversight, reporting discipline, and consistent service standards.",
            },
            {
                title: "Continuous Improvement",
                description: "We monitor outcomes and continuously optimize service performance for stability, quality, and efficiency.",
            },
        ],
    },
    contact: {
        title: "Let's Get in Touch",
        subtitle: "Ready to streamline your facility operations?",
        description:
            "Reach out to us to discuss your commercial, office, or hospitality space. We're here to provide the essential support your organization needs to thrive.",
        form_title: "Request a Consultation",
        form_subtitle: "Provide your details and one of our specialists will respond with a tailored proposal.",
        fields: {
            name: "Full Name",
            company: "Company Name",
            email: "Work Email",
            phone: "Phone Number",
            facilitySize: "Facility Size",
            facilitySizeOptions: ["< 500 m²", "500 – 2,000 m²", "2,000 – 10,000 m²", "10,000+ m²", "Multiple Locations"],
            needs: "Primary Facility Needs",
            needsPlaceholder: "Describe your operational priorities, environment type, and required support...",
            submit: "Submit Request",
        },
        details: {
            email: "hello@facility-services.example.invalid",
            phone: "Not configured",
            address: "Configure during setup",
            kvk: "Not configured",
            supportHours: "Mon–Fri, 08:00–18:00",
        },
        trustItems: ["Professional intake", "Clear scope definition", "Transparent proposal", "Coordinated onboarding"],
        faq: [
            {
                question: "What types of organizations do you serve?",
                answer: "We support commercial offices, hospitality venues, and public spaces that require reliable operational continuity.",
            },
            {
                question: "Can services be tailored to our facility size and schedule?",
                answer: "Absolutely. We design flexible service plans based on your site profile, operating hours, and internal workflow requirements.",
            },
            {
                question: "Do you provide one point of contact across services?",
                answer: "Yes. Facility Services Demo provides centralized coordination so you can manage multiple facility needs through one dedicated, accountable partner.",
            },
            {
                question: "Where are your operations based?",
                answer: "Configure your real operating region and service coverage before publishing this template.",
            },
        ],
    },
    dashboard: {
        "dashboard.home.quickActions": "Facility Ops Quick Actions",
    },
};

// ============================================================================
// SAAS PRODUCT THEME - Technical, Innovative, Confident
// ============================================================================
export const saasProductTheme = {
    hero: {
        title: "Ship Faster. Scale Smarter.",
        subtitle: "The all-in-one platform that empowers teams to build, deploy, and iterate at lightning speed. No infrastructure headaches, just pure product velocity.",
        cta_primary: "Start Free Trial",
        cta_secondary: "Watch Demo",
    },
    features: {
        title: "Built for Modern Teams",
        subtitle: "Everything you need to go from idea to production in record time",
        items: [
            {
                title: "Real-time Collaboration",
                description: "Work together seamlessly with live cursors, instant sync, and conflict-free merging. Your team stays in perfect harmony.",
                icon: "users",
            },
            {
                title: "Enterprise-Grade Security",
                description: "SOC 2 Type II certified with end-to-end encryption. Your data is protected by the same standards used by Fortune 500 companies.",
                icon: "shield",
            },
            {
                title: "Lightning Performance",
                description: "Sub-100ms response times globally. Our edge infrastructure ensures your users get a blazing-fast experience everywhere.",
                icon: "zap",
            },
            {
                title: "API-First Architecture",
                description: "RESTful and GraphQL APIs with comprehensive webhooks. Integrate with your existing stack in minutes, not months.",
                icon: "code",
            },
            {
                title: "Intelligent Analytics",
                description: "Actionable insights powered by machine learning. Understand user behavior, predict churn, and optimize conversions automatically.",
                icon: "bar-chart",
            },
            {
                title: "Infinite Scalability",
                description: "From zero to millions of users without breaking a sweat. Auto-scaling infrastructure that grows with your success.",
                icon: "trending-up",
            },
        ],
    },
    pricing: {
        title: "Simple, Transparent Pricing",
        subtitle: "Start free, scale as you grow. No hidden fees, no surprises.",
        tiers: [
            {
                name: "Starter",
                price: "0",
                period: "forever",
                features: [
                    "Up to 3 team members",
                    "5 projects",
                    "10GB storage",
                    "Community support",
                    "Basic analytics",
                ],
                cta: "Get Started Free",
                popular: false,
            },
            {
                name: "Pro",
                price: "49",
                period: "per user/month",
                features: [
                    "Unlimited team members",
                    "Unlimited projects",
                    "100GB storage",
                    "Priority support",
                    "Advanced analytics",
                    "Custom integrations",
                    "SSO authentication",
                ],
                cta: "Start 14-Day Trial",
                popular: true,
            },
            {
                name: "Enterprise",
                price: "Custom",
                period: "tailored to you",
                features: [
                    "Everything in Pro",
                    "Unlimited storage",
                    "Dedicated support",
                    "SLA guarantee",
                    "On-premise deployment",
                    "Custom contracts",
                    "Security audits",
                ],
                cta: "Contact Sales",
                popular: false,
            },
        ],
    },
    testimonials: {
        title: "Trusted by Industry Leaders",
        items: [
            {
                quote: "We reduced our deployment time from 2 hours to 8 minutes. The ROI was immediate and undeniable.",
                author: "Sarah Chen",
                role: "VP of Engineering",
                company: "TechFlow Inc.",
            },
            {
                quote: "The platform's scalability helped us handle a 10x traffic spike during Black Friday without a single hiccup.",
                author: "Marcus Rodriguez",
                role: "CTO",
                company: "RetailBoost",
            },
            {
                quote: "Finally, a tool that our developers actually enjoy using. Adoption was organic and enthusiastic.",
                author: "Emily Watson",
                role: "Director of Product",
                company: "Innovate Labs",
            },
        ],
    },
    stats: {
        items: [
            { value: "99.99%", label: "Uptime SLA" },
            { value: "50ms", label: "Avg Response Time" },
            { value: "10K+", label: "Active Teams" },
            { value: "180+", label: "Countries Served" },
        ],
    },
    cta: {
        title: "Ready to Accelerate Your Development?",
        subtitle: "Join thousands of teams shipping faster with our platform. Start your free trial today.",
        button_text: "Start Building Now",
    },
    about: {
        title: "About",
        headline: "Built by product teams that were tired of waiting on infrastructure",
        description:
            "We created this platform after scaling multi-product organizations where speed, reliability, and governance constantly collided. Our mission is simple: give growing teams enterprise-grade foundations without enterprise drag. Every release is designed to shorten time-to-value, improve developer confidence, and keep business stakeholders aligned on outcomes.",
    },
    services: {
        title: "Services",
        subtitle: "Product acceleration services for teams that need momentum now",
        description:
            "Beyond the core platform, we provide implementation support, migration strategy, architecture reviews, and workflow automation sprints. Whether you're replacing legacy tooling or launching a new product line, we help your team deliver faster with fewer handoff bottlenecks.",
    },
    contact: {
        title: "Contact",
        subtitle: "Book a tailored demo for your stack and growth stage",
        description:
            "Tell us about your current toolchain, team size, and release goals. We'll map a practical adoption path, highlight integration options, and show exactly where your biggest time savings come from.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Product Ops Quick Actions",
    },
};

// ============================================================================
// RESTAURANT THEME - Elegant, Sensory, Inviting
// ============================================================================
export const restaurantTheme = {
    hero: {
        title: "A Culinary Journey Through the Senses",
        subtitle: "Experience the art of fine dining where every dish tells a story, every sip awakens memories, and every moment becomes a cherished memory.",
        cta_text: "Reserve Your Table",
    },
    menu: {
        title: "Our Menu",
        subtitle: "Crafted with passion, sourced with purpose",
        categories: [
            {
                name: "Starters",
                items: [
                    {
                        name: "Burrata di Puglia",
                        description: "Creamy burrata with heirloom tomatoes, aged balsamic reduction, and fresh basil from our garden",
                        price: "18",
                    },
                    {
                        name: "Seared Scallops",
                        description: "Hokkaido scallops caramelized to perfection, served on cauliflower purée with black truffle shavings",
                        price: "24",
                    },
                    {
                        name: "Tuna Tartare",
                        description: "Line-caught yellowfin tuna, avocado mousse, sesame crunch, and yuzu kosho dressing",
                        price: "22",
                    },
                ],
            },
            {
                name: "Mains",
                items: [
                    {
                        name: "Wagyu Ribeye",
                        description: "A5 Japanese Wagyu, 45-day dry-aged, grilled over binchōtan charcoal, served with roasted bone marrow",
                        price: "95",
                    },
                    {
                        name: "Dover Sole Meunière",
                        description: "Whole Dover sole, brown butter, capers, lemon, and parsley, tableside filleted",
                        price: "68",
                    },
                    {
                        name: "Lamb Rack",
                        description: "New Zealand lamb, herb-crusted, rosemary-infused jus, with root vegetable gratin",
                        price: "52",
                    },
                ],
            },
            {
                name: "Desserts",
                items: [
                    {
                        name: "Chocolate Soufflé",
                        description: "Valrhona chocolate soufflé with crème anglaise and gold leaf",
                        price: "16",
                    },
                    {
                        name: "Crème Brûlée",
                        description: "Tahitian vanilla bean custard, caramelized sugar crust, fresh berries",
                        price: "14",
                    },
                    {
                        name: "Cheese Selection",
                        description: "Curated selection of five artisanal cheeses, honeycomb, and house-made crackers",
                        price: "24",
                    },
                ],
            },
        ],
    },
    chef: {
        title: "Meet Our Chef",
        name: "Chef Alessandro Moretti",
        bio: "With over two decades of culinary excellence across Michelin-starred kitchens in Milan, Paris, and Tokyo, Chef Alessandro brings a symphony of flavors to every plate. His philosophy is simple: respect the ingredients, honor the traditions, and create moments of pure joy.",
        signature_dish: "Lobster Risotto with Saffron and Champagne",
    },
    gallery: {
        title: "A Feast for the Eyes",
        images: [
            { alt: "Elegant dining room with crystal chandeliers and intimate lighting" },
            { alt: "Chef Alessandro plating his signature lobster risotto" },
            { alt: "Fresh seasonal ingredients from local farms" },
            { alt: "Artfully presented dessert with gold leaf garnish" },
            { alt: "Private dining room for special celebrations" },
            { alt: "Sunlit terrace overlooking the garden" },
        ],
    },
    reservation: {
        title: "Reserve Your Experience",
        subtitle: "Join us for an unforgettable evening. We recommend booking at least 2 weeks in advance for weekend dining.",
        button_text: "Book a Table",
    },
    about: {
        title: "About",
        headline: "Seasonal cuisine, refined hospitality, and memorable evenings",
        description:
            "Our restaurant was founded on a simple promise: serve exceptional food with warm, attentive service in a setting that invites connection. We source from trusted producers, design menus around peak-season ingredients, and train every team member to deliver thoughtful hospitality from first welcome to final course.",
    },
    services: {
        title: "Services",
        subtitle: "Dining and event experiences crafted around your occasion",
        description:
            "Enjoy à la carte dining, signature tasting menus, private dining rooms, and chef-led event packages. We also design curated wine pairings and personalized celebration menus for corporate dinners, anniversaries, and intimate gatherings.",
    },
    contact: {
        title: "Contact",
        subtitle: "Reserve a table, plan a private event, or request a custom menu",
        description:
            "Share your preferred date, group size, and occasion details. Our reservations team will confirm availability and guide you to the best dining option for your experience.",
    },
    testimonials: {
        title: "What Our Guests Say",
        items: [
            {
                quote: "An extraordinary evening from start to finish. The Wagyu was transcendent, and the service was impeccable.",
                author: "Jonathan & Elizabeth M.",
                rating: 5,
            },
            {
                quote: "We celebrated our anniversary here and it exceeded every expectation. A truly magical experience.",
                author: "Sophie van der Berg",
                rating: 5,
            },
            {
                quote: "The tasting menu was a journey through flavors I never knew existed. Chef Alessandro is a genius.",
                author: "Michael Thompson",
                rating: 5,
            },
        ],
    },
    dashboard: {
        "dashboard.home.quickActions": "Hospitality Quick Actions",
    },
};

// ============================================================================
// ECOMMERCE THEME - Urgent, Benefit-Focused, Trust-Building
// ============================================================================
export const ecommerceTheme = {
    hero: {
        title: "Premium Quality, Unbeatable Prices",
        subtitle: "Discover curated collections of premium products, handpicked for discerning customers who demand the best. Free shipping on orders over €50.",
        cta_text: "Shop New Arrivals",
    },
    banner: {
        text: "🎉 Winter Sale: Up to 40% off selected items. Limited time only!",
        link_text: "Shop the Sale",
    },
    categories: {
        title: "Shop by Category",
        items: [
            {
                name: "Electronics",
                description: "Latest gadgets and tech essentials from top brands",
                image_alt: "Premium electronics including smartphones, laptops, and accessories",
            },
            {
                name: "Fashion",
                description: "Curated styles from emerging designers and established labels",
                image_alt: "Fashion collection featuring contemporary clothing and accessories",
            },
            {
                name: "Home & Living",
                description: "Transform your space with our premium home collection",
                image_alt: "Elegant home decor and furniture pieces",
            },
            {
                name: "Sports & Outdoors",
                description: "Gear up for adventure with performance equipment",
                image_alt: "Sports equipment and outdoor gear for active lifestyles",
            },
        ],
    },
    products: {
        title: "Trending Now",
        filter_all: "All Products",
        items: [
            {
                name: "Wireless Noise-Cancelling Headphones Pro",
                description: "Immersive audio with 40-hour battery life and adaptive noise cancellation",
                price: "299",
                sale_price: "229",
                badge: "Best Seller",
            },
            {
                name: "Minimalist Leather Backpack",
                description: "Handcrafted Italian leather, laptop compartment, timeless design",
                price: "189",
                sale_price: null,
                badge: null,
            },
            {
                name: "Smart Fitness Watch Series X",
                description: "Advanced health monitoring, GPS, and 7-day battery life",
                price: "449",
                sale_price: "379",
                badge: "New",
            },
            {
                name: "Organic Cotton Bedding Set",
                description: "100% GOTS certified organic cotton, 400 thread count luxury",
                price: "159",
                sale_price: null,
                badge: "Eco-Friendly",
            },
            {
                name: "Professional Chef's Knife Set",
                description: "Japanese VG-10 steel, 6-piece collection with magnetic block",
                price: "349",
                sale_price: "289",
                badge: null,
            },
            {
                name: "Portable 4K Projector",
                description: "Cinema-quality projection, built-in speakers, streaming apps",
                price: "599",
                sale_price: "499",
                badge: "Hot Deal",
            },
        ],
    },
    newsletter: {
        title: "Join the Inner Circle",
        subtitle: "Get exclusive access to sales, new arrivals, and insider perks. 15% off your first order when you sign up.",
        placeholder: "Enter your email address",
        button_text: "Join Now",
    },
    trust: {
        items: [
            {
                title: "Free Shipping",
                description: "On all orders over €50. Fast delivery to 30+ countries.",
            },
            {
                title: "30-Day Returns",
                description: "Not satisfied? Return any item within 30 days, no questions asked.",
            },
            {
                title: "Secure Checkout",
                description: "256-bit SSL encryption. Your payment data is always protected.",
            },
            {
                title: "24/7 Support",
                description: "Our customer happiness team is here whenever you need us.",
            },
        ],
    },
    about: {
        title: "About",
        headline: "A curated commerce brand built for confident buying decisions",
        description:
            "We combine premium product selection, transparent pricing, and reliable fulfillment to make shopping effortless. Our buying team tests quality, reviews supplier consistency, and prioritizes products customers keep and love—not impulse items that disappoint after delivery.",
    },
    services: {
        title: "Services",
        subtitle: "Shopping services designed for convenience, value, and repeat trust",
        description:
            "From personalized product recommendations to gifting support and wholesale guidance, we help customers and business buyers purchase with clarity. Fast logistics, responsive support, and a straightforward returns experience keep every order low-friction.",
    },
    contact: {
        title: "Contact",
        subtitle: "Get support for orders, recommendations, returns, and wholesale",
        description:
            "Send us your order details or product goals and our team will respond with practical next steps. We resolve most inquiries quickly with clear options and zero runaround.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Commerce Quick Actions",
    },
};

// ============================================================================
// NONPROFIT THEME - Emotional, Urgent, Hopeful
// ============================================================================
export const nonprofitTheme = {
    hero: {
        title: "Together, We Can Change Lives",
        subtitle: "Every action counts. Every donation matters. Join us in building a world where everyone has the opportunity to thrive.",
        cta_text: "Make a Difference Today",
    },
    impact: {
        title: "Our Impact in Numbers",
        stats: [
            { value: "50,000+", label: "Lives Transformed" },
            { value: "32", label: "Countries Reached" },
            { value: "94¢", label: "of Every Dollar Goes to Programs" },
            { value: "15+", label: "Years of Service" },
        ],
    },
    mission: {
        title: "Our Mission",
        description: "We believe that every person deserves access to clean water, quality education, and basic healthcare. Our mission is to empower communities worldwide through sustainable programs that create lasting change. We work hand-in-hand with local leaders to ensure our initiatives are culturally appropriate, environmentally responsible, and economically viable for generations to come.",
    },
    donate: {
        title: "Your Generosity Changes Everything",
        tiers: [
            {
                amount: "25",
                description: "Provides clean water for one family for an entire month",
                benefits: ["Email updates", "Digital thank you card"],
            },
            {
                amount: "75",
                description: "Supplies a child with school supplies and uniforms for a year",
                benefits: ["Quarterly impact reports", "Photo updates from the field"],
            },
            {
                amount: "150",
                description: "Funds a micro-loan that helps a family start their own business",
                benefits: ["Personal story of impact", "Annual report", "Exclusive webinars"],
            },
            {
                amount: "500",
                description: "Sponsors a complete medical checkup camp in a rural village",
                benefits: ["Direct communication with beneficiaries", "Recognition in annual report", "VIP event invitations"],
            },
        ],
        custom_label: "Or enter a custom amount",
        button_text: "Donate Now",
    },
    programs: {
        title: "Our Programs",
        items: [
            {
                name: "Clean Water Initiative",
                description: "Building sustainable water infrastructure in underserved communities, providing safe drinking water to thousands.",
                progress: 78,
                goal: "100 wells by 2026",
            },
            {
                name: "Education for All",
                description: "Supporting schools, training teachers, and providing scholarships to children in developing regions.",
                progress: 65,
                goal: "10,000 students enrolled",
            },
            {
                name: "Healthcare Outreach",
                description: "Mobile clinics and health education programs bringing essential medical care to remote areas.",
                progress: 82,
                goal: "50,000 patients served",
            },
            {
                name: "Women's Empowerment",
                description: "Vocational training and micro-enterprise support helping women achieve financial independence.",
                progress: 71,
                goal: "5,000 women trained",
            },
        ],
    },
    volunteer: {
        title: "Give Your Time, Change the World",
        description: "Whether you have a few hours a month or want to join us in the field, there's a place for you in our community. Volunteers are the heart of our organization.",
        button_text: "Become a Volunteer",
    },
    partners: {
        title: "Trusted by Leading Organizations",
        logos: [
            { name: "United Nations Foundation" },
            { name: "Bill & Melinda Gates Foundation" },
            { name: "World Health Organization" },
            { name: "UNICEF" },
            { name: "Red Cross" },
            { name: "Doctors Without Borders" },
        ],
    },
    about: {
        title: "About",
        headline: "Community-led programs that turn generosity into lasting progress",
        description:
            "We work alongside local leaders to design practical, culturally grounded initiatives that families can sustain long after launch. By combining transparent governance, strong field partnerships, and evidence-based planning, we ensure every contribution creates measurable impact where it is needed most.",
    },
    services: {
        title: "Services",
        subtitle: "Support pathways for donors, partners, volunteers, and communities",
        description:
            "Our team coordinates program delivery, case referrals, volunteer onboarding, and institutional partnerships. Whether you're an individual donor or a mission-aligned organization, we provide clear engagement options tied to defined outcomes.",
    },
    contact: {
        title: "Contact",
        subtitle: "Partner, volunteer, refer a case, or support a live program",
        description:
            "Tell us how you want to contribute and where your priorities lie. We'll connect you with the right coordinator and share immediate ways to create impact.",
    },
    dashboard: {
        "dashboard.home.quickActions": "Impact Quick Actions",
    },
};

// ============================================================================
// CREATIVE AGENCY THEME - Bold, Innovative, Artistic
// ============================================================================
export const creativeAgencyTheme = {
    hero: {
        title: "We Create Brands That People Love",
        subtitle: "Award-winning design studio crafting bold identities, immersive digital experiences, and campaigns that captivate and convert.",
        cta_text: "View Our Work",
    },
    clients: {
        title: "Trusted by Visionaries",
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
        title: "Selected Work",
        items: [
            {
                title: "Nova Finance",
                category: "Brand Identity",
                description: "Complete rebrand for a fintech startup, from logo system to app interface. Result: 300% increase in user signups.",
            },
            {
                title: "Urban Threads",
                category: "E-commerce Experience",
                description: "End-to-end digital transformation for a sustainable fashion brand, including AR try-on feature.",
            },
            {
                title: "Mindful App",
                category: "Product Design",
                description: "Meditation app with personalized journeys. Featured as App of the Day in 45 countries.",
            },
            {
                title: "Green Earth Initiative",
                category: "Campaign",
                description: "Multi-platform awareness campaign that reached 50M+ people and drove 200K petition signatures.",
            },
            {
                title: "Artisan Coffee Co.",
                category: "Packaging & Retail",
                description: "Sensorial brand experience across packaging, retail spaces, and digital touchpoints.",
            },
            {
                title: "Tech Summit 2025",
                category: "Event Design",
                description: "Immersive conference identity with interactive installations and digital wayfinding.",
            },
        ],
    },
    services: {
        title: "What We Do",
        subtitle: "Creative systems built to scale brand impact across channels",
        description:
            "We structure strategy, design, and production into collaborative sprints that reduce revision cycles and accelerate launch readiness. The result is cohesive brand execution from campaign concept to digital rollout.",
        items: [
            {
                name: "Brand Strategy",
                description: "Research-driven positioning that defines your unique voice and visual language in the market.",
            },
            {
                name: "Visual Identity",
                description: "Logo systems, typography, color palettes, and comprehensive brand guidelines that scale.",
            },
            {
                name: "Digital Design",
                description: "Websites, apps, and digital products that combine stunning aesthetics with intuitive UX.",
            },
            {
                name: "Motion & Film",
                description: "Animated content, commercials, and brand films that bring stories to life.",
            },
            {
                name: "Campaign Development",
                description: "Integrated marketing campaigns across all channels with measurable impact.",
            },
            {
                name: "Experience Design",
                description: "Immersive physical and virtual experiences that create lasting impressions.",
            },
        ],
    },
    about: {
        title: "We're Not Just a Studio. We're Your Creative Partners.",
        headline: "Independent studio energy with enterprise-grade creative delivery",
        description:
            "Founded in 2015, we've grown from a two-person team to a collective of strategists, designers, motion artists, and technologists. We help ambitious brands clarify positioning, sharpen visual language, and launch campaigns that move people to act. Our process balances artistic originality with performance metrics, so bold ideas become measurable business growth.",
    },
    contact: {
        title: "Contact",
        subtitle: "Let's make something extraordinary",
        description:
            "Share your challenge, timeline, and ambition level. We'll recommend the right engagement model and map a clear path from brief to launch.",
        fields: [
            { label: "Your Name", placeholder: "John Smith" },
            { label: "Email Address", placeholder: "john@company.com" },
            { label: "Project Type", placeholder: "Brand Identity, Website, Campaign..." },
            { label: "Tell Us About Your Project", placeholder: "Share your vision, goals, and timeline..." },
        ],
        button_text: "Start a Conversation",
    },
    dashboard: {
        "dashboard.home.quickActions": "Studio Quick Actions",
    },
};

export const isystemAgencyTheme = {
    brand: {
        company: "iSystem.ai",
        serviceLine: "AI-enabled digital systems consultancy",
        slogan: "Customized digital systems for businesses that want sharper execution.",
        year: "2026",
    },
    dashboard: {
        "dashboard.home.themeNote": "iSystem edition active",
        "dashboard.modules.opportunities.description": "Continuously surface SEO gaps, content opportunities, and conversion weak points across this workspace.",
        "dashboard.modules.generate.description": "Generate founder-led positioning, solution pages, sector briefs, and AI automation content.",
    },
    home: {
        title: "Build smarter systems with AI.",
        subtitle: "A Netherlands-based partner for AI integration, automation, web development, and business management consultancy.",
    },
    services: {
        title: "What we build",
        subtitle: "Digital systems for SMEs and enterprise support teams",
    },
    about: {
        title: "About iSystem.ai",
        headline: "Founder-led systems delivery amplified by AI agents",
        description: "Lean by design, structured by systems thinking, and built to improve real operations.",
    },
    contact: {
        title: "Let’s discuss your system",
        subtitle: "Share your operational challenge and we’ll map the right next step.",
    },
};

// ============================================================================
// PERSONAL BRAND THEME - Charismatic, Joyful, Growth-Oriented
// ============================================================================
export const personalBrandTheme = {
    hero: {
        title: "Become the \"Stealth CTO\" of Your Industry. Build Bespoke Micro-SaaS in a Weekend.",
        subtitle: "You do not need to spend two years learning syntax. You do not need to surrender equity to a technical co-founder. You need architectural logic. Master autonomous AI coding agents like Cursor, Claude Code, and Windsurf to turn your deep industry expertise into profitable, automated software—using nothing but natural language and strategic orchestration.",
        video_placeholder: "Watch the Free Weekend Build Masterclass",
        badge: "The era of the $35,000 agency MVP is dead. The era of the 100x Orchestrator has arrived.",
    },
    stats: {
        items: [
            { value: "150k+", label: "Global Learners" },
            { value: "12+", label: "Years Experience" },
            { value: "3", label: "Countries Built In" },
            { value: "100x", label: "Orchestration" },
        ],
    },
    problem: {
        title: "Vibe Coding is Pure Magic. Until it Becomes an Architectural Nightmare.",
        subtitle: "The Vibe Ceiling",
        description: "Once your application scales beyond a single landing page, the magic hits a brutal limitation known as the \"Vibe Ceiling.\" The AI's contextual memory becomes overcrowded. It begins to hallucinate. You ask the agent to fix a simple frontend login bug, and it accidentally deletes your entire database routing schema. Suddenly, you are burning through expensive API credits and wasting dozens of hours trapped in an endless, chaotic \"vibe debugging\" loop.",
        quote: "A novice vibe coder just says 'fix the app.' A Stealth CTO provides the exact architectural roadmap."
    },
    solution: {
        title: "Stop Typing Syntax. Start Orchestrating Systems.",
        subtitle: "The Stealth CTO Methodology",
        description: "A Stealth CTO does not write code. They manage a fleet of elite, autonomous AI agents. They provide the strategic constraints, the architectural vision, and the deep industry knowledge that artificial intelligence inherently lacks.",
        items: [
            {
                name: "Repository Intelligence",
                description: "Move beyond single-prompt chatbots. Learn to deploy Claude Code and Cursor to map your entire project architecture.",
            },
            {
                name: "Multi-Agent Orchestration",
                description: "Stop relying on one AI model to do everything. Learn to deploy specialized sub-agents—one optimized for UI design, one for backend logic, and one for security auditing.",
            },
            {
                name: "Real-World Plumbing",
                description: "Master the complex APIs that actually generate revenue. Connect Stripe, Supabase, and Resend without breaking your codebase.",
            },
            {
                name: "The Weekend Build Protocol",
                description: "Move from idea validation on Friday night to a fully deployed, revenue-generating Micro-SaaS by Sunday evening.",
            },
        ],
    },
    youtube: {
        title: "Watch the Process. We Build in Public.",
        subtitle: "The YouTube Bridge",
        description: "Theoretical knowledge is entirely useless without raw execution. On my YouTube channel, I pull back the curtain on the exact workflows, IDE configurations, and prompt architectures I use to ship real, profitable products. No hype. No AI-generated \"slop.\" Just transparent, over-the-shoulder engineering.",
        videos: [
            {
                title: "I Tried Every AI Agent in 2026. Here is the Ultimate Stealth CTO Stack.",
                link_text: "Watch Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
                title: "Breaking the Vibe Ceiling: How to Stop AI from Destroying Your Code.",
                link_text: "Watch Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
            {
                title: "Building a Niche CRM for Fitness Coaches in 48 Hours.",
                link_text: "Watch Video",
                href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            },
        ],
    },
    about: {
        title: "About",
        headline: "The story behind the work",
        description: "Use this section to explain the experience, perspective, and practical results behind your personal brand.",
        philosophy_title: "The Vision",
        philosophy_p1: "Describe the belief that guides your work and the problem you are committed to solving for your audience.",
        philosophy_p2: "Connect that belief to the methods, knowledge, and outcomes people can expect from you.",
    },
    newsletter: {
        title: "Are You Ready to Orchestrate?",
        description: "The market is not waiting for you to learn Python. Grab your free Stealth CTO Toolkit today, featuring my exact Cursor IDE settings, proven AI prompt architectures, and the complete Weekend Build Blueprint.",
        placeholder: "Enter your best email address",
        button_text: "Grab Toolkit",
    },
    dashboard: {
        "dashboard.home.quickActions": "Stealth CTO Quick Actions",
    },
};

/** English dictionary — theme-specific overrides. */
export const enThemes: Record<ThemeDictionaryKey, Record<string, string>> = {
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
