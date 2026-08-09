import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createFakeCreativeRenderProvider } from "./providers/fake";
import {
    completeCreativeRenderJob,
    processClaimedCreativeRenderJob,
    type CreativeRenderWorkerJob,
    type CreativeRenderWorkerStore,
} from "./worker";

function baseJob(overrides: Partial<CreativeRenderWorkerJob> = {}): CreativeRenderWorkerJob {
    return {
        id: "00000000-0000-4000-8000-000000000001",
        workspace_id: "00000000-0000-4000-8000-0000000000aa",
        template_id: "isystem-agency",
        project_id: "00000000-0000-4000-8000-0000000000bb",
        brief_id: null,
        prompt_id: null,
        provider: "fake",
        provider_model: "fake-render-v1",
        job_kind: "video",
        status: "running",
        attempts: 1,
        max_attempts: 3,
        idempotency_key: "creative:test:job-1",
        provider_job_id: null,
        provider_request: { prompt: "A cinematic operator desk with safe placeholder output.", durationSeconds: 4 },
        provider_response: {},
        duration_seconds: 4,
        result_asset_id: null,
        result_summary: {},
        error_code: null,
        error_message: null,
        submitted_at: null,
        completed_at: null,
        ...overrides,
    };
}

function createMemoryStore(job: CreativeRenderWorkerJob): CreativeRenderWorkerStore & { assets: Array<Record<string, unknown>>; job: CreativeRenderWorkerJob } {
    const store = {
        job,
        assets: [] as Array<Record<string, unknown>>,
        reviews: [] as Array<Record<string, unknown>>,
        async claimNextJob() {
            return this.job.status === "queued" ? { ...this.job, status: "running" as const, attempts: this.job.attempts + 1 } : null;
        },
        async markSubmitted(jobId: string, patch: Partial<CreativeRenderWorkerJob>) {
            assert.equal(jobId, this.job.id);
            this.job = { ...this.job, ...patch };
        },
        async findAssetByJobId(jobId: string) {
            return this.assets.find((asset) => asset.provider_job_id === jobId) as { id: string } | null ?? null;
        },
        async createAsset(input: Record<string, unknown>) {
            const asset = { id: `asset-${this.assets.length + 1}`, ...input };
            this.assets.push(asset);
            return asset as { id: string };
        },
        async completeJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>) {
            assert.equal(jobId, this.job.id);
            this.job = { ...this.job, ...patch };
        },
        async recordReviewEvent(input: Record<string, unknown>) {
            this.reviews.push(input);
        },
        async failJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>) {
            assert.equal(jobId, this.job.id);
            this.job = { ...this.job, ...patch };
        },
    };
    return store;
}

describe("Creative Studio fake render worker lifecycle", () => {
    it("completes a fake queued job through provider submit/status/download/storage metadata", async () => {
        const store = createMemoryStore(baseJob());

        const result = await processClaimedCreativeRenderJob({
            job: store.job,
            store,
            provider: createFakeCreativeRenderProvider(),
            workerId: "test-worker",
        });

        assert.equal(result.success, true);
        assert.equal(store.job.status, "completed");
        assert.equal(store.assets.length, 1);
        assert.equal(store.assets[0].storage_bucket, "creative-renders");
        assert.match(String(store.assets[0].storage_path), /^workspaces\/.+\/projects\/.+\/jobs\/.+\/.+\.json$/);
    });

    it("keeps duplicate completion idempotent and does not create duplicate assets", async () => {
        const store = createMemoryStore(baseJob({ provider_job_id: "fake_existing", status: "provider_processing" }));

        const first = await completeCreativeRenderJob({
            job: store.job,
            store,
            statusResult: { provider: "fake", providerJobId: "fake_existing", status: "completed", resultUrls: ["fake://existing"] },
            downloadResult: {
                provider: "fake",
                providerJobId: "fake_existing",
                bytes: new TextEncoder().encode("fake"),
                mimeType: "application/json",
                fileName: "fake_existing.json",
                checksumSha256: "a".repeat(64),
            },
        });
        const second = await completeCreativeRenderJob({
            job: store.job,
            store,
            statusResult: { provider: "fake", providerJobId: "fake_existing", status: "completed", resultUrls: ["fake://existing"] },
            downloadResult: {
                provider: "fake",
                providerJobId: "fake_existing",
                bytes: new TextEncoder().encode("fake"),
                mimeType: "application/json",
                fileName: "fake_existing.json",
                checksumSha256: "a".repeat(64),
            },
        });

        assert.equal(first.success, true);
        assert.equal(second.success, true);
        assert.equal(store.assets.length, 1);
        assert.equal(store.job.result_asset_id, store.assets[0].id);
    });

    it("requeues retryable failures until max attempts and then fails terminally", async () => {
        const store = createMemoryStore(baseJob({ attempts: 1, max_attempts: 2 }));
        await store.failJob(store.job.id, { status: "running", attempts: 1 });

        const retry = await processClaimedCreativeRenderJob({
            job: store.job,
            store,
            provider: {
                ...createFakeCreativeRenderProvider(),
                async submit() {
                    throw Object.assign(new Error("temporary fake failure"), { code: "temporary", retryable: true });
                },
            },
            workerId: "test-worker",
        });

        assert.equal(retry.success, false);
        assert.equal(store.job.status, "queued");

        store.job = { ...store.job, status: "running", attempts: 2 };
        const terminal = await processClaimedCreativeRenderJob({
            job: store.job,
            store,
            provider: {
                ...createFakeCreativeRenderProvider(),
                async submit() {
                    throw Object.assign(new Error("temporary fake failure"), { code: "temporary", retryable: true });
                },
            },
            workerId: "test-worker",
        });

        assert.equal(terminal.success, false);
        assert.equal(store.job.status, "failed");
    });
});
