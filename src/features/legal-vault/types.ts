// Domain types for Legal Vault & Bookkeeping.
//
// These are the shape the UI and server actions agree on. Database row types
// (Tables<"legal_documents"> etc.) live in shared/lib/supabase/database.types
// once the migration is applied and types are regenerated; this file defines
// the narrowed shapes the application actually consumes (camelCased,
// nullable where the column allows NULL, with enums replaced by string
// unions for ergonomics).

export type LegalDocumentKind =
    | "agreement"
    | "invoice"
    | "receipt"
    | "accounting_export"
    | "identity"
    | "correspondence"
    | "other";

export type LegalAgreementStatus =
    | "draft"
    | "sent"
    | "viewed"
    | "signed"
    | "void"
    | "expired";

export type LegalTemplateCategory =
    | "dvo"
    | "nda"
    | "dpa"
    | "invoice"
    | "quote"
    | "generic";

export type LegalSignatureEventKind =
    | "sent"
    | "opened"
    | "viewed"
    | "signed"
    | "declined"
    | "expired"
    | "voided";

export type AccountingPeriodKind = "btw_quarter" | "fiscal_year";

export type AccountingEntryDirection = "income" | "expense";

export type AccountingReportKind =
    | "btw_prep"
    | "year_overview"
    | "ledger_export";

export type AccountingReportFormat = "pdf" | "csv" | "ubl_xml";

export interface LegalDocument {
    id: string;
    workspaceId: string;
    kind: LegalDocumentKind;
    title: string;
    storageBucket: string;
    storagePath: string;
    sha256: string;
    sizeBytes: number;
    mime: string;
    clientId: string | null;
    relatedAgreementId: string | null;
    relatedEntryId: string | null;
    retentionUntil: string;
    metadata: Record<string, unknown>;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface LegalAgreementTemplate {
    id: string;
    workspaceId: string | null; // null = system template
    slug: string;
    name: string;
    locale: string;
    jurisdiction: string;
    category: LegalTemplateCategory;
    bodyMdx: string;
    variables: TemplateVariable[];
    isActive: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface TemplateVariable {
    key: string;
    label: string;
    type: "string" | "number" | "date" | "money_cents" | "multiline";
    required: boolean;
    description?: string;
    defaultValue?: string | number;
}

export interface LegalAgreement {
    id: string;
    workspaceId: string;
    templateId: string | null;
    documentId: string | null;
    clientId: string | null;
    bookingId: string | null;
    status: LegalAgreementStatus;
    title: string;
    partyName: string;
    partyEmail: string;
    effectiveDate: string | null;
    expiresAt: string | null;
    signedAt: string | null;
    signedSha256: string | null;
    payload: Record<string, unknown>;
    publicToken: string;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LegalSignatureEvent {
    id: string;
    workspaceId: string;
    agreementId: string;
    event: LegalSignatureEventKind;
    actorEmail: string | null;
    actorIp: string | null;
    actorUserAgent: string | null;
    payloadSha256: string | null;
    metadata: Record<string, unknown>;
    occurredAt: string;
}

export interface AccountingPeriod {
    id: string;
    workspaceId: string;
    kind: AccountingPeriodKind;
    startsOn: string;
    endsOn: string;
    closedAt: string | null;
    closedBy: string | null;
    createdAt: string;
}

export interface AccountingEntry {
    id: string;
    workspaceId: string;
    periodId: string | null;
    direction: AccountingEntryDirection;
    category: string;
    description: string;
    invoiceNumber: string | null;
    partyName: string | null;
    partyVatNumber: string | null;
    amountExclBtwCents: number;
    btwRateBp: number;
    btwAmountCents: number;
    amountInclBtwCents: number;
    currency: string;
    occurredOn: string;
    documentId: string | null;
    reconciled: boolean;
    notes: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AccountingReport {
    id: string;
    workspaceId: string;
    periodId: string | null;
    kind: AccountingReportKind;
    format: AccountingReportFormat;
    documentId: string | null;
    totals: AccountingTotals;
    generatedAt: string;
    generatedBy: string | null;
}

export interface AccountingTotals {
    income_excl_btw_cents: number;
    income_btw_cents: number;
    expense_excl_btw_cents: number;
    expense_btw_cents: number;
    btw_to_pay_cents: number;
    entry_count: number;
}

// Action-result envelope. Server actions return this shape and never throw.
export type ActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };
