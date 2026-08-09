"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertLegalVaultAccess } from "@/features/legal-vault/lib/access";
import { accountingEntryUpsertSchema } from "@/features/legal-vault/schema";
import {
    BTW_STANDARD_BP,
    calculateBtwFromExcl,
    summarizeBtwQuarter,
    btwQuarterFor,
} from "@/features/legal-vault/lib/btw";
import { recordLegalAuditEvent } from "@/features/legal-vault/lib/audit";
import type {
    AccountingEntry,
    AccountingEntryDirection,
    AccountingPeriod,
    AccountingPeriodKind,
    AccountingTotals,
    ActionResult,
} from "@/features/legal-vault/types";

interface DbAccountingEntry {
    id: string;
    workspace_id: string;
    period_id: string | null;
    direction: AccountingEntryDirection;
    category: string;
    description: string;
    invoice_number: string | null;
    party_name: string | null;
    party_vat_number: string | null;
    amount_excl_btw_cents: number;
    btw_rate_bp: number;
    btw_amount_cents: number;
    amount_incl_btw_cents: number;
    currency: string;
    occurred_on: string;
    document_id: string | null;
    reconciled: boolean;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

interface DbAccountingPeriod {
    id: string;
    workspace_id: string;
    kind: AccountingPeriodKind;
    starts_on: string;
    ends_on: string;
    closed_at: string | null;
    closed_by: string | null;
    created_at: string;
}

export async function listAccountingEntries(options: {
    periodId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
} = {}): Promise<ActionResult<AccountingEntry[]>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        let query = supabase
            .from("accounting_entries")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .order("occurred_on", { ascending: false })
            .limit(options.limit ?? 500);
        if (options.periodId) query = query.eq("period_id", options.periodId);
        if (options.fromDate) query = query.gte("occurred_on", options.fromDate);
        if (options.toDate) query = query.lte("occurred_on", options.toDate);
        const { data, error } = await query;
        if (error) return { success: false, error: error.message };
        return { success: true, data: (data ?? []).map(mapEntryRow) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function upsertAccountingEntry(
    input: Record<string, unknown>,
): Promise<ActionResult<AccountingEntry>> {
    try {
        const parsed = accountingEntryUpsertSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
        }
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const calc = calculateBtwFromExcl(parsed.data.amountExclBtwCents, parsed.data.btwRateBp);
        const period = await ensureBtwPeriod(activeWorkspace.id, parsed.data.occurredOn);
        if (!period.success) return period;

        const row = {
            workspace_id: activeWorkspace.id,
            period_id: period.data.id,
            direction: parsed.data.direction,
            category: parsed.data.category,
            description: parsed.data.description,
            invoice_number: parsed.data.invoiceNumber ?? null,
            party_name: parsed.data.partyName ?? null,
            party_vat_number: parsed.data.partyVatNumber ?? null,
            amount_excl_btw_cents: calc.amountExclBtwCents,
            btw_rate_bp: calc.btwRateBp,
            btw_amount_cents: calc.btwAmountCents,
            amount_incl_btw_cents: calc.amountInclBtwCents,
            currency: parsed.data.currency,
            occurred_on: parsed.data.occurredOn,
            document_id: parsed.data.documentId ?? null,
            notes: parsed.data.notes ?? null,
            created_by: userId,
        } as const;

        const query = parsed.data.id
            ? supabase.from("accounting_entries").update(row).eq("id", parsed.data.id).eq("workspace_id", activeWorkspace.id)
            : supabase.from("accounting_entries").insert(row);

        const { data, error } = await query.select("*").single();
        if (error || !data) return { success: false, error: error?.message ?? "Failed to save entry." };

        revalidatePath("/dashboard/legal-vault/bookkeeping");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: parsed.data.id ? "accounting_entry.updated" : "accounting_entry.created",
            resourceType: "accounting_entry",
            resourceId: data.id,
            metadata: {
                direction: parsed.data.direction,
                category: parsed.data.category,
                occurredOn: parsed.data.occurredOn,
                amountExclBtwCents: calc.amountExclBtwCents,
                btwRateBp: calc.btwRateBp,
            },
        });
        return { success: true, data: mapEntryRow(data) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function importAccountingEntriesCsv(formData: FormData): Promise<ActionResult<{ inserted: number; errors: string[] }>> {
    try {
        const file = formData.get("file");
        if (!(file instanceof File)) return { success: false, error: "Missing CSV file." };
        const text = await file.text();
        const rows = parseCsv(text);
        if (rows.length === 0) return { success: false, error: "CSV has no data rows." };

        let inserted = 0;
        const errors: string[] = [];
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const direction = (row.direction ?? "expense").toLowerCase() as AccountingEntryDirection;
            const amountStr = (row.amount_excl_btw ?? "0").replace(/,/g, ".");
            const amountCents = Math.round(Number.parseFloat(amountStr) * 100);
            const result = await upsertAccountingEntry({
                direction,
                category: row.category ?? "uncategorised",
                description: row.description ?? "",
                invoiceNumber: row.invoice_number ?? null,
                partyName: row.party_name ?? null,
                partyVatNumber: row.party_vat ?? null,
                amountExclBtwCents: Number.isFinite(amountCents) ? amountCents : 0,
                btwRateBp: Number.parseInt(row.btw_rate_bp ?? String(BTW_STANDARD_BP), 10),
                occurredOn: row.occurred_on ?? new Date().toISOString().slice(0, 10),
                currency: row.currency ?? "EUR",
            });
            if (result.success) inserted++;
            else errors.push(`Row ${i + 2}: ${result.error}`);
        }
        revalidatePath("/dashboard/legal-vault/bookkeeping");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "accounting_entries.csv_imported",
            resourceType: "accounting_entry",
            metadata: { inserted, errors: errors.length, rows: rows.length },
        });
        return { success: true, data: { inserted, errors } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function deleteAccountingEntry(id: string): Promise<ActionResult<{ id: string }>> {
    try {
        const { activeWorkspace, userId } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { error } = await supabase
            .from("accounting_entries")
            .delete()
            .eq("id", id)
            .eq("workspace_id", activeWorkspace.id);
        if (error) return { success: false, error: error.message };
        revalidatePath("/dashboard/legal-vault/bookkeeping");
        await recordLegalAuditEvent({
            workspaceId: activeWorkspace.id,
            actorUserId: userId,
            event: "accounting_entry.deleted",
            resourceType: "accounting_entry",
            resourceId: id,
        });
        return { success: true, data: { id } };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function getBtwSummary(periodId: string): Promise<ActionResult<{
    period: AccountingPeriod;
    totals: AccountingTotals;
    entries: AccountingEntry[];
}>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();

        const { data: periodRow, error: periodError } = await supabase
            .from("accounting_periods")
            .select("*")
            .eq("id", periodId)
            .eq("workspace_id", activeWorkspace.id)
            .maybeSingle();
        if (periodError) return { success: false, error: periodError.message };
        if (!periodRow) return { success: false, error: "Period not found." };

        const entriesResult = await listAccountingEntries({ periodId });
        if (!entriesResult.success) return entriesResult;
        const totals = summarizeBtwQuarter(entriesResult.data);

        return {
            success: true,
            data: { period: mapPeriodRow(periodRow), totals, entries: entriesResult.data },
        };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

export async function listBtwQuarters(): Promise<ActionResult<AccountingPeriod[]>> {
    try {
        const { activeWorkspace } = await assertLegalVaultAccess();
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("accounting_periods")
            .select("*")
            .eq("workspace_id", activeWorkspace.id)
            .eq("kind", "btw_quarter")
            .order("starts_on", { ascending: false });
        if (error) return { success: false, error: error.message };
        return { success: true, data: (data ?? []).map(mapPeriodRow) };
    } catch (error: unknown) {
        return { success: false, error: getErrorMessage(error) };
    }
}

// ---------------------------------------------------------------------------

async function ensureBtwPeriod(workspaceId: string, isoDate: string): Promise<ActionResult<AccountingPeriod>> {
    const supabase = await createClient();
    const { startsOn, endsOn } = btwQuarterFor(isoDate);

    const { data: existing } = await supabase
        .from("accounting_periods")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("kind", "btw_quarter")
        .eq("starts_on", startsOn)
        .maybeSingle();
    if (existing) return { success: true, data: mapPeriodRow(existing) };

    const { data, error } = await supabase
        .from("accounting_periods")
        .insert({
            workspace_id: workspaceId,
            kind: "btw_quarter",
            starts_on: startsOn,
            ends_on: endsOn,
        })
        .select("*")
        .single();
    if (error || !data) return { success: false, error: error?.message ?? "Failed to create period." };
    return { success: true, data: mapPeriodRow(data) };
}

function mapEntryRow(row: DbAccountingEntry): AccountingEntry {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        periodId: row.period_id,
        direction: row.direction,
        category: row.category,
        description: row.description,
        invoiceNumber: row.invoice_number,
        partyName: row.party_name,
        partyVatNumber: row.party_vat_number,
        amountExclBtwCents: Number(row.amount_excl_btw_cents),
        btwRateBp: row.btw_rate_bp,
        btwAmountCents: Number(row.btw_amount_cents),
        amountInclBtwCents: Number(row.amount_incl_btw_cents),
        currency: row.currency,
        occurredOn: row.occurred_on,
        documentId: row.document_id,
        reconciled: row.reconciled,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapPeriodRow(row: DbAccountingPeriod): AccountingPeriod {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        kind: row.kind,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        closedAt: row.closed_at,
        closedBy: row.closed_by,
        createdAt: row.created_at,
    };
}

// Tiny CSV parser supporting quoted fields and headers; sufficient for
// operator-curated exports. For more complex bank/accountant CSVs we will
// add a dedicated importer in a follow-up.
function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
    return lines.slice(1).map((line) => {
        const cells = splitCsvLine(line);
        const row: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
            row[headers[i]] = (cells[i] ?? "").trim();
        }
        return row;
    });
}

function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                quoted = false;
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ",") {
            cells.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unexpected error.";
}
