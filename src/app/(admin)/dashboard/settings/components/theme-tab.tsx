import { Button } from "@/shared/ui/button";
import { Layers, Palette, Loader2 } from "lucide-react";

interface ThemeTabProps {
    activeTheme: { themeName: string; version: string; themeKey: string; status: string } | null;
    capabilities: string[];
    themeVersions: Array<{ id: string; themeName: string; version: string; isDefault: boolean }>;
    canManageTheme: boolean;
    nextThemeVersionId: string;
    setNextThemeVersionId: (id: string) => void;
    isThemePending: boolean;
    handleThemeUpdate: () => void;
}

export function ThemeTab({
    activeTheme,
    capabilities,
    themeVersions,
    canManageTheme,
    nextThemeVersionId,
    setNextThemeVersionId,
    isThemePending,
    handleThemeUpdate,
}: ThemeTabProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="space-y-3 bg-card p-5 rounded-md border shadow-sm">
                <label className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Active Workspace Theme
                </label>
                <p className="text-[17px] text-foreground font-medium">
                    {activeTheme ? `${activeTheme.themeName} (${activeTheme.version})` : "Operational Default"}
                </p>
                {activeTheme ? (
                    <p className="text-[15px] text-muted-foreground">{activeTheme.themeKey} · {activeTheme.status}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                    {capabilities.map((capability) => (
                        <span
                            key={capability}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[17px] font-medium text-primary"
                        >
                            {capability}
                        </span>
                    ))}
                </div>
            </div>

            <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
                <div>
                    <h2 className="text-[17px] font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        Workspace theme runtime
                    </h2>
                    <p className="text-[15px] text-muted-foreground mt-1">
                        Switch active workspace dashboard theme version. This controls runtime module composition.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <select
                        value={nextThemeVersionId}
                        onChange={(e) => setNextThemeVersionId(e.target.value)}
                        disabled={!canManageTheme || themeVersions.length === 0 || isThemePending}
                        className="w-full flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                        {themeVersions.map((version) => (
                            <option key={version.id} value={version.id}>
                                {version.themeName} · {version.version}
                                {version.isDefault ? " (default)" : ""}
                            </option>
                        ))}
                        {themeVersions.length === 0 ? <option value="">No versions available</option> : null}
                    </select>

                    <Button onClick={handleThemeUpdate} disabled={!canManageTheme || isThemePending || !nextThemeVersionId}>
                        {isThemePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Apply theme version
                    </Button>
                </div>

                {!canManageTheme ? (
                    <p className="text-[15px] text-muted-foreground">
                        Theme switching requires admin role with <code>theme.manage</code> capability.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
