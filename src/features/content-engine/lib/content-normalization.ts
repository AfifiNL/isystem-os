import { normalizeMarkdownForRender } from "./normalize-markdown";

export function normalizeContentMarkdownForSave(markdown: string): string {
    return normalizeMarkdownForRender(markdown);
}
