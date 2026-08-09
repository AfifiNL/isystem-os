import assert from "node:assert/strict";
import test from "node:test";
import { gscPropertyMatchesWorkspaceDomain } from "./site-association";

test("matches URL-prefix and domain Search Console properties to the configured workspace", () => {
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("https://client.example/", "client.example"),
        true,
    );
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:client.example", "https://client.example"),
        true,
    );
});

test("fails closed for another domain or malformed property", () => {
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:other.example", "client.example"),
        false,
    );
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:client.example/path", "client.example"),
        false,
    );
});

test("domain properties must match the exact configured workspace host", () => {
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:client.example", "www.client.example"),
        false,
    );
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:client.example", "shop.eu.client.example"),
        false,
    );
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("https://client.example/", "www.client.example"),
        false,
    );
    assert.equal(
        gscPropertyMatchesWorkspaceDomain("sc-domain:client.example", "notclient.example"),
        false,
    );
});
