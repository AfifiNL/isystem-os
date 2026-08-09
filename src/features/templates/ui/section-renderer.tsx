import React from "react";
import { TemplateHero } from "./template-hero";
import { FeaturesGrid } from "@/features/marketing/ui/home/features-grid";
import { SocialProof } from "@/features/marketing/ui/home/social-proof";
import { ContentPreview } from "@/features/marketing/ui/home/content-preview";
import { NewsletterCTA } from "@/features/marketing/ui/home/newsletter-cta";

// Facility Services Template Specific Sections
import { ServicesGrid } from "@/features/templates/pages/facility-services/services-grid";
import { TestimonialsCarousel } from "@/features/templates/pages/facility-services/testimonials-carousel";
import { ServiceAreas } from "@/features/templates/pages/facility-services/service-areas";
import { QuoteRequestForm } from "@/features/templates/pages/facility-services/quote-request-form";
import { ProjectsPreview } from "@/features/templates/pages/facility-services/projects-preview";

// Placeholder component for missing sections
const PlaceholderSection = ({ componentName, props }: { componentName: string; props?: Record<string, unknown> }) => (
    <section className="py-20 border-y border-dashed border-border/50 bg-muted/10 my-10">
        <div className="container mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2">Section: {componentName}</h2>
            <p className="text-muted-foreground mb-4">This section is not yet implemented.</p>
            {props && <pre className="text-start bg-black/5 p-4 rounded-xl text-xs max-w-2xl mx-auto overflow-auto">{JSON.stringify(props, null, 2)}</pre>}
        </div>
    </section>
);

// Registry mapping section names to components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTION_REGISTRY: Record<string, React.ComponentType<any>> = {
    HeroSection: TemplateHero,
    FeaturesGrid,
    SocialProof,
    ContentPreview,
    NewsletterCTA,
    ServicesGrid,
    TestimonialsCarousel,
    ServiceAreas,
    QuoteRequestForm,
    ProjectsPreview,
    // We will add more sections here as we build them out
};

export function SectionRenderer({ sections }: { sections: Array<{ component: string; props?: Record<string, unknown> }> }) {
    return (
        <>
            {sections.map((section, index) => {
                const Component = SECTION_REGISTRY[section.component];

                if (!Component) {
                    return <PlaceholderSection key={`${section.component}-${index}`} componentName={section.component} props={section.props} />;
                }

                return <Component key={`${section.component}-${index}`} {...section.props} />;
            })}
        </>
    );
}
