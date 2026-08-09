export type LinkedinActorKind = "linkedin_profile" | "linkedin_company" | "linkedin_employees" | "linkedin_posts";


// Defaults prefer public/no-cookie actors where the Apify listing advertises
// that posture. Employee discovery has no safe default because actor inputs
// vary widely; require an explicit env choice before enabling it.
const DEFAULT_LINKEDIN_PROFILE_ACTOR = "anchor/linkedin-profile-enrichment";
const DEFAULT_LINKEDIN_COMPANY_ACTOR = "apimaestro/linkedin-company-detail";
const DEFAULT_LINKEDIN_EMPLOYEES_ACTOR = "";
const DEFAULT_LINKEDIN_POSTS_ACTOR = "scraper-engine/linkedin-company-post-scraper";

function requireActorId(kind: LinkedinActorKind, actorId: string | null | undefined): string {
    const value = actorId?.trim();
    if (!value) {
        throw new Error(`Apify LinkedIn actor is not configured for ${kind}. Set APIFY_${kind.toUpperCase()}_ACTOR_ID before queueing this enrichment.`);
    }
    return value;
}

export function getLinkedinActorId(kind: LinkedinActorKind): string {
    switch (kind) {
        case "linkedin_profile":
            return requireActorId(kind, process.env.APIFY_LINKEDIN_PROFILE_ACTOR_ID ?? DEFAULT_LINKEDIN_PROFILE_ACTOR);
        case "linkedin_company":
            return requireActorId(kind, process.env.APIFY_LINKEDIN_COMPANY_ACTOR_ID ?? DEFAULT_LINKEDIN_COMPANY_ACTOR);
        case "linkedin_employees":
            return requireActorId(kind, process.env.APIFY_LINKEDIN_EMPLOYEES_ACTOR_ID ?? DEFAULT_LINKEDIN_EMPLOYEES_ACTOR);
        case "linkedin_posts":
            return requireActorId(kind, process.env.APIFY_LINKEDIN_POSTS_ACTOR_ID ?? DEFAULT_LINKEDIN_POSTS_ACTOR);
    }
}

// Helper functions for safe type conversion
function stringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(item: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const val = stringValue(item[key]);
        if (val) return val;
    }
    return null;
}

// --- Mappers ---

export type MappedLinkedinProfile = {
    fullName: string | null;
    roleTitle: string | null;
    profileUrl: string | null;
    summary: string | null;
    skills: string[];
    experience: Array<{
        companyName: string | null;
        title: string | null;
        description: string | null;
    }>;
};

export function mapLinkedinProfileItem(rawItem: unknown): MappedLinkedinProfile {
    const item = asRecord(rawItem);
    const firstName = firstString(item, ["firstName", "first_name"]);
    const lastName = firstString(item, ["lastName", "last_name"]);
    const fullName = firstString(item, ["fullName", "name", "fullNameEnglish"]) ??
        (firstName && lastName ? `${firstName} ${lastName}` : null);

    const roleTitle = firstString(item, ["headline", "title", "occupation", "position"]);
    const profileUrl = firstString(item, ["url", "linkedinUrl", "profileUrl", "linkedin_url"]);
    const summary = firstString(item, ["summary", "about", "bio"]);

    // Map experience
    const rawExp = Array.isArray(item.experience) ? item.experience :
                   Array.isArray(item.positions) ? item.positions : [];
    const experience = rawExp.map((exp: unknown) => {
        const rec = asRecord(exp);
        return {
            companyName: firstString(rec, ["companyName", "company", "company_name"]),
            title: firstString(rec, ["title", "position", "role"]),
            description: firstString(rec, ["description", "summary", "role_description"]),
        };
    }).filter(e => e.companyName || e.title);

    // Map skills
    const rawSkills = Array.isArray(item.skills) ? item.skills : [];
    const skills = rawSkills.map((s: unknown) => {
        if (typeof s === "string") return s;
        const rec = asRecord(s);
        return firstString(rec, ["name", "skill", "title"]) || "";
    }).filter(Boolean);

    return {
        fullName,
        roleTitle,
        profileUrl,
        summary,
        skills,
        experience,
    };
}

export type MappedLinkedinCompany = {
    name: string;
    websiteUrl: string | null;
    domain: string | null;
    description: string | null;
    industry: string | null;
    size: string | null;
    country: string | null;
};

export function mapLinkedinCompanyItem(rawItem: unknown): MappedLinkedinCompany | null {
    const item = asRecord(rawItem);
    const name = firstString(item, ["name", "companyName", "title"]);
    if (!name) return null;

    const websiteUrl = firstString(item, ["website", "websiteUrl", "companyWebsite", "companyUrl"]);
    let domain: string | null = null;
    if (websiteUrl) {
        try {
            domain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
        } catch {
            // ignore
        }
    }

    const description = firstString(item, ["description", "about", "aboutCompany", "summary"]);
    const industry = firstString(item, ["industry", "sector", "companyType"]);
    const size = firstString(item, ["staffCount", "companySize", "employeesCount", "size"]) ??
                 (typeof item.employeesCount === "number" ? String(item.employeesCount) : null);

    const rawLoc = asRecord(item.headquarters ?? item.location);
    const country = firstString(rawLoc, ["country", "countryCode"]) ?? firstString(item, ["country", "location"]);

    return {
        name,
        websiteUrl,
        domain,
        description,
        industry,
        size,
        country,
    };
}

export type MappedLinkedinEmployee = {
    fullName: string;
    roleTitle: string | null;
    profileUrl: string | null;
};

export function mapLinkedinEmployeeItem(rawItem: unknown): MappedLinkedinEmployee | null {
    const item = asRecord(rawItem);
    const fullName = firstString(item, ["fullName", "name", "title"]);
    if (!fullName) return null;

    const roleTitle = firstString(item, ["headline", "title", "occupation", "position"]);
    const profileUrl = firstString(item, ["url", "linkedinUrl", "profileUrl", "linkedin_url"]);

    return {
        fullName,
        roleTitle,
        profileUrl,
    };
}

export type MappedLinkedinPost = {
    text: string;
    url: string | null;
    postedAt: string | null;
};

export function mapLinkedinPostItem(rawItem: unknown): MappedLinkedinPost | null {
    const item = asRecord(rawItem);
    const text = firstString(item, ["text", "content", "body", "description"]);
    if (!text) return null;

    const url = firstString(item, ["url", "postUrl", "linkedinPostUrl"]);
    const postedAt = firstString(item, ["postedAt", "timestamp", "date", "createdTime"]) ??
                     (item.timestamp ? new Date(Number(item.timestamp)).toISOString() : null);

    return {
        text,
        url,
        postedAt,
    };
}
