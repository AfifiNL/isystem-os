import assert from "node:assert/strict";
import { test } from "node:test";
import {
    extractVisualLayoutLinks,
    extractVisualLayoutText,
} from "@/features/seo/lib/analysis";

const layout = {
    content: [
        {
            type: "Hero",
            props: {
                title: {
                    en: "Managed AI systems",
                    nl: "Beheerde AI-systemen",
                    ar: "أنظمة ذكاء اصطناعي مُدارة",
                },
                description: {
                    en: "Build a governed operating system.",
                    nl: "Bouw een beheerst besturingssysteem.",
                    ar: "ابنِ نظام تشغيل محكومًا.",
                },
                primaryCta: {
                    href: {
                        en: "/en/contact",
                        nl: "/nl/contact",
                        ar: "/ar/contact",
                    },
                },
            },
        },
    ],
};

test("published page inventory extracts only the requested locale narrative", () => {
    const text = extractVisualLayoutText(layout, "nl");
    assert.match(text, /Beheerde AI-systemen/);
    assert.match(text, /Bouw een beheerst/);
    assert.doesNotMatch(text, /Managed AI systems/);
    assert.doesNotMatch(text, /أنظمة/);
});

test("published page inventory extracts only the requested locale links", () => {
    assert.deepEqual(extractVisualLayoutLinks(layout, "ar"), ["contact"]);
});
