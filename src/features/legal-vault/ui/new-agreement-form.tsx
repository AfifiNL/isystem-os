"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import type { LegalAgreementTemplate, TemplateVariable } from "@/features/legal-vault/types";

interface NewAgreementFormProps {
    templates: LegalAgreementTemplate[];
    templatesError: string | null;
    initialTemplateSlug?: string | null;
}

export function NewAgreementForm({ templates, templatesError, initialTemplateSlug }: NewAgreementFormProps) {
    const router = useRouter();
    const [templateSlug, setTemplateSlug] = useState<string>(
        initialTemplateSlug && templates.some((template) => template.slug === initialTemplateSlug)
            ? initialTemplateSlug
            : templates[0]?.slug ?? "",
    );
    const [intent, setIntent] = useState("");
    const [partyName, setPartyName] = useState("");
    const [partyEmail, setPartyEmail] = useState("");
    const [effectiveDate, setEffectiveDate] = useState(today());
    const [contextValues, setContextValues] = useState<Record<string, string>>({});
    const [rationale, setRationale] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const currentTemplate = useMemo(
        () => templates.find((t) => t.slug === templateSlug) ?? null,
        [templates, templateSlug],
    );

    // Reset known-context values whenever the chosen template changes, but
    // seed any variables that have a default so the operator sees a starting
    // point instead of empty fields.
    useEffect(() => {
        if (!currentTemplate) {
            setContextValues({});
            return;
        }
        const seeded: Record<string, string> = {};
        for (const variable of currentTemplate.variables) {
            if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
                seeded[variable.key] = String(variable.defaultValue);
            }
        }
        setContextValues(seeded);
    }, [currentTemplate]);

    function updateContext(key: string, value: string) {
        setContextValues((prev) => ({ ...prev, [key]: value }));
    }

    function submit() {
        setError(null);
        setRationale(null);

        // Only forward keys the operator actually filled; leave empties to
        // the AI so it doesn't overwrite generated suggestions with "".
        const parsedContext = Object.fromEntries(
            Object.entries(contextValues)
                .filter(([, value]) => value.trim().length > 0)
                .map(([key, value]) => [key, coerceVariableValue(currentTemplate, key, value)]),
        ) as Record<string, string | number>;

        startTransition(async () => {
            const response = await fetch("/api/legal/generate-agreement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateSlug,
                    intent,
                    partyName,
                    partyEmail,
                    effectiveDate,
                    knownContext: Object.keys(parsedContext).length > 0 ? parsedContext : undefined,
                }),
            });

            const payload = await response.json().catch(() => null) as
                | { success: true; agreement: { id: string }; rationale: string }
                | { error: string }
                | null;

            if (!response.ok || !payload || "error" in payload) {
                setError(payload && "error" in payload ? payload.error : `HTTP ${response.status}`);
                return;
            }

            setRationale(payload.rationale);
            router.push(`/dashboard/legal-vault/agreements/${payload.agreement.id}`);
        });
    }

    return (
        <section className="grid gap-6 px-8 py-6 lg:grid-cols-[2fr_3fr]">
            <div className="space-y-4">
                {templatesError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[17px] text-destructive">
                        {templatesError}
                    </div>
                ) : null}

                <div>
                    <label className="text-[17px] font-medium">Template</label>
                    <select
                        value={templateSlug}
                        onChange={(event) => setTemplateSlug(event.target.value)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]"
                    >
                        {templates.map((t) => (
                            <option key={t.id} value={t.slug}>
                                [{t.category}] {t.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[17px] font-medium">Counterparty name</label>
                        <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Acme B.V." className="text-[17px]" />
                    </div>
                    <div>
                        <label className="text-[17px] font-medium">Counterparty email</label>
                        <Input
                            type="email"
                            value={partyEmail}
                            onChange={(e) => setPartyEmail(e.target.value)}
                            placeholder="legal@acme.com"
                            className="text-[17px]"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[17px] font-medium">Effective date</label>
                    <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="text-[17px]" />
                </div>

                <div>
                    <label className="text-[17px] font-medium">Intent / scope</label>
                    <Textarea
                        rows={4}
                        value={intent}
                        onChange={(e) => setIntent(e.target.value)}
                        placeholder="Describe the engagement in plain language — scope, rate, term, anything material."
                        className="text-[17px]"
                    />
                </div>

                {currentTemplate && currentTemplate.variables.length > 0 ? (
                    <fieldset className="rounded-md border border-border/60 bg-muted/30 p-3">
                        <legend className="px-1 text-[15px] font-medium uppercase tracking-wide text-muted-foreground">
                            Known context (optional — leave blank to let the AI fill)
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {currentTemplate.variables.map((variable) => (
                                <ContextField
                                    key={variable.key}
                                    variable={variable}
                                    value={contextValues[variable.key] ?? ""}
                                    onChange={(v) => updateContext(variable.key, v)}
                                />
                            ))}
                        </div>
                        <p className="mt-2 text-[15px] text-muted-foreground">
                            Anything you type here always wins over AI-generated values. Use it for facts
                            the AI can&apos;t safely guess: KvK number, BTW-id, IBAN, exact rate.
                        </p>
                    </fieldset>
                ) : null}

                {error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[17px] text-destructive">
                        {error}
                    </div>
                ) : null}

                <Button type="button" onClick={submit} disabled={isPending || !intent || !partyName || !partyEmail}>
                    {isPending ? "Generating…" : "Generate draft agreement"}
                </Button>
            </div>

            <aside className="space-y-4 rounded-md border border-border/60 bg-card p-4">
                {currentTemplate ? (
                    <>
                        <header>
                            <p className="text-[15px] uppercase tracking-wide text-muted-foreground">Template</p>
                            <h2 className="text-[19px] font-semibold">{currentTemplate.name}</h2>
                            <p className="text-[15px] text-muted-foreground">
                                {currentTemplate.locale.toUpperCase()} · {currentTemplate.jurisdiction} · v{currentTemplate.version}
                            </p>
                        </header>
                        <div>
                            <p className="text-[15px] font-medium uppercase tracking-wide text-muted-foreground">
                                Variables the AI will fill
                            </p>
                            <ul className="mt-2 space-y-1 text-[15px]">
                                {currentTemplate.variables.map((v) => (
                                    <li key={v.key} className="flex justify-between gap-2">
                                        <span><code>{v.key}</code> — {v.label}</span>
                                        <span className="text-muted-foreground">
                                            {v.required ? "required" : "optional"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                ) : (
                    <p className="text-[17px] text-muted-foreground">Pick a template to see its variables.</p>
                )}

                {rationale ? (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-[15px] text-emerald-700 dark:text-emerald-300">
                        <p className="font-medium">AI rationale</p>
                        <p className="mt-1 whitespace-pre-wrap">{rationale}</p>
                    </div>
                ) : null}
            </aside>
        </section>
    );
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

interface ContextFieldProps {
    variable: TemplateVariable;
    value: string;
    onChange: (value: string) => void;
}

function ContextField({ variable, value, onChange }: ContextFieldProps) {
    const helper = variable.description ?? null;
    const placeholder = variable.defaultValue !== undefined ? String(variable.defaultValue) : undefined;

    const inputType = (() => {
        switch (variable.type) {
            case "date": return "date";
            case "number":
            case "money_cents":
                return "number";
            default: return "text";
        }
    })();

    return (
        <div className={variable.type === "multiline" ? "sm:col-span-2" : undefined}>
            <label className="text-[15px] font-medium">
                {variable.label}
                <span className="ml-1 font-mono text-muted-foreground">{variable.key}</span>
            </label>
            {variable.type === "multiline" ? (
                <Textarea
                    rows={2}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="text-[17px]"
                />
            ) : (
                <Input
                    type={inputType}
                    inputMode={variable.type === "money_cents" ? "decimal" : undefined}
                    step={variable.type === "money_cents" ? "0.01" : undefined}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="text-[17px]"
                />
            )}
            {helper ? <p className="mt-0.5 text-[15px] text-muted-foreground">{helper}</p> : null}
        </div>
    );
}

// Cast text inputs to the right primitive based on the template variable
// type so the API receives the same shape it would have gotten from the
// previous JSON textarea (number for numeric fields, string for everything
// else). money_cents stays a string because the template engine and the
// generation route both accept "85.00"-style strings.
function coerceVariableValue(
    template: LegalAgreementTemplate | null,
    key: string,
    raw: string,
): string | number {
    const variable = template?.variables.find((v) => v.key === key);
    if (variable?.type === "number") {
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : raw;
    }
    return raw;
}
