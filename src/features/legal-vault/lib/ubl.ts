import type { InvoiceLineInput, InvoiceTotals } from "@/features/legal-vault/lib/invoice-validation";

export interface UblInvoiceInput {
    invoiceNumber: string;
    issueDate: string;
    dueDate?: string | null;
    currency: string;
    supplier: {
        legalName: string;
        kvkNumber: string;
        btwId?: string | null;
        addressLine1: string;
        postalCode: string;
        city: string;
        countryCode: string;
    };
    client: {
        name: string;
        btwId?: string | null;
        address?: string | null;
        countryCode: string;
    };
    lines: InvoiceLineInput[];
    totals: InvoiceTotals;
    reverseCharge?: boolean;
    korEnabled?: boolean;
}

export function renderMinimalUblInvoice(input: UblInvoiceInput): string {
    const taxCategory = input.reverseCharge ? "AE" : input.korEnabled ? "E" : "S";
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xml(input.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${xml(input.issueDate)}</cbc:IssueDate>
  ${input.dueDate ? `<cbc:DueDate>${xml(input.dueDate)}</cbc:DueDate>` : ""}
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${xml(input.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>${partyXml(input.supplier.legalName, input.supplier.btwId, input.supplier)}</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${partyXml(input.client.name, input.client.btwId, {
        addressLine1: input.client.address ?? "",
        postalCode: "",
        city: "",
        countryCode: input.client.countryCode,
    })}</cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${xml(input.currency)}">${money(input.totals.btwTotalCents)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${xml(input.currency)}">${money(input.totals.subtotalCents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${xml(input.currency)}">${money(input.totals.subtotalCents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${xml(input.currency)}">${money(input.totals.totalCents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${xml(input.currency)}">${money(input.totals.totalCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${input.lines.map((line, index) => lineXml(line, index + 1, input.currency, taxCategory)).join("\n")}
</Invoice>`;
}

function partyXml(name: string, vatId: string | null | undefined, address: { addressLine1: string; postalCode: string; city: string; countryCode: string }): string {
    return `<cac:Party>
    ${vatId ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
    <cac:PostalAddress>
      <cbc:StreetName>${xml(address.addressLine1)}</cbc:StreetName>
      <cbc:PostalZone>${xml(address.postalCode)}</cbc:PostalZone>
      <cbc:CityName>${xml(address.city)}</cbc:CityName>
      <cac:Country><cbc:IdentificationCode>${xml(address.countryCode)}</cbc:IdentificationCode></cac:Country>
    </cac:PostalAddress>
    <cac:PartyLegalEntity><cbc:RegistrationName>${xml(name)}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party>`;
}

function lineXml(line: InvoiceLineInput, id: number, currency: string, taxCategory: string): string {
    const base = Math.max(0, Math.round(line.quantity * line.unitPriceCents) - (line.discountCents ?? 0));
    return `<cac:InvoiceLine>
    <cbc:ID>${id}</cbc:ID>
    <cbc:InvoicedQuantity>${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${xml(currency)}">${money(base)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xml(line.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory><cbc:ID>${taxCategory}</cbc:ID><cbc:Percent>${line.btwRateBp / 100}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${money(line.unitPriceCents)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
}

function money(cents: number): string {
    return (cents / 100).toFixed(2);
}

function xml(value: string): string {
    return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);
}
