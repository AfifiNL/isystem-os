import { Buffer } from "buffer";
import { INTER_BOLD_BASE64, NOTO_SANS_ARABIC_BOLD_BASE64 } from "./font-data";

const OVERLAY_WIDTH = 1200;
const OVERLAY_HEIGHT = 675;
const OVERLAY_PANEL_WIDTH = 620;
const MAX_OVERLAY_WORDS = 7;
const MAX_OVERLAY_TOKEN_CHARS = 18;

export const OVERLAY_DESIGN_IDS = [
    "integrated-panel",
    "governance-ledger",
    "automation-flow",
    "business-os-grid",
    "saas-consolidation",
    "ai-frontier",
    "compliance-shield",
    "growth-intelligence",
] as const;

export type OverlayDesignId = typeof OVERLAY_DESIGN_IDS[number];

export interface OverlaySelectionInput {
    title: string;
    description?: string | null;
    keywords?: string[] | null;
    locale?: string | null;
    assetKey?: string | null;
    promptContext?: string | null;
    category?: string | null;
}

interface OverlayRenderContext {
    lines: string[];
    text: string;
    category: string;
    isRtl: boolean;
    textAnchor: "start" | "end";
    textX: number;
    direction: "ltr" | "rtl";
    barX: number;
    logoX: number;
    fontSize: number;
    lineSpacing: number;
    tspans: string;
    logoImageElement: string;
    fontFaceStyles: string;
}

type OverlayRenderer = (context: OverlayRenderContext) => string;

export function escapeSvgText(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export function conciseOverlayFromTitle(title: string): string {
    return title
        .replace(/[^\p{L}\p{N}\s…-]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, MAX_OVERLAY_WORDS)
        .map((word) => truncateOverlayToken(word))
        .join(" ")
        .trim() || "Key Insight";
}

function truncateOverlayToken(word: string): string {
    const characters = Array.from(word);
    if (characters.length <= MAX_OVERLAY_TOKEN_CHARS) {
        return word;
    }

    return `${characters.slice(0, MAX_OVERLAY_TOKEN_CHARS - 1).join("")}…`;
}

export function normalizeOverlayText(value: string | null | undefined, fallbackTitle: string): string {
    const source = typeof value === "string" && value.trim() ? value : fallbackTitle;
    return conciseOverlayFromTitle(source);
}

function wrapOverlayLines(text: string): string[] {
    const words = conciseOverlayFromTitle(text).toUpperCase().split(/\s+/).filter(Boolean);
    if (words.length <= 3) {
        return [words.join(" ")];
    }
    if (words.length <= 5) {
        const mid = Math.ceil(words.length / 2);
        return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    if (words.length === 6) {
        return [words.slice(0, 3).join(" "), words.slice(3).join(" ")];
    }
    // 7 words: 3 + 2 + 2
    return [
        words.slice(0, 3).join(" "),
        words.slice(3, 5).join(" "),
        words.slice(5).join(" "),
    ];
}

function hashString(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function normalizeSelectionText(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function countTermMatches(haystack: string, terms: readonly string[]): number {
    return terms.reduce((score, term) => {
        const normalizedTerm = normalizeSelectionText(term);
        if (!normalizedTerm) return score;
        const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const boundaryPattern = /^[a-z0-9\s-]+$/.test(normalizedTerm)
            ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "g")
            : null;
        const matches = boundaryPattern ? haystack.match(boundaryPattern) : null;
        if (matches?.length) return score + matches.length;
        return haystack.includes(normalizedTerm) ? score + 1 : score;
    }, 0);
}

const TOPIC_TERMS: Record<OverlayDesignId, readonly string[]> = {
    "integrated-panel": [
        "strategy", "strategic", "insight", "positioning", "foundation", "systems partner", "consultancy",
        "serious operator", "digital systems", "systeempartner", "strategie", "inzicht", "استراتيجية",
    ],
    "governance-ledger": [
        "audit", "audit trail", "ledger", "checksum", "approval", "approved", "accountability", "governance",
        "traceability", "evidence", "review log", "control record", "goedkeuring", "auditspoor", "governance",
        "تدقيق", "حوكمة", "موافقة",
    ],
    "automation-flow": [
        "automation", "automate", "workflow", "workflows", "handoff", "process", "routing", "orchestration",
        "operations flow", "zapier", "make.com", "automatisering", "workflow", "proces", "overdracht", "أتمتة", "سير العمل",
    ],
    "business-os-grid": [
        "business os", "operating system", "digital os", "command center", "workspace", "control center", "modules",
        "desktop", "cockpit", "business operating", "operating model", "besturingssysteem", "werkruimte", "commandocentrum",
        "نظام تشغيل", "مساحة عمل",
    ],
    "saas-consolidation": [
        "saas", "tool stack", "app stack", "app sprawl", "fragmented", "fragmentation", "consolidation", "consolidate",
        "one hub", "single hub", "tabs", "subscriptions", "software stack", "versnipperd", "consolidatie", "tooling",
        "تطبيقات", "منصة واحدة",
    ],
    "ai-frontier": [
        "ai", "artificial intelligence", "generative ai", "llm", "model", "models", "agent", "agents", "human in the loop",
        "human-in-loop", "adoption", "capability", "machine learning", "kunstmatige intelligentie", "ai-adoptie", "modelgrens",
        "ذكاء اصطناعي", "نماذج", "وكيل",
    ],
    "compliance-shield": [
        "compliance", "gdpr", "privacy", "risk", "risks", "policy", "policies", "legal", "dpa", "retention", "bewaarplicht",
        "security", "shield", "guardrail", "guardrails", "wet dba", "avg", "naleving", "beleid", "risico", "خصوصية", "امتثال", "مخاطر",
    ],
    "growth-intelligence": [
        "growth", "seo", "analytics", "market monitor", "market intelligence", "opportunity", "opportunities", "signals",
        "competitor", "campaign", "visibility", "ranking", "conversion", "pipeline", "groei", "zoekmachine", "marktmonitor",
        "kansen", "conversie", "نمو", "تحليلات", "فرص",
    ],
};

const HIGH_INTENT_TERMS: Partial<Record<OverlayDesignId, readonly string[]>> = {
    "governance-ledger": ["audit trail", "checksum", "approval", "auditspoor"],
    "automation-flow": ["workflow automation", "automated workflow", "routed handoff", "workflow-automatisering"],
    "business-os-grid": ["business os", "operating system", "digital operating system", "command center"],
    "saas-consolidation": ["app sprawl", "saas consolidation", "tool stack", "fragmented tools"],
    "ai-frontier": ["human in the loop", "human-in-loop", "generative ai", "ai adoption"],
    "compliance-shield": ["gdpr", "privacy risk", "compliance", "wet dba", "avg"],
    "growth-intelligence": ["market monitor", "growth intelligence", "seo", "opportunity engine"],
};

export function selectOverlayDesign(input: OverlaySelectionInput): OverlayDesignId {
    const keywordText = (input.keywords ?? []).filter(Boolean).join(" ");
    const selectionSource = [
        input.title,
        input.description,
        keywordText,
        input.locale,
        input.assetKey,
        input.promptContext,
        input.category,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" | ");

    const haystack = normalizeSelectionText(selectionSource);
    const seed = hashString(haystack || input.title || "workspace-overlay");

    const scores = OVERLAY_DESIGN_IDS.map((id, index) => {
        const baseScore = countTermMatches(haystack, TOPIC_TERMS[id]);
        const highIntentScore = countTermMatches(haystack, HIGH_INTENT_TERMS[id] ?? []) * 4;
        const localeNudge = input.locale === "ar" && (id === "ai-frontier" || id === "business-os-grid") ? 1 : 0;
        const deterministicTieBreaker = ((seed >>> (index % 16)) & 0xff) / 1000;
        return {
            id,
            score: baseScore + highIntentScore + localeNudge + deterministicTieBreaker,
            matched: baseScore + highIntentScore + localeNudge,
        };
    });

    const best = scores.reduce((winner, current) => current.score > winner.score ? current : winner);
    if (best.matched > 0) {
        return best.id;
    }

    return OVERLAY_DESIGN_IDS[seed % OVERLAY_DESIGN_IDS.length];
}

function buildFontFaceStyles(): string {
    const inter = INTER_BOLD_BASE64;
    const arabic = NOTO_SANS_ARABIC_BOLD_BASE64;
    let fontFaceStyles = "";
    if (inter) {
        fontFaceStyles += `
        @font-face {
            font-family: 'Inter';
            src: url('data:font/woff2;charset=utf-8;base64,${inter}') format('woff2');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Inter';
            src: url('data:font/woff2;charset=utf-8;base64,${inter}') format('woff2');
            font-weight: 800;
            font-style: normal;
        }
        `;
    }
    if (arabic) {
        fontFaceStyles += `
        @font-face {
            font-family: 'Noto Sans Arabic';
            src: url('data:font/woff2;charset=utf-8;base64,${arabic}') format('woff2');
            font-weight: 700;
            font-style: normal;
        }
        @font-face {
            font-family: 'Noto Sans Arabic';
            src: url('data:font/woff2;charset=utf-8;base64,${arabic}') format('woff2');
            font-weight: 800;
            font-style: normal;
        }
        `;
    }
    return fontFaceStyles;
}

function buildRenderContext(text: string, category: string, logoDataUri?: string | null): OverlayRenderContext {
    const lines = wrapOverlayLines(text);
    const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(`${text} ${category}`);
    const textAnchor = isRtl ? "end" : "start";
    const textX = isRtl ? 544 : 76;
    const direction = isRtl ? "rtl" : "ltr";
    const barX = isRtl ? 544 - 84 : 76;
    const logoX = isRtl ? 404 : 76;

    const longestLine = Math.max(...lines.map(line => line.length));
    let fontSize = 58;
    if (longestLine > 20) {
        fontSize = Math.max(38, Math.round(58 * (20 / longestLine)));
    }
    const lineSpacing = fontSize + 10;
    const tspans = lines.map((line, idx) => {
        const y = 250 + idx * lineSpacing;
        return `<tspan x="${textX}" y="${y}">${escapeSvgText(line)}</tspan>`;
    }).join("");

    let logoImageElement = "";
    if (logoDataUri) {
        logoImageElement = `<image href="${escapeSvgText(logoDataUri)}" x="${logoX}" y="70" width="140" height="70" />`;
    }

    return {
        lines,
        text,
        category,
        isRtl,
        textAnchor,
        textX,
        direction,
        barX,
        logoX,
        fontSize,
        lineSpacing,
        tspans,
        logoImageElement,
        fontFaceStyles: buildFontFaceStyles(),
    };
}

function renderOverlayShell(context: OverlayRenderContext, defs: string, body: string): Buffer {
    const svg = `
    <svg width="${OVERLAY_WIDTH}" height="${OVERLAY_HEIGHT}" viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}" xmlns="http://www.w3.org/2000/svg" data-overlay-design="${escapeSvgText(context.category)}">
        <defs>
            <style>
                ${context.fontFaceStyles}
            </style>
            ${defs}
        </defs>
        ${body}
    </svg>`;
    return Buffer.from(svg);
}

function overlayTextElement(context: OverlayRenderContext, fill = "#ffffff"): string {
    return `<text font-family="'Noto Sans Arabic', Inter, DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif"
              font-size="${context.fontSize}"
              font-weight="800"
              fill="${fill}"
              ${context.isRtl ? "" : 'letter-spacing="-1.2"'}
              text-anchor="${context.textAnchor}"
              direction="${context.direction}">
            ${context.tspans}
        </text>`;
}

function renderIntegratedPanel(context: OverlayRenderContext): Buffer {
    const defs = `
        <linearGradient id="panelFade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#020617" stop-opacity="0.98" />
            <stop offset="72%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#6366f1" />
        </linearGradient>`;
    const body = `
        <rect x="0" y="0" width="${OVERLAY_PANEL_WIDTH}" height="${OVERLAY_HEIGHT}" fill="#020617" opacity="1" />
        <rect x="0" y="0" width="820" height="${OVERLAY_HEIGHT}" fill="url(#panelFade)" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="84" height="6" rx="3" fill="url(#accent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "integrated-panel" }, defs, body);
}

function renderGovernanceLedger(context: OverlayRenderContext): Buffer {
    const ledgerRows = Array.from({ length: 7 }, (_, index) => {
        const y = 132 + index * 52;
        const marker = index % 3 === 0
            ? `<path d="M990 ${y + 10} l10 10 l24 -28" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.82" />`
            : `<circle cx="1006" cy="${y + 4}" r="7" fill="#38bdf8" opacity="0.35" />`;
        return `<g opacity="${(0.34 + index * 0.045).toFixed(2)}">
            <rect x="712" y="${y}" width="330" height="1.5" fill="#94a3b8" />
            <rect x="712" y="${y + 18}" width="${92 + index * 18}" height="4" rx="2" fill="#38bdf8" />
            <rect x="858" y="${y + 18}" width="${70 + index * 10}" height="4" rx="2" fill="#64748b" />
            ${marker}
        </g>`;
    }).join("");
    const defs = `
        <linearGradient id="ledgerPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="0.99" />
            <stop offset="74%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="ledgerAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#818cf8" />
        </linearGradient>`;
    const body = `
        <rect width="860" height="675" fill="url(#ledgerPanel)" />
        <path d="M650 76 H1042 Q1072 76 1072 106 V476 Q1072 506 1042 506 H650" fill="none" stroke="#334155" stroke-width="1.5" opacity="0.72" />
        ${ledgerRows}
        <rect x="${context.barX}" y="170" width="98" height="6" rx="3" fill="url(#ledgerAccent)" />
        ${context.logoImageElement}
        ${overlayTextElement(context)}
        <text x="76" y="582" font-family="Inter, Arial, sans-serif" font-size="12" fill="#94a3b8" letter-spacing="3">AUDIT READY SYSTEMS</text>`;
    return renderOverlayShell({ ...context, category: "governance-ledger" }, defs, body);
}

function renderAutomationFlow(context: OverlayRenderContext): Buffer {
    const nodes = [
        { x: 710, y: 136, r: 22 },
        { x: 830, y: 206, r: 28 },
        { x: 768, y: 328, r: 20 },
        { x: 930, y: 380, r: 30 },
        { x: 1040, y: 276, r: 22 },
    ].map((node, index) => `<g>
        <circle cx="${node.x}" cy="${node.y}" r="${node.r + 10}" fill="#38bdf8" opacity="0.08" />
        <circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="#020617" stroke="${index % 2 === 0 ? "#38bdf8" : "#818cf8"}" stroke-width="2.5" opacity="0.95" />
        <circle cx="${node.x}" cy="${node.y}" r="5" fill="#e0f2fe" />
    </g>`).join("");
    const defs = `
        <linearGradient id="flowPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="0.99" />
            <stop offset="68%" stop-color="#020617" stop-opacity="0.93" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="flowAccent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="60%" stop-color="#22c55e" />
            <stop offset="100%" stop-color="#818cf8" />
        </linearGradient>`;
    const body = `
        <rect width="850" height="675" fill="url(#flowPanel)" />
        <path d="M710 136 C780 132 778 204 830 206 S858 324 768 328 S855 424 930 380 S972 286 1040 276" fill="none" stroke="url(#flowAccent)" stroke-width="5" stroke-linecap="round" opacity="0.84" />
        <path d="M1030 266 l26 10 l-24 14" fill="none" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.86" />
        ${nodes}
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="94" height="6" rx="3" fill="url(#flowAccent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "automation-flow" }, defs, body);
}

function renderBusinessOsGrid(context: OverlayRenderContext): Buffer {
    const panes = [
        [704, 114, 176, 110], [898, 114, 176, 110], [704, 246, 120, 132], [846, 246, 228, 132], [704, 400, 370, 92],
    ].map(([x, y, w, h], index) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#0f172a" stroke="${index % 2 === 0 ? "#38bdf8" : "#6366f1"}" stroke-width="1.5" opacity="${index === 4 ? "0.74" : "0.62"}" />`).join("");
    const defs = `
        <linearGradient id="osPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="1" />
            <stop offset="66%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="osAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#60a5fa" />
            <stop offset="100%" stop-color="#a78bfa" />
        </linearGradient>`;
    const body = `
        <rect width="858" height="675" fill="url(#osPanel)" />
        <rect x="670" y="78" width="438" height="452" rx="28" fill="#020617" stroke="#334155" stroke-width="1.5" opacity="0.9" />
        <circle cx="716" cy="94" r="5" fill="#38bdf8" opacity="0.9" />
        <circle cx="736" cy="94" r="5" fill="#64748b" opacity="0.7" />
        <circle cx="756" cy="94" r="5" fill="#64748b" opacity="0.7" />
        ${panes}
        <path d="M738 446 H1040" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" opacity="0.42" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="88" height="6" rx="3" fill="url(#osAccent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "business-os-grid" }, defs, body);
}

function renderSaasConsolidation(context: OverlayRenderContext): Buffer {
    const tiles = Array.from({ length: 9 }, (_, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 690 + col * 90 + (row % 2) * 18;
        const y = 120 + row * 88;
        const opacity = (0.23 + index * 0.035).toFixed(2);
        return `<rect x="${x}" y="${y}" width="58" height="58" rx="14" fill="#0f172a" stroke="#475569" stroke-width="1.5" opacity="${opacity}" />`;
    }).join("");
    const defs = `
        <linearGradient id="saasPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="1" />
            <stop offset="70%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="hub" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#8b5cf6" />
        </linearGradient>`;
    const body = `
        <rect width="860" height="675" fill="url(#saasPanel)" />
        ${tiles}
        <path d="M738 146 C840 200 918 250 998 336" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 12" opacity="0.4" fill="none" />
        <path d="M828 234 C884 250 932 286 998 336" stroke="#818cf8" stroke-width="2" stroke-dasharray="8 12" opacity="0.4" fill="none" />
        <path d="M754 316 C848 330 918 328 998 336" stroke="#22d3ee" stroke-width="2" stroke-dasharray="8 12" opacity="0.38" fill="none" />
        <circle cx="1010" cy="348" r="76" fill="url(#hub)" opacity="0.22" />
        <rect x="954" y="292" width="112" height="112" rx="28" fill="#020617" stroke="url(#hub)" stroke-width="3" opacity="0.96" />
        <circle cx="1010" cy="348" r="18" fill="#e0f2fe" opacity="0.95" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="92" height="6" rx="3" fill="url(#hub)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "saas-consolidation" }, defs, body);
}

function renderAiFrontier(context: OverlayRenderContext): Buffer {
    const defs = `
        <linearGradient id="frontierPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="1" />
            <stop offset="68%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="modelGlow" cx="78%" cy="44%" r="42%">
            <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.52" />
            <stop offset="62%" stop-color="#38bdf8" stop-opacity="0.16" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="frontierAccent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#22d3ee" />
            <stop offset="100%" stop-color="#a78bfa" />
        </linearGradient>`;
    const body = `
        <rect width="860" height="675" fill="url(#frontierPanel)" />
        <rect width="1200" height="675" fill="url(#modelGlow)" />
        <path d="M760 92 C690 198 700 402 778 520" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="10 14" opacity="0.55" fill="none" />
        <path d="M864 132 C805 224 814 376 884 476" stroke="#818cf8" stroke-width="2" stroke-dasharray="8 12" opacity="0.5" fill="none" />
        <circle cx="998" cy="312" r="118" fill="#020617" stroke="url(#frontierAccent)" stroke-width="2.5" opacity="0.88" />
        <circle cx="998" cy="312" r="62" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.42" />
        <circle cx="998" cy="312" r="10" fill="#e0f2fe" />
        <circle cx="912" cy="254" r="13" fill="#f8fafc" opacity="0.92" />
        <path d="M912 254 C944 274 962 292 998 312" stroke="#f8fafc" stroke-width="2" opacity="0.55" fill="none" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="84" height="6" rx="3" fill="url(#frontierAccent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "ai-frontier" }, defs, body);
}

function renderComplianceShield(context: OverlayRenderContext): Buffer {
    const defs = `
        <linearGradient id="shieldPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="1" />
            <stop offset="72%" stop-color="#020617" stop-opacity="0.95" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="shieldAccent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2dd4bf" />
            <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>`;
    const body = `
        <rect width="862" height="675" fill="url(#shieldPanel)" />
        <path d="M958 102 L1080 154 V278 C1080 390 1018 472 958 506 C898 472 836 390 836 278 V154 Z" fill="#020617" stroke="url(#shieldAccent)" stroke-width="4" opacity="0.9" />
        <path d="M958 156 L1028 186 V284 C1028 354 994 410 958 438 C922 410 888 354 888 284 V186 Z" fill="#0f172a" stroke="#334155" stroke-width="1.5" opacity="0.76" />
        <path d="M918 296 h80" stroke="#2dd4bf" stroke-width="6" stroke-linecap="round" opacity="0.86" />
        <path d="M958 256 v80" stroke="#2dd4bf" stroke-width="6" stroke-linecap="round" opacity="0.86" />
        <path d="M704 152 H818 M704 232 H812 M704 312 H820 M704 392 H844" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" opacity="0.35" />
        <circle cx="690" cy="152" r="6" fill="#2dd4bf" opacity="0.82" />
        <circle cx="690" cy="232" r="6" fill="#f59e0b" opacity="0.72" />
        <circle cx="690" cy="312" r="6" fill="#2dd4bf" opacity="0.82" />
        <circle cx="690" cy="392" r="6" fill="#38bdf8" opacity="0.82" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="88" height="6" rx="3" fill="url(#shieldAccent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "compliance-shield" }, defs, body);
}

function renderGrowthIntelligence(context: OverlayRenderContext): Buffer {
    const dots = [
        [890, 262], [960, 210], [1040, 284], [1002, 392], [910, 430], [812, 354],
    ].map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${6 + (index % 2) * 3}" fill="${index % 2 === 0 ? "#22c55e" : "#38bdf8"}" opacity="0.86" />`).join("");
    const defs = `
        <linearGradient id="growthPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#020617" stop-opacity="1" />
            <stop offset="70%" stop-color="#020617" stop-opacity="0.94" />
            <stop offset="100%" stop-color="#020617" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="growthAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#22c55e" />
            <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>`;
    const body = `
        <rect width="862" height="675" fill="url(#growthPanel)" />
        <circle cx="930" cy="332" r="168" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.24" />
        <circle cx="930" cy="332" r="112" fill="none" stroke="#22c55e" stroke-width="1.5" opacity="0.28" />
        <circle cx="930" cy="332" r="56" fill="none" stroke="#818cf8" stroke-width="1.5" opacity="0.24" />
        <path d="M930 332 L1058 206" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" opacity="0.54" />
        <path d="M930 332 C972 338 1006 360 1036 406" stroke="#22c55e" stroke-width="3" stroke-linecap="round" opacity="0.5" fill="none" />
        <path d="M782 520 C854 458 902 426 1002 392 C1062 372 1118 350 1160 312" stroke="url(#growthAccent)" stroke-width="4" stroke-linecap="round" opacity="0.5" fill="none" />
        ${dots}
        <circle cx="930" cy="332" r="8" fill="#e0f2fe" />
        ${context.logoImageElement}
        <rect x="${context.barX}" y="170" width="96" height="6" rx="3" fill="url(#growthAccent)" />
        ${overlayTextElement(context)}`;
    return renderOverlayShell({ ...context, category: "growth-intelligence" }, defs, body);
}

const OVERLAY_RENDERERS: Record<OverlayDesignId, OverlayRenderer> = {
    "integrated-panel": (context) => renderIntegratedPanel(context).toString("utf8"),
    "governance-ledger": (context) => renderGovernanceLedger(context).toString("utf8"),
    "automation-flow": (context) => renderAutomationFlow(context).toString("utf8"),
    "business-os-grid": (context) => renderBusinessOsGrid(context).toString("utf8"),
    "saas-consolidation": (context) => renderSaasConsolidation(context).toString("utf8"),
    "ai-frontier": (context) => renderAiFrontier(context).toString("utf8"),
    "compliance-shield": (context) => renderComplianceShield(context).toString("utf8"),
    "growth-intelligence": (context) => renderGrowthIntelligence(context).toString("utf8"),
};

function isOverlayDesignId(value: unknown): value is OverlayDesignId {
    return typeof value === "string" && OVERLAY_DESIGN_IDS.includes(value as OverlayDesignId);
}

export function generateSvgOverlay(
    text: string,
    category: string,
    designOrSelection?: OverlayDesignId | OverlaySelectionInput,
    logoDataUri?: string | null,
): Buffer {
    const designId = isOverlayDesignId(designOrSelection)
        ? designOrSelection
        : designOrSelection
            ? selectOverlayDesign({ ...designOrSelection, title: designOrSelection.title || text, category })
            : "integrated-panel";
    const context = buildRenderContext(text, category, logoDataUri);
    return Buffer.from(OVERLAY_RENDERERS[designId](context));
}
