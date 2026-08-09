import { BUSINESS_SPINE_WORKFLOW_EVENTS, type WorkflowEventKey } from "@/features/business-spine/workflow-events";
import type { ExternalPublicationPackageRow } from "../types";

export type ExternalPublishingWorkflowEventInput = {
    workspaceId: string;
    packageId: string;
    eventKey: WorkflowEventKey;
    sourceEntityType: "external_publication_package";
    sourceEntityId: string;
    payload: Record<string, unknown>;
    idempotencyValues: { packageId: string };
};

export function buildExternalPublishingWorkflowEventInput(input: {
    workspaceId: string;
    packageId: string;
    eventKey: WorkflowEventKey;
    payload?: Record<string, unknown>;
}): ExternalPublishingWorkflowEventInput {
    return {
        workspaceId: input.workspaceId,
        packageId: input.packageId,
        eventKey: input.eventKey,
        sourceEntityType: "external_publication_package",
        sourceEntityId: input.packageId,
        payload: { packageId: input.packageId, ...(input.payload ?? {}) },
        idempotencyValues: { packageId: input.packageId },
    };
}

export function externalPublishingWorkflowPayload(pkg: ExternalPublicationPackageRow, extra: Record<string, unknown> = {}) {
    return {
        packageId: pkg.id,
        topic: pkg.topic,
        platform: pkg.platform,
        status: pkg.status,
        targetUrl: pkg.target_url,
        manualPublishedUrl: pkg.manual_published_url,
        utmSource: pkg.utm_source,
        utmMedium: pkg.utm_medium,
        utmCampaign: pkg.utm_campaign,
        utmContent: pkg.utm_content,
        ...extra,
    };
}

export const EXTERNAL_PUBLISHING_WORKFLOW_EVENT_BY_TRANSITION = {
    readyForReview: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW,
    exported: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED,
    publishedManual: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL,
    staleNoTraffic: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC,
} as const;
