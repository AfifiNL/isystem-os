// Plain-data constants for the Legal Vault block registry. Lives in its own
// module (without "use client") so puck.config.tsx and the sitemap generator
// can import it safely on the server. React renders live in
// legal-vault-blocks.tsx.

export const LEGAL_VAULT_BLOCK_TYPES = [
    "LegalVaultOverviewBlock",
    "LegalComplianceBadgesBlock",
    "NlZzpAgreementCtaBlock",
    "LegalWorkflowTimelineBlock",
] as const;

export type LegalVaultBlockType = typeof LEGAL_VAULT_BLOCK_TYPES[number];
