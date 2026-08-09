/**
 * Pre-TTS sanitization for narration scripts.
 *
 * The narration LLM is instructed to emit only spoken text (and `[HOST]:` /
 * `[GUEST]:` tags for multi-speaker), but real-world LLM output drifts:
 *
 *   * Stage directions: `[laughs]`, `[pause]`, `[music swells]`, `(thoughtfully)`
 *   * Markdown survivors: `**emphasis**`, `*italic*`, `> blockquote`, `- bullet`
 *   * Foreign speaker tags: `[INTERVIEWER]:`, `[Sarah]:`, `[NARRATOR]:`
 *   * Whitespace inside tags: `[ HOST ]:`
 *
 * Without sanitization these reach the TTS provider and get pronounced
 * literally. With sanitization we strip non-speech artifacts and report a
 * `warnings` list so operators can see what was cleaned.
 */

export interface SanitizedScript {
    script: string;
    warnings: string[];
}

const RECOGNIZED_TAGS = new Set(["HOST", "GUEST"]);

const STAGE_DIRECTION_PATTERN = /\[(laughs|laughter|sighs|pauses?|silence|music|applause|clears throat|chuckles?|coughs?|breathes?)[^\]]*\]/gi;

// Single-source-of-truth tag matcher. Captures the inner word so we can
// classify HOST/GUEST vs unrecognized speaker labels without re-walking.
const ANY_BRACKETED_TAG_PATTERN = /\[\s*([A-Za-z][A-Za-z _'-]*?)\s*\]\s*:/g;

export function sanitizeNarrationScript(raw: string): SanitizedScript {
    const warnings: string[] = [];
    let script = raw;

    // 1. Stage directions / non-speech artifacts. Done before tag handling so
    // a stage direction line like `[HOST]: [laughs] Welcome.` correctly keeps
    // the speaker tag and removes only the `[laughs]`.
    const stageMatches = script.match(STAGE_DIRECTION_PATTERN);
    if (stageMatches && stageMatches.length > 0) {
        warnings.push(`Removed ${stageMatches.length} stage direction(s) from the script.`);
        script = script.replace(STAGE_DIRECTION_PATTERN, " ");
    }

    // 2. Parenthetical asides — these are usually directions like
    // "(thoughtfully)" or "(softly)". We're conservative: only strip when
    // the parenthetical is short (<= 30 chars) and contains a typical
    // direction-flavor word, to avoid eating real meaningful asides.
    script = script.replace(/\(([^)]{1,30})\)/g, (match, inner: string) => {
        if (/laughs?|sighs?|pauses?|softly|loudly|thoughtfully|whispers?|chuckles?/i.test(inner)) {
            warnings.push(`Removed parenthetical aside: "(${inner})".`);
            return " ";
        }
        return match;
    });

    // 3. Tag normalization. Catch foreign / mistyped speaker tags BEFORE we
    // strip markdown so the warning carries the original spelling.
    const seenForeignTags = new Set<string>();
    script = script.replace(ANY_BRACKETED_TAG_PATTERN, (_match, name: string) => {
        const upper = name.toUpperCase();
        if (RECOGNIZED_TAGS.has(upper)) {
            // Normalize whitespace inside brackets and case: `[ host ]: ` → `[HOST]: `.
            return `[${upper}]: `;
        }
        // Unknown tag. We map it to GUEST as a best-effort (most common
        // pattern is a third speaker name like `[Sarah]:`) and warn so
        // operators can correct the source.
        if (!seenForeignTags.has(upper)) {
            warnings.push(`Unrecognized speaker tag "[${name}]:" — treated as GUEST.`);
            seenForeignTags.add(upper);
        }
        return "[GUEST]: ";
    });

    // 4. Markdown survivors. Done last so the content inside any markdown
    // is preserved in spoken form ("**important**" → "important"), and tag
    // brackets aren't disturbed.
    script = script
        .replace(/\*\*([^*]+)\*\*/g, "$1")     // **bold**
        .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")  // *italic*
        .replace(/^\s*>\s+/gm, "")             // blockquote prefix
        .replace(/^\s*[-*]\s+/gm, "")          // bullet prefix
        .replace(/`([^`]+)`/g, "$1");          // inline code

    // 5. Collapse any whitespace runs the substitutions left behind.
    script = script.replace(/[ \t]+/g, " ").replace(/ *\n+ */g, "\n").trim();

    return { script, warnings };
}
