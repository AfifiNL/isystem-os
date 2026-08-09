import assert from "node:assert/strict";
import { test } from "node:test";
import type { SeoPublishedContentItem } from "@/features/seo/types";
import {
    aggregateSearchConsoleQuerySignals,
    buildStrategistInventoryContext,
    findMatchingSearchConsoleSignal,
    inferSearchConsoleLocale,
    isStrategicContentDuplicate,
    selectSearchConsoleSignalsForPrompt,
    summarizeSearchConsolePages,
} from "@/features/seo/lib/strategist-context";

test("Search Console aggregation uses the requested locale and a true date-window aggregate", () => {
    const siteUrl = "https://isystem.ai/";
    const signals = aggregateSearchConsoleQuerySignals([
        { page_url: "https://isystem.ai/en/services", page_slug: "services", query: "ai systems", date: "2026-07-01", clicks: 2, impressions: 20, position: 8 },
        { page_url: "https://isystem.ai/en/services", page_slug: "services", query: "AI Systems", date: "2026-07-02", clicks: 3, impressions: 30, position: 6 },
        { page_url: "https://isystem.ai/nl/services", page_slug: "services", query: "ai systemen", date: "2026-07-02", clicks: 8, impressions: 40, position: 4 },
        { page_url: "https://isystem.ai/blog/english-post", page_slug: "blog/english-post", query: "systems guide", date: "2026-07-02", clicks: 1, impressions: 10, position: 12 },
    ], { locale: "en", siteUrl });

    assert.equal(signals.length, 2);
    assert.equal(signals[0]?.query.toLowerCase(), "ai systems");
    assert.equal(signals[0]?.total_impressions, 50);
    assert.equal(signals[0]?.total_clicks, 5);
    assert.equal(signals[0]?.avg_ctr, 0.1);
    assert.equal(signals[0]?.avg_position, 6.8);
    assert.equal(signals[0]?.min_date, "2026-07-01");
    assert.equal(signals[0]?.max_date, "2026-07-02");
});

test("Search Console locale inference handles prefixed pages and the unprefixed English blog canonical", () => {
    const siteUrl = "https://isystem.ai/";
    assert.equal(inferSearchConsoleLocale("https://isystem.ai/ar/services", siteUrl), "ar");
    assert.equal(inferSearchConsoleLocale("https://isystem.ai/nl/blog/post", siteUrl), "nl");
    assert.equal(inferSearchConsoleLocale("https://isystem.ai/blog/post", siteUrl), "en");
    assert.equal(inferSearchConsoleLocale("https://example.com/en/services", siteUrl), null);
});

test("inventory context catalogs every published item while detailed coverage prioritizes landing pages", () => {
    const makeItem = (input: Partial<SeoPublishedContentItem> & Pick<SeoPublishedContentItem, "id" | "title" | "slug" | "type">): SeoPublishedContentItem => ({
        id: input.id,
        title: input.title,
        slug: input.slug,
        type: input.type,
        status: "published",
        contentMarkdown: input.contentMarkdown ?? "",
        visualLayoutText: input.visualLayoutText ?? "",
        excerpt: input.excerpt ?? "",
        keywords: input.keywords ?? [],
        links: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: input.updatedAt ?? "2026-07-01T00:00:00.000Z",
        metadata: null,
        pageIntent: input.pageIntent ?? null,
        audienceType: input.audienceType ?? null,
        conversionGoal: input.conversionGoal ?? null,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
    });
    const inventory = [
        ...Array.from({ length: 25 }, (_, index) => makeItem({ id: `blog-${index}`, title: `Blog ${index}`, slug: `blog-${index}`, type: "blog", contentMarkdown: `Coverage for blog ${index}` })),
        makeItem({ id: "services", title: "Services", slug: "services", type: "page", conversionGoal: "Book a fit call", visualLayoutText: "Managed AI systems for SMEs." }),
    ];

    const context = buildStrategistInventoryContext(inventory, [], 10);
    assert.equal(context.totalPublished, 26);
    assert.equal(context.catalog.length, 26);
    assert.equal(context.detailed.length, 10);
    assert.equal(context.detailed[0]?.slug, "services");
    assert.match(context.detailed[0]?.coverageExcerpt ?? "", /Managed AI systems/);
});

test("prompt signal selection balances pages and evidence matching finds related demand", () => {
    const signals = [
        ...Array.from({ length: 8 }, (_, index) => ({ page_slug: "services", query: `managed ai systems ${index}`, total_impressions: 100 - index, total_clicks: 3, avg_ctr: 0.03, avg_position: 8, min_date: "2026-07-01", max_date: "2026-07-30" })),
        { page_slug: "audit", query: "digital systems audit", total_impressions: 50, total_clicks: 5, avg_ctr: 0.1, avg_position: 5, min_date: "2026-07-01", max_date: "2026-07-30" },
    ];
    const selected = selectSearchConsoleSignalsForPrompt(signals, { maxSignals: 6, maxPerPage: 5 });
    assert.equal(selected.length, 6);
    assert.ok(selected.some((signal) => signal.page_slug === "audit"));
    assert.equal(findMatchingSearchConsoleSignal("Digital systems audit guide", signals)?.page_slug, "audit");
    assert.equal(isStrategicContentDuplicate({ primaryKeyword: "digital systems audit" }, [{ title: "Audit", slug: "audit" }], signals), true);
    assert.equal(isStrategicContentDuplicate({ slugSuggestion: "audit" }, [{ title: "Audit", slug: "audit" }], signals), true);
    assert.equal(isStrategicContentDuplicate({ primaryKeyword: "unserved workflow design" }, [{ title: "Audit", slug: "audit" }], signals), false);
    const pages = summarizeSearchConsolePages(signals);
    assert.equal(pages[0]?.page, "services");
    assert.equal(pages[0]?.impressions, 772);
});
