// Pure helpers for the case-snippet system. Lives outside `case-snippets.ts`
// (which is a "use server" module — every export there must be async). This
// file is import-safe from server actions, route handlers, and edge code.

import type { CaseSnippet } from "./case-snippets-types";

/**
 * Render the snippet into a prompt block. Engineered to make the LLM treat
 * the anecdote as ground truth and weave it into ONE specific paragraph —
 * not paraphrase it into every paragraph (which would make the output read
 * like a sales pitch).
 */
export function buildCaseSnippetPromptBlock(snippet: CaseSnippet | null): string {
    if (!snippet) {
        // Degrade gracefully: instruct the model to ground at least one
        // paragraph in a concrete, named scenario even when we have no
        // canned story to inject.
        return [
            "",
            "GROUNDING REQUIREMENT (no case snippet supplied):",
            "- At least one paragraph MUST reference a specific, named situation: a real company name, a dated event, a concrete metric, or a first-person operator observation.",
            "- Do NOT invent client names, statistics, or quotes. If you cannot ground a paragraph with something specific, write a tightly-observed operator anecdote in first person about HOW this work is actually done day to day.",
            "",
        ].join("\n");
    }

    // NOTE: `outcome_summary` is deliberately NOT shown to the model. Earlier
    // versions of this prompt included it as an "Outcome: ..." line — the
    // model treated it as content to write into the article and pasted it
    // verbatim as the trailing sentence after the anecdote, producing the
    // exact "meta-explainer" pattern we explicitly forbid below. The field
    // is still useful for picker scoring and the admin UI, but it must not
    // reach the writer.
    return [
        "",
        "REQUIRED CASE SNIPPET (treat as ground truth — weave it in, do not paraphrase away):",
        `Title: ${snippet.title}`,
        `Body: ${snippet.body}`,
        "",
        "Snippet integration rules:",
        "- Use this snippet in EXACTLY ONE paragraph of the article, ideally the second or third paragraph after the opener.",
        "- Preserve specific names, dates, and metrics verbatim. Do not soften them into generalities ('a client', 'a recent project') — the specificity is the entire point.",
        "- Do NOT repeat the snippet in the conclusion or in later sections. One concrete story, used once, with confidence.",
        "- Do not introduce the snippet with ANY generic example-frame. This includes (case-insensitive): 'For example', 'For instance', 'Take the case of', 'Take the example of', 'Consider the case of', 'Consider this example', 'Consider how', 'Look at', 'Take a look at', 'A real-world illustration', 'A good example is', 'One example', 'As an illustration', 'To illustrate'. Drop the reader directly into the scenario — start with the client/company name or the situation itself, not a transition phrase. If the natural first word is a connector, rewrite the sentence to lead with the concrete fact.",
        "- BAN the trailing meta-explainer. Do NOT follow the anecdote with a sentence that explains what the example just demonstrated ('This shows...', 'This illustrates...', 'This consolidation strategy directly addresses...', 'This proves the point that...'). The next paragraph must move the argument forward, not narrate the previous one. The anecdote stands alone; let the reader connect it.",
        "- BAN register-break. The article is for an SME / executive reader. Do NOT introduce dev jargon when integrating the snippet: no file paths, no folder names like `/portal` or `/dashboard`, no branch names like `client/<x>-production`, no references to `git`, `repo`, `fork`, `RLS`, `Postgres`, `Supabase`, `migrations`, `dispatch`, `snake_case`, `camelCase`, `.ts`, `.tsx`, `.sql`. If the body of the snippet itself contains any of these (it shouldn't, but defend against it), translate them into reader-facing business language for the article.",
        "- Match the surrounding prose's voice and tense. The snippet is a recollection inside the founder's argument, not a separate case-study card. No headings, no bold labels, no 'Client:' / 'Outcome:' framing — write it as one continuous paragraph in the same register as the rest of the piece.",
        "",
    ].join("\n");
}
