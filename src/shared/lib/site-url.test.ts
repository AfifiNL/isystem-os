import assert from "node:assert/strict";
import test from "node:test";

import { getSiteUrl } from "./site-url";

test("site URL has a neutral local fallback when a client domain is not configured", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    try {
        assert.equal(getSiteUrl(), "http://localhost:3000");
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
});

test("site URL normalizes the configured client domain", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "client.example/";

    try {
        assert.equal(getSiteUrl(), "https://client.example");
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
});
