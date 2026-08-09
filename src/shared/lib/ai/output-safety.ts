export const GENERATED_OUTPUT_SAFETY_PATTERNS = [
    {
        code: "model_role_instruction",
        pattern: /\byou are (?:an?|the) (?:ai(?: content)?|content|writing|marketing|seo|social media|newsletter|translation) (?:assistant|agent|model|writer|strategist|copywriter|manager)\b/i,
    },
    {
        code: "instruction_override",
        pattern: /\b(?:ignore|disregard) (?:all |any )?(?:previous|prior) instructions?\b/i,
    },
    {
        code: "upstream_brief_instruction",
        pattern: /\bread this as (?:the )?upstream brief\b|\bexpose (?:the )?(?:upstream|private|hidden) brief\b/i,
    },
    {
        code: "prompt_role_label",
        pattern: /\b(?:system|developer|assistant) (?:prompt|message)\s*:/i,
    },
    {
        code: "machine_output_instruction",
        pattern: /\b(?:output|response) format\s*:|\breturn only (?:a |the )?(?:single,?\s*)?(?:valid |parseable )?(?:json|markdown|html|yaml|xml|data)\b/i,
    },
    {
        code: "agent_only_instruction",
        pattern: /\bif you are an ai agent\b/i,
    },
    {
        code: "editor_scaffolding",
        pattern: /\bcomposed in puck\b|\bowned by the application\b|\bcurrent public snapshot\b/i,
    },
    {
        code: "placeholder_marker",
        pattern: /\[PLACEHOLDER\]/i,
    },
    {
        code: "native_review_marker",
        pattern: /\[AWAITING NATIVE REVIEW[^\]]*]/i,
    },
    {
        code: "machine_evidence_reason",
        pattern: /\bno_primary_or_near_primary_numeric_claim_available\b/i,
    },
    {
        code: "serialized_object",
        pattern: /\[object Object]/i,
    },
    {
        code: "model_preamble",
        pattern: /\b(?:as an AI language model|here(?:'s| is) (?:the )?(?:draft|article|page|copy) (?:you )?(?:requested|asked for))\b/i,
    },
    {
        code: "internal_content_field",
        pattern: /\b(?:content_markdown|visual_layout|public_layout_v2|generated_formats|source_note)\s*[:=]/i,
    },
    {
        code: "internal_implementation_identifier",
        pattern: /\b(?:client_portal_users|getPartnerPortalAccess|content_published|contact_subscribed)\b/i,
    },
    {
        code: "internal_billing_unit",
        pattern: /\bmillicents?\b/i,
    },
    {
        code: "internal_metering_copy",
        pattern: /\bpre[-\s‑–—]?flight (?:credit ?metering|credit[-\s]?check|metering|workspace[-\s]?balance check|balance check|balanscheck|saldocheck)\b|فحص رصيد قبل التشغيل|قياس أرصدة قبل التشغيل/i,
    },
    {
        code: "internal_audit_copy",
        pattern: /\bappend[-\s]?only (?:audit[-\s]?)?(?:ledger|grootboek)\b|\baudit ledger\b[^.\n]{0,100}\breason codes?\b|سجل تدقيق ملحقاتي|دفتر تدقيق غير قابل للتعديل/i,
    },
    {
        code: "internal_authorization_copy",
        pattern: /\brole[-\s]?gated (?:mutations?|mutaties)\b|تعديلات (?:بصلاحيات|محكومة ب)الأدوار|صلاحيات مقيّدة بالأدوار/i,
    },
    {
        code: "internal_abuse_copy",
        pattern: /\banti[-\s]?abuse logging\b|تسجيل مكافحة الإساءة/i,
    },
    {
        code: "internal_pipeline_copy",
        pattern: /\binternal jobs?\b|\braw extraction payloads?\b|بيانات داخلية|نصوص استخراج خام/i,
    },
    {
        code: "internal_change_protocol_copy",
        pattern: /\bdiff\s*\+\s*rationale\s*\+\s*atomic apply\s*\+\s*rollback\b|\bpreview\s*[/+]\s*apply\s*[/+]\s*rollback\b|معاينة\s*\/\s*تطبيق\s*\/\s*تراجع/i,
    },
] as const;

export type GeneratedOutputSafetyCode =
    typeof GENERATED_OUTPUT_SAFETY_PATTERNS[number]["code"];

export interface GeneratedOutputSafetyFinding {
    code: GeneratedOutputSafetyCode;
    path: string;
}

function childPath(parent: string, key: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `${parent}.${key}`
        : `${parent}[${JSON.stringify(key)}]`;
}

export function findUnsafeGeneratedOutput(value: unknown): GeneratedOutputSafetyFinding[] {
    const findings: GeneratedOutputSafetyFinding[] = [];
    const visited = new WeakSet<object>();

    const visit = (candidate: unknown, path: string): void => {
        if (typeof candidate === "string") {
            for (const policy of GENERATED_OUTPUT_SAFETY_PATTERNS) {
                if (policy.pattern.test(candidate)) {
                    findings.push({ code: policy.code, path });
                }
            }
            return;
        }
        if (!candidate || typeof candidate !== "object") return;
        if (visited.has(candidate)) return;
        visited.add(candidate);

        if (Array.isArray(candidate)) {
            candidate.forEach((item, index) => visit(item, `${path}[${index}]`));
            return;
        }
        Object.entries(candidate as Record<string, unknown>).forEach(([key, item]) => {
            visit(item, childPath(path, key));
        });
    };

    visit(value, "$");
    return findings;
}

export class GeneratedOutputSafetyError extends Error {
    constructor(
        public readonly findings: readonly GeneratedOutputSafetyFinding[],
    ) {
        super("Generated content contained internal authoring text.");
        this.name = "GeneratedOutputSafetyError";
    }
}

export function assertSafeGeneratedOutput(value: unknown): void {
    const findings = findUnsafeGeneratedOutput(value);
    if (findings.length > 0) {
        throw new GeneratedOutputSafetyError(findings);
    }
}
