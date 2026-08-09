"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

// ─── Geometry helpers ────────────────────────────────────────────────────────

function star(cx: number, cy: number, R: number, r: number, n: number, offsetDeg = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < 2 * n; i++) {
        const angle = (Math.PI * i) / n - Math.PI / 2 + (offsetDeg * Math.PI) / 180;
        const radius = i % 2 === 0 ? R : r;
        pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return `M${pts.join(" L")} Z`;
}

function polygon(cx: number, cy: number, R: number, n: number, offsetDeg = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2 + (offsetDeg * Math.PI) / 180;
        pts.push(`${(cx + R * Math.cos(angle)).toFixed(2)},${(cy + R * Math.sin(angle)).toFixed(2)}`);
    }
    return `M${pts.join(" L")} Z`;
}

function circle(cx: number, cy: number, r: number): string {
    return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`;
}

// ─── SVG accent color ─────────────────────────────────────────────────────────

const A = "var(--template-accent)";
const S = "var(--template-text-accent-strong)";

// ─── Shared SVG props ─────────────────────────────────────────────────────────

const gProps = { fill: "none", stroke: A, strokeWidth: "1.1" } as const;
const gThin = { fill: "none", stroke: A, strokeWidth: "0.7" } as const;
const gMedium = { fill: "none", stroke: S, strokeWidth: "1.5" } as const;

// ─── Tiling background patterns ───────────────────────────────────────────────

function TileGrid({ patternId, tileSize, opacity }: { patternId: string; tileSize: number; opacity: number }) {
    const h = tileSize;
    const h2 = h / 2;
    const octaStar = star(h2, h2, h2 * 0.46, h2 * 0.19, 8);
    const octaOuter = polygon(h2, h2, h2 * 0.46, 8);
    return (
        <svg className="absolute inset-0 w-full h-full" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id={patternId} x="0" y="0" width={h} height={h} patternUnits="userSpaceOnUse">
                    <path d={octaStar} {...gThin} />
                    <path d={octaOuter} {...gThin} />
                    <line x1="0" y1={h2} x2={h} y2={h2} {...gThin} />
                    <line x1={h2} y1="0" x2={h2} y2={h} {...gThin} />
                    <line x1="0" y1="0" x2={h} y2={h} {...gThin} />
                    <line x1={h} y1="0" x2="0" y2={h} {...gThin} />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    );
}

function HexTileGrid({ patternId, opacity }: { patternId: string; opacity: number }) {
    const s = 60;
    const h = s * Math.sqrt(3);
    const hexPath = polygon(s, h / 2, s * 0.94, 6, 30);
    const innerStar = star(s, h / 2, s * 0.42, s * 0.16, 6, 30);
    return (
        <svg className="absolute inset-0 w-full h-full" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id={patternId} x="0" y="0" width={s * 2} height={h} patternUnits="userSpaceOnUse">
                    <path d={hexPath} {...gThin} />
                    <path d={innerStar} {...gThin} />
                    <path d={polygon(s * 2, h * 1.5, s * 0.94, 6, 30)} {...gThin} />
                    <path d={star(s * 2, h * 1.5, s * 0.42, s * 0.16, 6, 30)} {...gThin} />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    );
}

function DiamondTileGrid({ patternId, opacity }: { patternId: string; opacity: number }) {
    const t = 48;
    return (
        <svg className="absolute inset-0 w-full h-full" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id={patternId} x="0" y="0" width={t} height={t} patternUnits="userSpaceOnUse">
                    <path d={`M${t / 2},0 L${t},${t / 2} L${t / 2},${t} L0,${t / 2} Z`} {...gThin} />
                    <circle cx={t / 2} cy={t / 2} r="2.5" {...gThin} />
                    <circle cx="0" cy="0" r="2.5" {...gThin} />
                    <circle cx={t} cy="0" r="2.5" {...gThin} />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
    );
}

// ─── Ornament pieces ──────────────────────────────────────────────────────────

function RosetteOrnament({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const R = c * 0.88;
    const rings = [R * 0.32, R * 0.56, R * 0.74, R * 0.90];
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer 12-pointed star */}
            <path d={star(c, c, R, R * 0.42, 12)} {...gMedium} />
            {/* Inner 8-pointed star */}
            <path d={star(c, c, R * 0.62, R * 0.26, 8)} {...gProps} />
            {/* Central 6-star */}
            <path d={star(c, c, R * 0.30, R * 0.14, 6)} {...gProps} />
            {/* Concentric rings */}
            {rings.map((r, i) => (
                <path key={i} d={circle(c, c, r)} stroke={A} strokeWidth="0.5" fill="none" />
            ))}
            {/* Radial spokes at 12 positions */}
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / 12 - Math.PI / 2;
                return (
                    <line
                        key={i}
                        x1={(c + rings[0] * Math.cos(angle)).toFixed(2)}
                        y1={(c + rings[0] * Math.sin(angle)).toFixed(2)}
                        x2={(c + R * Math.cos(angle)).toFixed(2)}
                        y2={(c + R * Math.sin(angle)).toFixed(2)}
                        stroke={A} strokeWidth="0.4" />
                );
            })}
            {/* Outer 8-polygon border */}
            <path d={polygon(c, c, R * 0.96, 8, 22.5)} stroke={A} strokeWidth="0.6" fill="none" />
            {/* Corner bracket dots */}
            {Array.from({ length: 24 }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / 24 - Math.PI / 2;
                const r2 = R * 0.955;
                return <circle key={i} cx={(c + r2 * Math.cos(angle)).toFixed(2)} cy={(c + r2 * Math.sin(angle)).toFixed(2)} r="1.5" fill={A} fillOpacity="0.6" />;
            })}
        </svg>
    );
}

function HexLatticeOrnament({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const s = c * 0.35;
    const positions = [
        [c, c],
        [c + s * 2, c],
        [c - s * 2, c],
        [c + s, c - s * Math.sqrt(3)],
        [c - s, c - s * Math.sqrt(3)],
        [c + s, c + s * Math.sqrt(3)],
        [c - s, c + s * Math.sqrt(3)],
    ];
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {positions.map(([cx, cy], i) => (
                <g key={i}>
                    <path d={polygon(cx, cy, s * 0.92, 6, 30)} {...gProps} />
                    <path d={star(cx, cy, s * 0.5, s * 0.22, 6, 30)} {...gProps} />
                    <path d={circle(cx, cy, s * 0.18)} stroke={A} strokeWidth="0.4" fill="none" />
                </g>
            ))}
            {/* Connecting lines between centers */}
            {[[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 3], [2, 4], [1, 5], [2, 6]].map(([a, b], i) => (
                <line key={i}
                    x1={positions[a][0].toFixed(2)} y1={positions[a][1].toFixed(2)}
                    x2={positions[b][0].toFixed(2)} y2={positions[b][1].toFixed(2)}
                    stroke={A} strokeWidth="0.35" />
            ))}
            {/* Outer ring */}
            <path d={circle(c, c, c * 0.90)} stroke={A} strokeWidth="0.5" fill="none" />
        </svg>
    );
}

function MandalaOrnament({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const R = c * 0.90;
    const petalRings = [4, 8, 12, 16];
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Multiple star layers for mandala effect */}
            <path d={star(c, c, R, R * 0.6, 4, 45)} {...gMedium} />
            <path d={star(c, c, R * 0.82, R * 0.5, 8)} {...gProps} />
            <path d={star(c, c, R * 0.72, R * 0.44, 12)} {...gProps} />
            <path d={star(c, c, R * 0.54, R * 0.34, 8, 22.5)} {...gProps} />
            <path d={star(c, c, R * 0.40, R * 0.24, 6)} {...gProps} />
            <path d={star(c, c, R * 0.26, R * 0.13, 4, 45)} {...gProps} />
            {/* Concentric circles */}
            {petalRings.map((_, i) => (
                <path key={i} d={circle(c, c, R * (0.20 + i * 0.20))} stroke={A} strokeWidth="0.5" fill="none" />
            ))}
            <path d={circle(c, c, R)} stroke={A} strokeWidth="0.7" fill="none" />
            {/* 12 radial marks */}
            {Array.from({ length: 12 }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / 12 - Math.PI / 2;
                const r1 = R * 0.92;
                const r2 = R * 1.02;
                return <line key={i}
                    x1={(c + r1 * Math.cos(ang)).toFixed(2)} y1={(c + r1 * Math.sin(ang)).toFixed(2)}
                    x2={(c + r2 * Math.cos(ang)).toFixed(2)} y2={(c + r2 * Math.sin(ang)).toFixed(2)}
                    stroke={A} strokeWidth="1.2" />;
            })}
        </svg>
    );
}

function CornerBracket({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d={star(c, c, c * 0.82, c * 0.36, 8)} {...gProps} />
            <path d={polygon(c, c, c * 0.82, 8, 22.5)} stroke={A} strokeWidth="0.5" fill="none" />
            <path d={polygon(c, c, c * 0.55, 4)} stroke={A} strokeWidth="0.5" fill="none" />
            <path d={circle(c, c, c * 0.36)} stroke={A} strokeWidth="0.5" fill="none" />
            <path d={circle(c, c, c * 0.18)} stroke={A} strokeWidth="0.5" fill="none" />
            {/* 8 petal-like arcs approximated with lines */}
            {Array.from({ length: 8 }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / 8 - Math.PI / 2;
                return <line key={i}
                    x1={(c + c * 0.18 * Math.cos(ang)).toFixed(2)} y1={(c + c * 0.18 * Math.sin(ang)).toFixed(2)}
                    x2={(c + c * 0.55 * Math.cos(ang)).toFixed(2)} y2={(c + c * 0.55 * Math.sin(ang)).toFixed(2)}
                    stroke={A} strokeWidth="0.5" />;
            })}
        </svg>
    );
}

function ScrollMedallion({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const R = c * 0.88;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer wreath of 16 petals */}
            {Array.from({ length: 16 }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / 16 - Math.PI / 2;
                const cx2 = (c + R * 0.70 * Math.cos(ang)).toFixed(2);
                const cy2 = (c + R * 0.70 * Math.sin(ang)).toFixed(2);
                return (
                    <g key={i}>
                        <ellipse cx={cx2} cy={cy2} rx={(R * 0.19).toFixed(2)} ry={(R * 0.09).toFixed(2)}
                            transform={`rotate(${(i * 360) / 16 + 90} ${cx2} ${cy2})`}
                            stroke={A} strokeWidth="0.5" fill="none" />
                    </g>
                );
            })}
            {/* Central medallion */}
            <path d={star(c, c, R * 0.48, R * 0.22, 8)} {...gMedium} />
            <path d={star(c, c, R * 0.32, R * 0.15, 6)} {...gProps} />
            <path d={circle(c, c, R * 0.14)} stroke={A} strokeWidth="0.6" fill="none" />
            {/* Three concentric rings */}
            <path d={circle(c, c, R * 0.52)} stroke={A} strokeWidth="0.5" fill="none" />
            <path d={circle(c, c, R * 0.62)} stroke={A} strokeWidth="0.35" fill="none" />
            <path d={circle(c, c, R * 0.86)} stroke={A} strokeWidth="0.5" fill="none" />
            {/* 8 radial connectors from wreath to center ring */}
            {Array.from({ length: 8 }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / 8 - Math.PI / 2;
                return <line key={i}
                    x1={(c + R * 0.52 * Math.cos(ang)).toFixed(2)} y1={(c + R * 0.52 * Math.sin(ang)).toFixed(2)}
                    x2={(c + R * 0.62 * Math.cos(ang)).toFixed(2)} y2={(c + R * 0.62 * Math.sin(ang)).toFixed(2)}
                    stroke={A} strokeWidth="0.5" />;
            })}
        </svg>
    );
}

function OpenLatticeOrnament({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const steps = 5;
    const spacing = c * 0.86 / steps;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Diamond grid */}
            {Array.from({ length: steps + 1 }).map((_, row) =>
                Array.from({ length: steps + 1 }).map((_, col) => {
                    const x = (c - steps * spacing / 2) + col * spacing;
                    const y = (c - steps * spacing / 2) + row * spacing;
                    return (
                        <g key={`${row}-${col}`}>
                            <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r="3" stroke={A} strokeWidth="0.5" fill="none" />
                            {col < steps && (
                                <line x1={x.toFixed(2)} y1={y.toFixed(2)} x2={(x + spacing).toFixed(2)} y2={y.toFixed(2)} stroke={A} strokeWidth="0.35" />
                            )}
                            {row < steps && (
                                <line x1={x.toFixed(2)} y1={y.toFixed(2)} x2={x.toFixed(2)} y2={(y + spacing).toFixed(2)} stroke={A} strokeWidth="0.35" />
                            )}
                        </g>
                    );
                })
            )}
            {/* Central star at intersections */}
            {[[c, c], [c - spacing, c], [c + spacing, c], [c, c - spacing], [c, c + spacing]].map(([px, py], i) => (
                <path key={i} d={star(px, py, spacing * 0.38, spacing * 0.16, 4, 45)} stroke={A} strokeWidth="0.5" fill="none" />
            ))}
            {/* Outer frame */}
            <path d={polygon(c, c, c * 0.92, 4, 45)} stroke={A} strokeWidth="0.6" fill="none" />
        </svg>
    );
}

function KuficBorderOrnament({ size, opacity, style }: { size: number; opacity: number; style?: React.CSSProperties }) {
    const c = size / 2;
    const R = c * 0.88;
    const segs = 20;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", opacity, ...style }} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Square kufic-inspired interlocked rectangles */}
            {Array.from({ length: segs }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / segs;
                const x1 = c + R * 0.78 * Math.cos(ang);
                const y1 = c + R * 0.78 * Math.sin(ang);
                const x2 = c + R * Math.cos(ang);
                const y2 = c + R * Math.sin(ang);
                return (
                    <line key={i}
                        x1={x1.toFixed(2)} y1={y1.toFixed(2)}
                        x2={x2.toFixed(2)} y2={y2.toFixed(2)}
                        stroke={A} strokeWidth={i % 2 === 0 ? "1" : "0.4"} />
                );
            })}
            {/* Concentric square frames */}
            {[0.85, 0.65, 0.45].map((scale, i) => (
                <path key={i} d={polygon(c, c, R * scale, 4)} stroke={A} strokeWidth="0.5" fill="none" />
            ))}
            {/* 8-star at center */}
            <path d={star(c, c, R * 0.32, R * 0.14, 8)} {...gMedium} />
            {/* Inner dot ring */}
            {Array.from({ length: 12 }).map((_, i) => {
                const ang = (Math.PI * 2 * i) / 12;
                return <circle key={i}
                    cx={(c + R * 0.55 * Math.cos(ang)).toFixed(2)}
                    cy={(c + R * 0.55 * Math.sin(ang)).toFixed(2)}
                    r="2" fill={A} fillOpacity="0.7" />;
            })}
        </svg>
    );
}

// ─── Variant compositions ─────────────────────────────────────────────────────

function HomeDecor() {
    return (
        <>
            <TileGrid patternId="home-tile" tileSize={120} opacity={0.07} />
            <RosetteOrnament size={680} opacity={0.22} style={{ top: "-180px", right: "-180px" }} />
            <CornerBracket size={320} opacity={0.18} style={{ bottom: "-60px", left: "-60px" }} />
            <CornerBracket size={160} opacity={0.14} style={{ top: "40%", right: "8px" }} />
        </>
    );
}

function ServicesDecor() {
    return (
        <>
            <HexTileGrid patternId="services-tile" opacity={0.07} />
            <HexLatticeOrnament size={560} opacity={0.24} style={{ top: "-100px", right: "-120px" }} />
            <HexLatticeOrnament size={280} opacity={0.18} style={{ bottom: "-60px", left: "-80px" }} />
            <CornerBracket size={140} opacity={0.14} style={{ top: "50%", left: "20px" }} />
        </>
    );
}

function AboutDecor() {
    return (
        <>
            <DiamondTileGrid patternId="about-tile" opacity={0.065} />
            <ScrollMedallion size={580} opacity={0.24} style={{ top: "5%", right: "-140px" }} />
            <CornerBracket size={260} opacity={0.18} style={{ bottom: "-40px", left: "-40px" }} />
            <RosetteOrnament size={180} opacity={0.14} style={{ top: "-30px", left: "20%" }} />
        </>
    );
}

function ContactDecor() {
    return (
        <>
            <DiamondTileGrid patternId="contact-tile" opacity={0.060} />
            <OpenLatticeOrnament size={420} opacity={0.24} style={{ top: "-80px", right: "-80px" }} />
            <OpenLatticeOrnament size={280} opacity={0.18} style={{ bottom: "-50px", left: "-50px" }} />
            <CornerBracket size={200} opacity={0.14} style={{ top: "40%", right: "40px" }} />
        </>
    );
}

function BlogDecor() {
    return (
        <>
            <TileGrid patternId="blog-tile" tileSize={80} opacity={0.060} />
            <KuficBorderOrnament size={500} opacity={0.22} style={{ top: "-120px", right: "-120px" }} />
            <KuficBorderOrnament size={260} opacity={0.17} style={{ bottom: "-60px", left: "-60px" }} />
            <RosetteOrnament size={200} opacity={0.13} style={{ top: "50%", left: "0", transform: "translateY(-50%)" }} />
        </>
    );
}

function BookingDecor() {
    return (
        <>
            <DiamondTileGrid patternId="booking-tile" opacity={0.055} />
            <MandalaOrnament size={620} opacity={0.22} style={{ top: "50%", right: "-180px", transform: "translateY(-50%)" }} />
            <MandalaOrnament size={280} opacity={0.15} style={{ top: "10%", left: "-80px" }} />
            <CornerBracket size={180} opacity={0.13} style={{ bottom: "10%", left: "10%" }} />
        </>
    );
}

function DefaultDecor() {
    return (
        <>
            <DiamondTileGrid patternId="default-tile" opacity={0.060} />
            <CornerBracket size={380} opacity={0.18} style={{ top: "-80px", right: "-80px" }} />
            <CornerBracket size={220} opacity={0.14} style={{ bottom: "-40px", left: "-40px" }} />
        </>
    );
}

// ─── Variant resolver ─────────────────────────────────────────────────────────

function resolveVariant(pathname: string) {
    const seg = pathname === "/" ? "home" : (pathname.split("/")[1] ?? "");
    if (seg === "home" || seg === "") return "home";
    if (seg === "services") return "services";
    if (seg === "about") return "about";
    if (seg === "contact") return "contact";
    if (seg === "blog") return "blog";
    if (seg === "booking") return "booking";
    return "default";
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ArabesqueBackground() {
    const pathname = usePathname();
    const variant = useMemo(() => resolveVariant(pathname), [pathname]);

    return (
        <div
            className="pointer-events-none fixed inset-0 overflow-hidden"
            style={{
                zIndex: 0,
                opacity: 0.65,
                contain: "paint",
                willChange: "transform",
                transform: "translateZ(0)",
            }}
            aria-hidden="true"
        >
            {variant === "home" && <HomeDecor />}
            {variant === "services" && <ServicesDecor />}
            {variant === "about" && <AboutDecor />}
            {variant === "contact" && <ContactDecor />}
            {variant === "blog" && <BlogDecor />}
            {variant === "booking" && <BookingDecor />}
            {variant === "default" && <DefaultDecor />}
        </div>
    );
}
