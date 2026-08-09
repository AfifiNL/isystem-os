"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WINDOW_META } from "@/features/admin/lib/window-meta";

export interface WindowInstance {
    key: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isMinimized: boolean;
    isMaximized: boolean;
    zIndex: number;
}

interface WindowManagerContextType {
    openWindows: WindowInstance[];
    activeWindowKey: string | null;
    openWindow: (key: string) => void;
    closeWindow: (key: string) => void;
    minimizeWindow: (key: string) => void;
    maximizeWindow: (key: string) => void;
    focusWindow: (key: string) => void;
    updateWindowPosition: (key: string, x: number, y: number) => void;
    updateWindowSize: (key: string, width: number, height: number) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

// v2 intentionally resets legacy window geometry. The old layout preserved
// overlapping card-like windows and a bottom-heavy taskbar composition; the
// focus-rail shell now opens each app as a maximized working surface.
const LOCAL_STORAGE_KEY = "isystem_mdi_windows_layout_focus_rail_v2";

export function useWindowManager() {
    const context = useContext(WindowManagerContext);
    if (!context) {
        throw new Error("useWindowManager must be used within a WindowManagerProvider");
    }
    return context;
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const [openWindows, setOpenWindows] = useState<WindowInstance[]>([]);
    const [activeWindowKey, setActiveWindowKey] = useState<string | null>(null);

    // Save layouts to localStorage
    const saveLayouts = useCallback((windows: WindowInstance[]) => {
        if (typeof window === "undefined") return;
        try {
            const layoutData = windows.map(w => ({
                key: w.key,
                x: w.x,
                y: w.y,
                width: w.width,
                height: w.height,
                isMinimized: w.isMinimized,
                isMaximized: w.isMaximized,
                zIndex: w.zIndex
            }));
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(layoutData));
        } catch {
            // Layout persistence is an enhancement; never break dashboard use.
        }
    }, []);

    // Load layouts from localStorage on mount
    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Array<Partial<WindowInstance> & { key: string }>;
                const loaded: WindowInstance[] = [];
                parsed.forEach(item => {
                    const meta = WINDOW_META[item.key];
                    if (meta) {
                        loaded.push({
                            key: item.key,
                            title: meta.title,
                            x: typeof item.x === "number" ? item.x : 50 + loaded.length * 25,
                            y: typeof item.y === "number" ? item.y : 50 + loaded.length * 25,
                            width: typeof item.width === "number" ? item.width : 800,
                            height: typeof item.height === "number" ? item.height : 600,
                            isMinimized: Boolean(item.isMinimized),
                            isMaximized: Boolean(item.isMaximized),
                            zIndex: typeof item.zIndex === "number" ? item.zIndex : 10 + loaded.length
                        });
                    }
                });
                if (loaded.length > 0) {
                    setOpenWindows(loaded);

                    // Set active key to the highest zIndex window
                    const active = loaded
                        .filter(w => !w.isMinimized)
                        .sort((a, b) => b.zIndex - a.zIndex)[0];
                    if (active) {
                        setActiveWindowKey(active.key);
                    }
                }
            } catch {
                // Clear corrupt storage
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
    }, []);

    // Helper to focus a window and elevate its z-index
    const focusWindow = useCallback((key: string) => {
        setActiveWindowKey(key);

        // Sync URL to match active window if different
        const currentRouteKey = pathname.startsWith("/dashboard/")
            ? pathname.slice("/dashboard/".length).split("/")[0]
            : null;
        if (currentRouteKey !== key) {
            router.push(`/dashboard/${key}`);
        }

        setOpenWindows(prev => {
            const nextZ = Math.max(...prev.map(w => w.zIndex), 10) + 1;
            const updated = prev.map(w => {
                if (w.key === key) {
                    return { ...w, zIndex: nextZ, isMinimized: false };
                }
                return w;
            });
            saveLayouts(updated);
            return updated;
        });
    }, [pathname, router, saveLayouts]);

    // Handle routing synchronization: if route changes to /dashboard/xyz, open/focus xyz
    useEffect(() => {
        if (!pathname.startsWith("/dashboard/")) return;
        const key = pathname.slice("/dashboard/".length).split("/")[0];
        if (!key || key === "dashboard") return;

        const meta = WINDOW_META[key];
        if (!meta) return;

        setOpenWindows(prev => {
            const exists = prev.find(w => w.key === key);
            if (exists) {
                // Focus existing window asynchronously to avoid render loops
                setTimeout(() => focusWindow(key), 0);
                return prev;
            }

            // Create new window
            const nextZ = Math.max(...prev.map(w => w.zIndex), 10) + 1;
            const newWindow: WindowInstance = {
                key,
                title: meta.title,
                x: 0,
                y: 0,
                width: 900,
                height: 650,
                isMinimized: false,
                isMaximized: true,
                zIndex: nextZ
            };
            const updated = [...prev, newWindow];
            setActiveWindowKey(key);
            saveLayouts(updated);
            return updated;
        });
    }, [pathname, focusWindow, saveLayouts]);

    const openWindow = useCallback((key: string) => {
        const meta = WINDOW_META[key];
        if (!meta) return;

        router.push(`/dashboard/${key}`);
    }, [router]);

    const closeWindow = useCallback((key: string) => {
        const currentRouteKey = pathname.startsWith("/dashboard/")
            ? pathname.slice("/dashboard/".length).split("/")[0]
            : null;
        const remaining = openWindows.filter(w => w.key !== key && !w.isMinimized);
        const nextKey = remaining.length > 0
            ? [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0]?.key ?? null
            : null;
        const shouldRoute = currentRouteKey === key || remaining.length === 0;

        setOpenWindows(prev => {
            const updated = prev.filter(w => w.key !== key);
            saveLayouts(updated);
            return updated;
        });

        if (shouldRoute) {
            if (nextKey) {
                setActiveWindowKey(nextKey);
                router.push(`/dashboard/${nextKey}`);
            } else {
                setActiveWindowKey(null);
                router.push("/dashboard");
            }
        }
    }, [openWindows, pathname, router, saveLayouts]);

    const minimizeWindow = useCallback((key: string) => {
        const currentRouteKey = pathname.startsWith("/dashboard/")
            ? pathname.slice("/dashboard/".length).split("/")[0]
            : null;
        const remaining = openWindows.filter(w => w.key !== key && !w.isMinimized);
        const nextKey = remaining.length > 0
            ? [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0]?.key ?? null
            : null;
        const shouldRoute = currentRouteKey === key || remaining.length === 0;

        setOpenWindows(prev => {
            const updated = prev.map(w => {
                if (w.key === key) {
                    return { ...w, isMinimized: true };
                }
                return w;
            });
            saveLayouts(updated);
            return updated;
        });

        if (shouldRoute) {
            if (nextKey) {
                setActiveWindowKey(nextKey);
                router.push(`/dashboard/${nextKey}`);
            } else {
                setActiveWindowKey(null);
                router.push("/dashboard");
            }
        }
    }, [openWindows, pathname, router, saveLayouts]);

    const maximizeWindow = useCallback((key: string) => {
        setOpenWindows(prev => {
            const updated = prev.map(w => {
                if (w.key === key) {
                    return { ...w, isMaximized: !w.isMaximized, isMinimized: false };
                }
                return w;
            });
            saveLayouts(updated);
            return updated;
        });
        focusWindow(key);
    }, [focusWindow, saveLayouts]);

    const updateWindowPosition = useCallback((key: string, x: number, y: number) => {
        setOpenWindows(prev => {
            const updated = prev.map(w => {
                if (w.key === key) {
                    return { ...w, x, y };
                }
                return w;
            });
            saveLayouts(updated);
            return updated;
        });
    }, [saveLayouts]);

    const updateWindowSize = useCallback((key: string, width: number, height: number) => {
        setOpenWindows(prev => {
            const updated = prev.map(w => {
                if (w.key === key) {
                    return { ...w, width, height };
                }
                return w;
            });
            saveLayouts(updated);
            return updated;
        });
    }, [saveLayouts]);

    return (
        <WindowManagerContext.Provider
            value={{
                openWindows,
                activeWindowKey,
                openWindow,
                closeWindow,
                minimizeWindow,
                maximizeWindow,
                focusWindow,
                updateWindowPosition,
                updateWindowSize
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    );
}
