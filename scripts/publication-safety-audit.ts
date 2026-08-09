import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface PublicationSafetyPattern {
    id: string;
    severity: "banned_label" | "high_risk_claim" | "needs_context";
    description: string;
    pattern: RegExp;
}

export interface PublicationSafetyMatch {
    file: string;
    line: number;
    patternId: string;
    severity: PublicationSafetyPattern["severity"];
    description: string;
    excerpt: string;
}

export interface PublicationSafetyMetadataIssue {
    file: string;
    visualId: string;
    code: string;
    severity: "banned_label" | "high_risk_claim" | "needs_context";
    description: string;
}

export interface ArticleTrustAuditIssue {
    file: string;
    code: string;
    severity: "high_risk_claim" | "needs_context";
    description: string;
    details?: Record<string, string | number | boolean>;
}

export const TARGET_ARTICLE_THEMES = [
    "W2 Model",
    "Dashboard Era",
    "System of Action",
    "Agency Stack / AI Operating System",
    "Traditional Web Agencies comparison",
    "Client SLA Dashboard",
    "Governed AI Ledger",
] as const;

export const EXPECTED_ARTICLE_SLUGS = [
    "from-agency-stack-to-ai-operating-system-redefining-agency-growth",
    "isystemai-vs-traditional-web-agencies-a-complete-comparison",
    "scaling-up-safely-governed-ai-ledger",
] as const;

export const PUBLICATION_SAFETY_PATTERNS: readonly PublicationSafetyPattern[] = [
    {
        id: "placeholder-ai-research-synthesis-label",
        severity: "banned_label",
        description: "Placeholder source labels must not be published; use real evidence metadata or leave source fields empty.",
        pattern: /\bAI\s+research\s+synthesis\b/i,
    },
    {
        id: "placeholder-ai-synthesis-label",
        severity: "banned_label",
        description: "Placeholder synthesis labels are not acceptable source labels; use framework, synthesis, scenario, or verified source metadata.",
        pattern: /\bAI\s+synthesis\b(?!\s+(?:model|panel))/i,
    },
    {
        id: "unsupported-agency-margin-range",
        severity: "high_risk_claim",
        description: "Unsupported exact agency margin range; soften unless adjacent source/date/metric definition exists.",
        pattern: /\b(?:agency\s+)?margins?[^\n.]{0,80}\b(?:11\s*[–-]\s*15|25\s*[–-]\s*35)\s*(?:percent|%)\b/i,
    },
    {
        id: "unsupported-sla-dispute-reduction",
        severity: "high_risk_claim",
        description: "Unsupported SLA dispute-resolution reduction; remove, soften, or mark as scenario model.",
        pattern: /\bSLA\b[^\n.]{0,120}\b(?:dispute|resolution)[^\n.]{0,120}\b(?:40\s*percent|40%)\b/i,
    },
    {
        id: "unsupported-idc-data-silo-revenue-cost",
        severity: "high_risk_claim",
        description: "IDC/data-silo revenue-loss claim requires exact source/date/metric definition or softening.",
        pattern: /\bIDC\b[^\n.]{0,120}\bdata\s+silos?[^\n.]{0,120}\b(?:20\s*[–-]\s*30\s*percent|20%\s*[–-]\s*30%)\b[^\n.]{0,80}\brevenue\b/i,
    },
    {
        id: "unsupported-pmi-project-visibility-success",
        severity: "high_risk_claim",
        description: "PMI project-visibility success uplift needs exact source/date/metric definition or softening.",
        pattern: /\bPMI\b[^\n.]{0,120}\bproject\s+visibility[^\n.]{0,120}\b(?:20\s*[–-]\s*30\s*percent|20%\s*[–-]\s*30%)\b/i,
    },
    {
        id: "hyperautomation-forecast-without-caveat",
        severity: "needs_context",
        description: "Hyperautomation forecasts must include date/source context and the caveat that forecasts are not performance guarantees.",
        pattern: /\bhyperautomation\b[^\n.]{0,180}\bforecast\b(?![^\n.]{0,180}not a performance guarantee)/i,
    },
];

const DEFAULT_INCLUDE_EXTENSIONS = new Set([".md", ".mdx", ".sql", ".json", ".ts", ".tsx"]);
const DEFAULT_EXCLUDED_DIRS = new Set([".git", ".next", "node_modules"]);
const DEFAULT_EXCLUDED_FILES = new Set(["package-lock.json"]);
const DEFAULT_EXCLUDED_FILE_PATTERNS: readonly RegExp[] = [
    /^roo_task_.*\.md$/,
    /^\d{4}-\d{2}-\d{2}-.*local-command-caveatcaveat-the-messages-below\.txt$/,
    /^lint(?:_|-).*\.json$/,
    /^lint(?:_|-).*\.txt$/,
];

function extensionOf(filePath: string): string {
    const dotIndex = filePath.lastIndexOf(".");
    return dotIndex >= 0 ? filePath.slice(dotIndex) : "";
}

function shouldSkipFile(filePath: string): boolean {
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
    return DEFAULT_EXCLUDED_FILES.has(filePath)
        || filePath.endsWith("publication-safety-audit.ts")
        || filePath.endsWith("publication-safety-audit.test.ts")
        || DEFAULT_EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

function walkFiles(rootDir: string, currentDir = rootDir): string[] {
    const entries = readdirSync(currentDir);
    const files: string[] = [];

    for (const entry of entries) {
        if (DEFAULT_EXCLUDED_DIRS.has(entry)) continue;
        const absolutePath = join(currentDir, entry);
        const stats = statSync(absolutePath);
        if (stats.isDirectory()) {
            files.push(...walkFiles(rootDir, absolutePath));
            continue;
        }
        const rel = relative(rootDir, absolutePath);
        if (shouldSkipFile(rel)) continue;
        if (DEFAULT_INCLUDE_EXTENSIONS.has(extensionOf(entry))) files.push(absolutePath);
    }

    return files;
}

export function scanPublicationSafetyText(text: string, file = "<memory>"): PublicationSafetyMatch[] {
    const matches: PublicationSafetyMatch[] = [];
    const lines = text.split(/\r?\n/);
    lines.forEach((lineText, index) => {
        for (const safetyPattern of PUBLICATION_SAFETY_PATTERNS) {
            if (!safetyPattern.pattern.test(lineText)) continue;
            matches.push({
                file,
                line: index + 1,
                patternId: safetyPattern.id,
                severity: safetyPattern.severity,
                description: safetyPattern.description,
                excerpt: lineText.trim().slice(0, 240),
            });
        }
    });
    return matches;
}

export function scanPublicationSafetyMetadata(metadata: unknown, file = "<metadata>"): PublicationSafetyMetadataIssue[] {
    const issues: PublicationSafetyMetadataIssue[] = [];
    const root = asRecord(metadata);
    const enrichment = asRecord(root.enrichment);
    const visualBlocks = Array.isArray(enrichment.visual_blocks) ? enrichment.visual_blocks.map(asRecord) : [];
    const evidenceItems = Array.isArray(enrichment.evidence) ? enrichment.evidence.map(asRecord) : [];
    const evidenceByVisualId = new Map(evidenceItems.map((item) => [asString(item.visual_id), item] as const).filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));

    visualBlocks.forEach((block) => {
        const visualId = asString(block.id) || "<unknown>";
        const evidence = asRecord(block.evidence);
        const topLevelEvidence = evidenceByVisualId.get(visualId) ?? evidence;
        const evidenceType = asString(topLevelEvidence.evidence_type);
        const sourceLabel = asString(topLevelEvidence.source_label) || asString(block.source_label);
        const sourceUrl = asString(topLevelEvidence.source_url) || asString(block.source_url);
        const isNumericChart = block.type === "chart" && Array.isArray(block.data) && block.data.some((datum) => typeof asRecord(datum).value === "number");

        if (sourceLabel && /^(ai[\s_-]*(research[\s_-]*)?synthesis|research[\s_-]*synthesis|ai[\s_-]*generated|generated[\s_-]*by[\s_-]*ai)$/i.test(sourceLabel)) {
            issues.push({
                file,
                visualId,
                code: "metadata_banned_visual_source_label",
                severity: "banned_label",
                description: `Visual metadata uses banned source label "${sourceLabel}".`,
            });
        }

        if (isNumericChart && !["verified_statistic", "time_sensitive_benchmark", "forecast", "internal_estimate"].includes(evidenceType ?? "")) {
            issues.push({
                file,
                visualId,
                code: "metadata_numeric_chart_invalid_evidence_type",
                severity: "high_risk_claim",
                description: "Numeric chart metadata must use verified_statistic, time_sensitive_benchmark, forecast, or internal_estimate.",
            });
        }

        if (isNumericChart && evidenceType !== "internal_estimate" && !sourceUrl) {
            issues.push({
                file,
                visualId,
                code: "metadata_numeric_chart_missing_source_url",
                severity: "high_risk_claim",
                description: "Numeric chart metadata is missing source_url for external evidence.",
            });
        }

        if (isNumericChart && !asString(topLevelEvidence.publication_date) && !(sourceLabel && /\b(?:19|20)\d{2}\b/.test(sourceLabel))) {
            issues.push({
                file,
                visualId,
                code: "metadata_exact_number_missing_source_date",
                severity: "needs_context",
                description: "Numeric chart metadata should include publication_date or exact dataset year in source_label.",
            });
        }

        if (["author_framework", "author_synthesis"].includes(evidenceType ?? "") && sourceUrl) {
            issues.push({
                file,
                visualId,
                code: "metadata_author_synthesis_displayed_as_external_proof",
                severity: "needs_context",
                description: "Author framework/synthesis metadata should not carry source_url unless it directly maps a named external framework.",
            });
        }
    });

    return issues;
}

export function scanArticleTrustSignals(input: {
    title?: string | null;
    markdown?: string | null;
    metadata?: unknown;
    file?: string;
}): ArticleTrustAuditIssue[] {
    const file = input.file ?? "<article>";
    const markdown = input.markdown ?? "";
    const plain = stripMarkdownNoise(markdown);
    const metadata = asRecord(input.metadata);
    const enrichment = asRecord(metadata.enrichment);
    const visualBlocks = Array.isArray(enrichment.visual_blocks) ? enrichment.visual_blocks : [];
    const evidenceItems = Array.isArray(enrichment.evidence) ? enrichment.evidence.map(asRecord) : [];
    const externalLinks = markdown.match(/\]\(https?:\/\/[^)\s]+/g) ?? [];
    const issues: ArticleTrustAuditIssue[] = [];

    if (countWords(plain) >= 700 && externalLinks.length === 0) {
        issues.push({
            file,
            code: "trust_no_external_evidence_links",
            severity: "needs_context",
            description: "Article has no markdown external evidence links; public trust depends on visible named references.",
        });
    }

    if (countWords(plain) >= 900 && !/\b(?:before|after|from\s+[^.\n]{3,80}\s+to\s+|as-is|to-be|current workflow|target workflow|existing workflow|new workflow)\b/i.test(plain)) {
        issues.push({
            file,
            code: "trust_missing_before_after_workflow",
            severity: "needs_context",
            description: "Article lacks a before/after or as-is/to-be workflow example.",
        });
    }

    if (countWords(plain) >= 900 && visualBlocks.length === 0) {
        issues.push({
            file,
            code: "trust_missing_visual_evidence_or_diagram",
            severity: "needs_context",
            description: "Article has no structured visual blocks for diagrams, charts, screenshots, or workflow evidence.",
        });
    }

    const metadataEvidenceTypes = new Set(evidenceItems.map((item) => asString(item.evidence_type)).filter(Boolean));
    const textTaxonomyVisible = /\b(?:external source|author framework|author synthesis|scenario model|internal estimate|directional estimate|not (?:a )?(?:benchmark|guarantee|external statistic))\b/i.test(plain);
    if (!textTaxonomyVisible && metadataEvidenceTypes.size === 0) {
        issues.push({
            file,
            code: "trust_missing_evidence_taxonomy",
            severity: "needs_context",
            description: "Article does not expose evidence taxonomy separating external sources, author frameworks, and scenario models.",
        });
    }

    const titlePhrase = significantTitlePhrase(input.title ?? "");
    if (titlePhrase) {
        const occurrences = countPhraseOccurrences(normalizeText(plain), normalizeText(titlePhrase));
        const allowed = Math.max(4, Math.ceil(countWords(plain) / 240));
        if (occurrences > allowed) {
            issues.push({
                file,
                code: "trust_repetitive_seo_phrase",
                severity: "needs_context",
                description: "Article repeats the title/keyword phrase often enough to read SEO-assisted.",
                details: { phrase: titlePhrase, occurrences, allowed },
            });
        }
    }

    if (/\b(?:revolutioni[sz]e|unlock (?:the )?(?:power|potential)|game[-\s]?changing|cutting[-\s]?edge|world[-\s]?class|unparalleled|seamless solution|robust platform|comprehensive solution)\b/i.test(plain)) {
        issues.push({
            file,
            code: "trust_vague_big_claim_language",
            severity: "needs_context",
            description: "Article contains broad transformation/corporate-marketing language that should be replaced with concrete workflow detail or softer claims.",
        });
    }

    return issues;
}

export function scanPublicationSafetyRepo(rootDir = process.cwd()): PublicationSafetyMatch[] {
    const matches: PublicationSafetyMatch[] = [];
    for (const filePath of walkFiles(rootDir)) {
        const rel = relative(rootDir, filePath);
        const text = readFileSync(filePath, "utf8");
        matches.push(...scanPublicationSafetyText(text, rel));
    }
    return matches;
}

export function buildSupabaseAuditSql(): string {
    return `-- Read-only audit for risky article labels and high-risk claim patterns. Do not run destructive writes.
SELECT slug, title, locale, status,
       CASE
         WHEN content_markdown ~* 'AI\\s+research\\s+synthesis|AI\\s+synthesis' THEN 'banned_placeholder_source_label'
         WHEN content_markdown ~* 'SLA.{0,120}(dispute|resolution).{0,120}(40\\s*percent|40%)' THEN 'unsupported_sla_dispute_reduction'
         WHEN content_markdown ~* 'IDC.{0,120}data\\s+silos?.{0,120}(20\\s*[–-]\\s*30\\s*percent|20%\\s*[–-]\\s*30%).{0,80}revenue' THEN 'unsupported_idc_data_silo_revenue_cost'
         WHEN content_markdown ~* 'PMI.{0,120}project\\s+visibility.{0,120}(20\\s*[–-]\\s*30\\s*percent|20%\\s*[–-]\\s*30%)' THEN 'unsupported_pmi_project_visibility_success'
         WHEN content_markdown ~* 'hyperautomation.{0,180}forecast' AND content_markdown !~* 'not a performance guarantee' THEN 'hyperautomation_forecast_without_caveat'
         ELSE 'theme_or_slug_match'
       END AS audit_reason
FROM public.content_items
WHERE type = 'blog'
  AND template_id = 'isystem-agency'
  AND (
    slug = ANY (ARRAY[${EXPECTED_ARTICLE_SLUGS.map((slug) => `'${slug}'`).join(", ")}])
    OR title ~* '(W2 Model|Dashboard Era|System of Action|Agency Stack|AI Operating System|Traditional Web Agencies|Client SLA Dashboard|Governed AI Ledger)'
    OR content_markdown ~* '(AI\\s+research\\s+synthesis|AI\\s+synthesis|SLA.{0,120}(dispute|resolution).{0,120}(40\\s*percent|40%)|IDC.{0,120}data\\s+silos?.{0,120}(20\\s*[–-]\\s*30\\s*percent|20%\\s*[–-]\\s*30%).{0,80}revenue|PMI.{0,120}project\\s+visibility.{0,120}(20\\s*[–-]\\s*30\\s*percent|20%\\s*[–-]\\s*30%)|hyperautomation.{0,180}forecast)'
  )
ORDER BY slug, locale;`;
}

function stripMarkdownNoise(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#{1,6}\s+.+$/gm, " ")
        .replace(/[`*_~>\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function countWords(text: string): number {
    return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function normalizeText(text: string): string {
    return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function countPhraseOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = haystack.indexOf(needle, index)) !== -1) {
        count += 1;
        index += needle.length;
    }
    return count;
}

function significantTitlePhrase(title: string): string | null {
    const normalized = normalizeText(title);
    const words = normalized.split(" ").filter((word) => word.length >= 3 && !["the", "and", "for", "with", "your", "how", "why", "what", "een", "het", "van", "voor"].includes(word));
    if (words.length < 2) return null;
    return words.slice(0, Math.min(4, words.length)).join(" ");
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const matches = scanPublicationSafetyRepo();
    if (process.argv.includes("--sql")) {
        console.log(buildSupabaseAuditSql());
    }
    if (matches.length === 0) {
        console.log("No publication-safety matches found in repository files.");
        process.exit(0);
    }
    console.log(JSON.stringify(matches, null, 2));
    process.exit(1);
}
