import Image from "next/image";

interface WorkspaceWallpaperProps {
    url: string | null;
    alt?: string;
}

// Fallback used when a workspace has no wallpaper set. Dark gradient matches
// the overall dashboard aesthetic rather than flashing white while an image
// downloads.
const DEFAULT_BACKGROUND = "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)";

export function WorkspaceWallpaper({ url, alt = "Workspace desktop background" }: WorkspaceWallpaperProps) {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            style={url ? undefined : { background: DEFAULT_BACKGROUND }}
        >
            {url ? (
                <Image
                    src={url}
                    alt={alt}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                />
            ) : null}
            {/* Scrim above the wallpaper to keep taskbar and window chrome readable
                regardless of how bright the wallpaper image is. */}
            <div className="absolute inset-0 bg-slate-950/55 lg:bg-slate-950/35 backdrop-blur-[0.5px] lg:backdrop-blur-none" />
        </div>
    );
}
