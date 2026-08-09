import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import starterConfig from "../isystem.config";
import { clientConfigSchema } from "../src/shared/lib/client-config/schema";
import {
    collectEnvironmentStatus,
    isStarterConfigPlaceholder,
    isVersionInRange,
    parseEnvText,
} from "./doctor.mjs";
import { loadProvisioningEnvironment, resolveClientConfigPath } from "./seed-client";
import { ensureEnvLocal } from "./setup.mjs";

test("the checked-in starter config is neutral, local, and schema-valid", () => {
    const parsed = clientConfigSchema.parse(starterConfig);

    assert.equal(parsed.site.domain.endsWith(".invalid"), true);
    assert.equal(parsed.site.contactEmail.endsWith("@example.invalid"), true);
    assert.equal(existsSync(resolve(process.cwd(), "public", parsed.brand.logo.lightUrl.slice(1))), true);
    assert.equal(isStarterConfigPlaceholder(parsed), true);
});

test("seed config defaults to the root starter and still accepts an override", () => {
    assert.equal(
        resolveClientConfigPath("/workspace", {}),
        "/workspace/isystem.config.ts",
    );
    assert.equal(
        resolveClientConfigPath("/workspace", {
            CLIENT_CONFIG: "clients/acme/client.config.ts",
        }),
        "/workspace/clients/acme/client.config.ts",
    );
});

test("client provisioning loads the .env.local file created by setup", (t) => {
    const directory = mkdtempSync(join(tmpdir(), "isystem-seed-env-"));
    const variableName = "ISYSTEM_BOOTSTRAP_ENV_TEST";
    t.after(() => {
        delete process.env[variableName];
        rmSync(directory, { recursive: true, force: true });
    });
    writeFileSync(join(directory, ".env.local"), `${variableName}=loaded\n`);

    loadProvisioningEnvironment(directory);

    assert.equal(process.env[variableName], "loaded");
});

test("setup creates .env.local once and preserves an existing file", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "isystem-setup-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));

    writeFileSync(join(directory, ".env.example"), "SAFE_TEMPLATE=value\n");
    const created = await ensureEnvLocal({ cwd: directory });
    assert.equal(created.outcome, "created");
    assert.equal(readFileSync(join(directory, ".env.local"), "utf8"), "SAFE_TEMPLATE=value\n");

    writeFileSync(join(directory, ".env.local"), "PRIVATE_SECRET=keep-me\n");
    writeFileSync(join(directory, ".env.example"), "SAFE_TEMPLATE=changed\n");
    const preserved = await ensureEnvLocal({ cwd: directory });

    assert.equal(preserved.outcome, "preserved");
    assert.equal(readFileSync(join(directory, ".env.local"), "utf8"), "PRIVATE_SECRET=keep-me\n");
});

test("setup requires an affirmative interactive decision before replacement", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "isystem-replace-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));

    writeFileSync(join(directory, ".env.example"), "SAFE_TEMPLATE=new\n");
    writeFileSync(join(directory, ".env.local"), "PRIVATE_SECRET=old\n");

    const declined = await ensureEnvLocal({
        cwd: directory,
        replace: true,
        isInteractive: true,
        confirmReplace: async () => false,
    });
    assert.equal(declined.outcome, "preserved");
    assert.equal(readFileSync(join(directory, ".env.local"), "utf8"), "PRIVATE_SECRET=old\n");

    const accepted = await ensureEnvLocal({
        cwd: directory,
        replace: true,
        isInteractive: true,
        confirmReplace: async () => true,
    });
    assert.equal(accepted.outcome, "replaced");
    assert.equal(readFileSync(join(directory, ".env.local"), "utf8"), "SAFE_TEMPLATE=new\n");
});

test("setup refuses replacement in a non-interactive process", async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "isystem-noninteractive-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));

    writeFileSync(join(directory, ".env.example"), "SAFE_TEMPLATE=new\n");
    writeFileSync(join(directory, ".env.local"), "PRIVATE_SECRET=old\n");

    await assert.rejects(
        ensureEnvLocal({ cwd: directory, replace: true, isInteractive: false }),
        /interactive confirmation/i,
    );
    assert.equal(readFileSync(join(directory, ".env.local"), "utf8"), "PRIVATE_SECRET=old\n");
});

test("doctor parses env files without exposing their values", () => {
    const secret = ["sb", "secret", "do", "not", "print", "this", "value"].join("_");
    const parsed = parseEnvText([
        "NEXT_PUBLIC_SITE_URL=https://example.invalid",
        `SUPABASE_SERVICE_ROLE_KEY=${secret}`,
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    ].join("\n"));
    const status = collectEnvironmentStatus(parsed, [
        "NEXT_PUBLIC_SITE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);

    assert.deepEqual(status, [
        { name: "NEXT_PUBLIC_SITE_URL", state: "placeholder" },
        { name: "SUPABASE_SERVICE_ROLE_KEY", state: "configured" },
        { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", state: "missing" },
    ]);
    assert.equal(JSON.stringify(status).includes(secret), false);
});

test("doctor rejects short or swapped Supabase keys", () => {
    assert.deepEqual(collectEnvironmentStatus({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
        SUPABASE_SERVICE_ROLE_KEY: "y",
    }, ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]), [
        { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", state: "invalid" },
        { name: "SUPABASE_SERVICE_ROLE_KEY", state: "invalid" },
    ]);

    const sameKey = "a_valid_jwt_segment.a_valid_jwt_segment.a_valid_jwt_segment";
    assert.deepEqual(collectEnvironmentStatus({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: sameKey,
        SUPABASE_SERVICE_ROLE_KEY: sameKey,
    }, ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]), [
        { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", state: "invalid" },
        { name: "SUPABASE_SERVICE_ROLE_KEY", state: "invalid" },
    ]);
});

test("doctor requires a strong booking management capability secret", () => {
    assert.deepEqual(
        collectEnvironmentStatus(
            { BOOKING_MANAGEMENT_SECRET: "short" },
            ["BOOKING_MANAGEMENT_SECRET"],
        ),
        [{ name: "BOOKING_MANAGEMENT_SECRET", state: "invalid" }],
    );
    assert.deepEqual(
        collectEnvironmentStatus(
            { BOOKING_MANAGEMENT_SECRET: "a".repeat(32) },
            ["BOOKING_MANAGEMENT_SECRET"],
        ),
        [{ name: "BOOKING_MANAGEMENT_SECRET", state: "configured" }],
    );
    assert.deepEqual(
        collectEnvironmentStatus(
            { BOOKING_MANAGEMENT_SECRET_PREVIOUS: "short" },
            ["BOOKING_MANAGEMENT_SECRET_PREVIOUS"],
        ),
        [{ name: "BOOKING_MANAGEMENT_SECRET_PREVIOUS", state: "invalid" }],
    );

    const doctorSource = readFileSync(resolve(process.cwd(), "scripts/doctor.mjs"), "utf8");
    assert.match(doctorSource, /const STAGED_ENV = \[[\s\S]*?"BOOKING_MANAGEMENT_SECRET"/);
    assert.match(doctorSource, /OPTIONAL_ROTATION_ENV = \["BOOKING_MANAGEMENT_SECRET_PREVIOUS"\]/);
});

test("doctor rejects malformed or insecure remote starter URLs without printing them", () => {
    const invalidUrl = "http://remote-host.test/private-path";
    const status = collectEnvironmentStatus(
        {
            NEXT_PUBLIC_SITE_URL: invalidUrl,
            NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        },
        ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    );

    assert.deepEqual(status, [
        { name: "NEXT_PUBLIC_SITE_URL", state: "invalid" },
        { name: "NEXT_PUBLIC_SUPABASE_URL", state: "invalid" },
    ]);
    assert.equal(JSON.stringify(status).includes(invalidUrl), false);
});

test("doctor validates the supported Node and npm version windows", () => {
    assert.equal(isVersionInRange("22.13.0", ">=22.13.0 <23"), true);
    assert.equal(isVersionInRange("22.12.9", ">=22.13.0 <23"), false);
    assert.equal(isVersionInRange("23.0.0", ">=22.13.0 <23"), false);
    assert.equal(isVersionInRange("10.0.0", ">=10"), true);
    assert.equal(isVersionInRange("9.9.9", ">=10"), false);
});
