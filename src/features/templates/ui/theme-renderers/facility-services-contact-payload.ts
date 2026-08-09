export interface FacilityServicesContactFormData {
    name: string;
    company: string;
    email: string;
    phone: string;
    facilitySize: string;
    needs: string;
    website: string;
    formStartedAt: string;
}

export function buildFacilityServicesContactPayload(
    formData: FacilityServicesContactFormData,
    templateId: string,
    locale: "en" | "nl",
) {
    const facilityContext = formData.facilitySize.trim()
        ? `Facility size: ${formData.facilitySize.trim()}`
        : "";

    return {
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        requestType: "facility-services-consultation",
        challenge: [facilityContext, formData.needs.trim()].filter(Boolean).join("\n\n"),
        website: formData.website,
        formStartedAt: formData.formStartedAt,
        templateId,
        locale,
        marketingConsent: false,
    };
}
