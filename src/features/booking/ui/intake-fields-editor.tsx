"use client";

import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

// Mirrors BookingTemplateAdapterDefinition.defaultIntakeSchema.fields so the
// editor compiles to the same shape persisted in booking_form_definitions.schema_json.
export type IntakeFieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date";

export interface IntakeFieldDraft {
    id: string;
    type: IntakeFieldType;
    label: string;
    required: boolean;
    options?: string[];
}

const FIELD_TYPES: Array<{ value: IntakeFieldType; label: string; hasOptions: boolean }> = [
    { value: "text", label: "Short text", hasOptions: false },
    { value: "textarea", label: "Long text", hasOptions: false },
    { value: "select", label: "Dropdown", hasOptions: true },
    { value: "radio", label: "Single choice", hasOptions: true },
    { value: "checkbox", label: "Multi-select", hasOptions: true },
    { value: "number", label: "Number", hasOptions: false },
    { value: "date", label: "Date", hasOptions: false },
];

function fieldTypeHasOptions(type: IntakeFieldType): boolean {
    return FIELD_TYPES.find((entry) => entry.value === type)?.hasOptions ?? false;
}

function createBlankField(): IntakeFieldDraft {
    return {
        id: `field_${Date.now().toString(36)}`,
        type: "text",
        label: "New question",
        required: false,
    };
}

interface IntakeFieldsEditorProps {
    fields: IntakeFieldDraft[];
    onChange: (next: IntakeFieldDraft[]) => void;
}

export function IntakeFieldsEditor({ fields, onChange }: IntakeFieldsEditorProps) {
    function updateField(index: number, patch: Partial<IntakeFieldDraft>) {
        const next = fields.slice();
        const current = next[index];
        const merged: IntakeFieldDraft = { ...current, ...patch };
        // Strip options when switching to a type that doesn't support them.
        if (!fieldTypeHasOptions(merged.type)) {
            delete merged.options;
        } else if (!merged.options) {
            merged.options = [];
        }
        next[index] = merged;
        onChange(next);
    }

    function moveField(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= fields.length) return;
        const next = fields.slice();
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        onChange(next);
    }

    function removeField(index: number) {
        onChange(fields.filter((_, i) => i !== index));
    }

    function addField() {
        onChange([...fields, createBlankField()]);
    }

    function addOption(index: number, value: string) {
        const trimmed = value.trim();
        if (!trimmed) return;
        const current = fields[index];
        const existingOptions = current.options ?? [];
        if (existingOptions.includes(trimmed)) return;
        updateField(index, { options: [...existingOptions, trimmed] });
    }

    function removeOption(index: number, optionIndex: number) {
        const current = fields[index];
        const next = (current.options ?? []).filter((_, i) => i !== optionIndex);
        updateField(index, { options: next });
    }

    return (
        <div className="grid gap-3">
            {fields.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
                    No intake fields yet. Add the first question below.
                </p>
            ) : null}

            {fields.map((field, index) => {
                const hasOptions = fieldTypeHasOptions(field.type);
                return (
                    <article key={`${field.id}-${index}`} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                        <header className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Field {index + 1}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => moveField(index, -1)}
                                    disabled={index === 0}
                                    aria-label="Move field up"
                                >
                                    <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => moveField(index, 1)}
                                    disabled={index === fields.length - 1}
                                    aria-label="Move field down"
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeField(index)}
                                    aria-label="Delete field"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </header>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                Label (shown to the customer)
                                <Input
                                    value={field.label}
                                    onChange={(event) => updateField(index, { label: event.target.value })}
                                    placeholder="What do you need help with?"
                                />
                            </label>
                            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                ID (used in payloads)
                                <Input
                                    value={field.id}
                                    onChange={(event) => updateField(index, { id: event.target.value.replace(/\s+/g, "_") })}
                                    placeholder="preferred_language"
                                />
                            </label>
                            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                                Type
                                <select
                                    value={field.type}
                                    onChange={(event) => updateField(index, { type: event.target.value as IntakeFieldType })}
                                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                                >
                                    {FIELD_TYPES.map((entry) => (
                                        <option key={entry.value} value={entry.value}>{entry.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="inline-flex items-center gap-2 self-end text-sm">
                                <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={(event) => updateField(index, { required: event.target.checked })}
                                />
                                Required
                            </label>
                        </div>

                        {hasOptions ? (
                            <OptionsEditor
                                options={field.options ?? []}
                                onAdd={(value) => addOption(index, value)}
                                onRemove={(optionIndex) => removeOption(index, optionIndex)}
                            />
                        ) : null}
                    </article>
                );
            })}

            <Button type="button" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4" />
                Add field
            </Button>
        </div>
    );
}

interface OptionsEditorProps {
    options: string[];
    onAdd: (value: string) => void;
    onRemove: (index: number) => void;
}

function OptionsEditor({ options, onAdd, onRemove }: OptionsEditorProps) {
    return (
        <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Options</p>
            <div className="mt-2 flex flex-wrap gap-2">
                {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No options yet — add at least one below.</p>
                ) : null}
                {options.map((option, optionIndex) => (
                    <span
                        key={`${option}-${optionIndex}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-3 py-1 text-xs"
                    >
                        {option}
                        <button
                            type="button"
                            onClick={() => onRemove(optionIndex)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Remove option ${option}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>
            <AddOptionForm onAdd={onAdd} />
        </div>
    );
}

function AddOptionForm({ onAdd }: { onAdd: (value: string) => void }) {
    return (
        <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("optionValue") as HTMLInputElement | null;
                if (!input) return;
                onAdd(input.value);
                input.value = "";
                input.focus();
            }}
        >
            <Input name="optionValue" placeholder="Add option (e.g. English)" />
            <Button type="submit" variant="outline">Add</Button>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Helpers for the parent component: convert between the editor draft and the
// JSON shape persisted in booking_form_definitions.schema_json.
// ---------------------------------------------------------------------------

export interface IntakeSchema {
    version: string;
    fields: IntakeFieldDraft[];
}

export function intakeSchemaFromJson(value: unknown): IntakeSchema {
    if (!value || typeof value !== "object") {
        return { version: "1.0.0", fields: [] };
    }
    const obj = value as Record<string, unknown>;
    const version = typeof obj.version === "string" ? obj.version : "1.0.0";
    const rawFields = Array.isArray(obj.fields) ? obj.fields : [];
    const fields: IntakeFieldDraft[] = rawFields
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => {
            const typeRaw = typeof entry.type === "string" ? entry.type : "text";
            const type = (FIELD_TYPES.find((f) => f.value === typeRaw)?.value ?? "text") as IntakeFieldType;
            const draft: IntakeFieldDraft = {
                id: typeof entry.id === "string" && entry.id ? entry.id : `field_${Math.random().toString(36).slice(2, 8)}`,
                type,
                label: typeof entry.label === "string" ? entry.label : "Untitled question",
                required: entry.required === true,
            };
            if (fieldTypeHasOptions(type) && Array.isArray(entry.options)) {
                draft.options = entry.options.filter((value): value is string => typeof value === "string");
            }
            return draft;
        });
    return { version, fields };
}

export function intakeSchemaToJson(schema: IntakeSchema): Record<string, unknown> {
    return {
        version: schema.version,
        fields: schema.fields.map((field) => {
            const out: Record<string, unknown> = {
                id: field.id,
                type: field.type,
                label: field.label,
                required: field.required,
            };
            if (fieldTypeHasOptions(field.type)) {
                out.options = field.options ?? [];
            }
            return out;
        }),
    };
}
