import { calculateBtwFromExcl } from "@/features/legal-vault/lib/btw";

export interface InvoiceLineInput {
    description: string;
    quantity: number;
    unitPriceCents: number;
    discountCents?: number;
    btwRateBp: number;
    btwReasonCode?: string | null;
}

export interface InvoiceValidationInput {
    supplier: {
        legalName: string;
        addressLine1: string;
        postalCode: string;
        city: string;
        countryCode: string;
        kvkNumber: string;
        btwId?: string | null;
        korEnabled: boolean;
    };
    client: {
        name: string;
        countryCode: string;
        address?: string | null;
        btwId?: string | null;
    };
    reverseCharge?: boolean;
    lines: InvoiceLineInput[];
}

export interface InvoiceTotals {
    subtotalCents: number;
    btwTotalCents: number;
    totalCents: number;
}

export function validateDutchInvoice(input: InvoiceValidationInput): string[] {
    const errors: string[] = [];
    if (!input.supplier.legalName.trim()) errors.push("Supplier legal name is required.");
    if (!input.supplier.addressLine1.trim()) errors.push("Supplier address is required.");
    if (!input.supplier.postalCode.trim()) errors.push("Supplier postal code is required.");
    if (!input.supplier.city.trim()) errors.push("Supplier city is required.");
    if (!/^\d{8}$/.test(input.supplier.kvkNumber.trim())) errors.push("KvK number must be 8 digits.");
    if (!input.supplier.korEnabled && !input.supplier.btwId?.trim()) errors.push("BTW ID is required unless KOR is enabled.");
    if (!input.client.name.trim()) errors.push("Client name is required.");
    if (!input.client.address?.trim()) errors.push("Client address is recommended for a full Dutch VAT invoice.");
    if (input.reverseCharge && !input.client.btwId?.trim()) errors.push("Reverse charge requires the client's VAT ID.");
    if (input.lines.length === 0) errors.push("At least one invoice line is required.");

    for (const [index, line] of input.lines.entries()) {
        if (!line.description.trim()) errors.push(`Line ${index + 1}: description is required.`);
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push(`Line ${index + 1}: quantity must be positive.`);
        if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) errors.push(`Line ${index + 1}: unit price must be non-negative cents.`);
        if (input.supplier.korEnabled && line.btwRateBp !== 0) errors.push(`Line ${index + 1}: KOR invoices cannot charge BTW.`);
        if (input.reverseCharge && line.btwRateBp !== 0) errors.push(`Line ${index + 1}: reverse-charge lines must use 0% BTW.`);
    }

    return errors;
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[]): InvoiceTotals {
    return lines.reduce<InvoiceTotals>((acc, line) => {
        const grossLineBase = Math.round(line.quantity * line.unitPriceCents) - (line.discountCents ?? 0);
        const lineBase = Math.max(0, grossLineBase);
        const calc = calculateBtwFromExcl(lineBase, line.btwRateBp);
        return {
            subtotalCents: acc.subtotalCents + calc.amountExclBtwCents,
            btwTotalCents: acc.btwTotalCents + calc.btwAmountCents,
            totalCents: acc.totalCents + calc.amountInclBtwCents,
        };
    }, { subtotalCents: 0, btwTotalCents: 0, totalCents: 0 });
}
