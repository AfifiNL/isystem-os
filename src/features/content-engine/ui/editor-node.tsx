"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Bot, Loader2, Save, CheckCircle2, Eye, Code2 } from "lucide-react";
import { updateContentItem } from "../actions";
import { StructuredNodeViewer } from "./structured-node-viewer";
import { ProBadge } from "@/shared/ui/pro-badge";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";

interface EditorNodeProps {
    contentId: string;
    nodeId: string;
    label: string;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    value: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    onChange: (val: any) => void;
    currentMetadata?: Record<string, unknown>;
    aiGenerationEnabled?: boolean;
}

export function EditorNode({
    contentId,
    nodeId,
    label,
    value,
    onChange,
    currentMetadata,
    aiGenerationEnabled = true,
}: EditorNodeProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

    const handleGenerate = async () => {
        if (!aiGenerationEnabled) return;
        setIsGenerating(true);
        try {
            const res = await fetch("/api/generate-node", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contentId,
                    nodeType: nodeId,
                }),
            });
            const data = await res.json();
            if (res.ok && data.text) {
                onChange(data.text);
            } else {
                console.error("Failed to generate node content:", data.error);
            }
        } catch (err) {
            console.error("Network error during generation:", err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedMetadata = {
                ...currentMetadata,
                generated_formats: {
                    ...(currentMetadata?.generated_formats as Record<string, string> || {}),
                    [nodeId]: value,
                },
            };

            const result = await updateContentItem(contentId, {
                metadata: updatedMetadata,
            });

            if (!result.error) {
                setLastSaved(new Date());
            }
        } catch (err) {
            console.error("Error saving node:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const displayValue = typeof value === "object" ? JSON.stringify(value, null, 2) : (value || "");

    const handleTextChange = (val: string) => {
        try {
            const parsed = JSON.parse(val);
            onChange(parsed);
        } catch {
            onChange(val);
        }
    };

    return (
        <div className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card shadow-sm sm:h-full">
            <div className="flex min-w-0 flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold">{label}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Edit {label.toLowerCase()}.
                    </p>
                </div>
                <div className="grid w-full gap-2 sm:flex sm:w-auto sm:items-center">
                    {lastSaved && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || isSaving || !aiGenerationEnabled}
                        variant="secondary"
                        size="sm"
                        className="gap-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 sm:w-auto dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        AI {value ? 'Rewrite' : 'Generate'}
                        {!aiGenerationEnabled ? <ProBadge className="ml-1" /> : null}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isGenerating}
                        size="sm"
                        className="gap-2 sm:w-auto"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Node
                    </Button>
                </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 rounded-lg bg-muted p-1 sm:flex">
                    <button
                        onClick={() => setViewMode("preview")}
                        className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-2 rounded-md transition-all ${viewMode === "preview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Eye className="w-3.5 h-3.5" /> Visual Preview
                    </button>
                    <button
                        onClick={() => setViewMode("raw")}
                        className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-2 rounded-md transition-all ${viewMode === "raw" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Code2 className="w-3.5 h-3.5" /> Raw Data
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                {!aiGenerationEnabled ? (
                    <div className="p-4 border-b bg-muted/10">
                        <ProFeatureNotice
                            compact
                            title={`${label} AI assist is a Pro capability`}
                            description={`Use Pro to generate and refine ${label.toLowerCase()} faster.`}
                            ctaLabel={`Activate Pro for ${label}`}
                            benefits={[
                                `Generate a first draft.`,
                                `Rewrite without leaving the editor.`,
                                `Keep manual editing available.`,
                            ]}
                        />
                    </div>
                ) : null}
                <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 ${viewMode === "preview" ? "block" : "hidden"}`}>
                    <StructuredNodeViewer nodeId={nodeId} contentId={contentId} aiGenerationEnabled={aiGenerationEnabled} data={typeof value === "string" ? (() => { try { return JSON.parse(value) } catch { return null } })() : value} />
                </div>
                <div className={`absolute inset-0 p-4 ${viewMode === "raw" ? "block" : "hidden"}`}>
                    <Textarea
                        value={displayValue}
                        onChange={(e) => handleTextChange(e.target.value)}
                        placeholder={`Write your ${label.toLowerCase()} here, or use the AI outline generator...`}
                        className="w-full h-full resize-none font-mono text-xs border-muted focus-visible:ring-indigo-500 bg-background leading-relaxed shadow-inner"
                    />
                </div>
            </div>

            {isGenerating && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                    <div className="bg-card p-6 rounded-xl shadow-xl border flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                        <div className="text-center">
                            <h3 className="font-semibold text-foreground">Generating {label}...</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mt-1">
                                Using AI to analyze your core context and craft high-converting copy.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
