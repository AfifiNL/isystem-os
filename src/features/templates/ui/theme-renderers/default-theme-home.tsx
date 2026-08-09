import { SectionRenderer } from "@/features/templates/ui/section-renderer";
import type { HomeSectionDescriptor } from "@/features/templates/types";

interface DefaultThemeHomeProps {
    sections: HomeSectionDescriptor[];
}

export function DefaultThemeHome({ sections }: DefaultThemeHomeProps) {
    return <SectionRenderer sections={sections} />;
}

