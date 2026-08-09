"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { SafeRichText } from "@/shared/ui/safe-rich-text";
import type { Locale } from "@/features/templates/types";
import { localizeHref } from "@/shared/lib/i18n/routing";

gsap.registerPlugin(ScrollTrigger);

type HorizonHeroSectionProps = {
    locale: Locale;
    eyebrow: string[];
    titleLines: [string, string];
    subtitle: string;
    primaryCta: {
        label: string;
        href: string;
    };
    secondaryCta: {
        label: string;
        href: string;
    };
    trustBadges: string[];
    tone?: "dark" | "light";
};

type CameraTarget = {
    x: number;
    y: number;
    z: number;
};

export function HorizonHeroSection({
    locale,
    eyebrow,
    titleLines,
    subtitle,
    primaryCta,
    secondaryCta,
    trustBadges,
    tone = "dark",
}: HorizonHeroSectionProps) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const heroRef = useRef<HTMLElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const eyebrowRef = useRef<HTMLDivElement | null>(null);
    const titleRef = useRef<HTMLHeadingElement | null>(null);
    const subtitleRef = useRef<HTMLDivElement | null>(null);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const trustRef = useRef<HTMLDivElement | null>(null);
    const progressRef = useRef<HTMLDivElement | null>(null);

    const [scrollProgress, setScrollProgress] = useState(0);
    const [currentSection, setCurrentSection] = useState(1);

    const smoothCameraPos = useRef<CameraTarget>({ x: 0, y: 30, z: 300 });
    const targetCameraPos = useRef<CameraTarget>({ x: 0, y: 30, z: 300 });

    const threeRefs = useRef<{
        scene: THREE.Scene | null;
        camera: THREE.PerspectiveCamera | null;
        renderer: THREE.WebGLRenderer | null;
        composer: InstanceType<typeof EffectComposer> | null;
        stars: THREE.Points[];
        nebula: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
        mountains: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>[];
        atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null;
        animationId: number | null;
    }>({
        scene: null,
        camera: null,
        renderer: null,
        composer: null,
        stars: [],
        nebula: null,
        mountains: [],
        atmosphere: null,
        animationId: null,
    });

    const subtitleLines = useMemo(() => {
        // Strip a single outer <p>…</p> wrapper if the rich-text value is one
        // paragraph. Splitting HTML at sentence boundaries would otherwise cut
        // tags in half and produce <p><p>…</p></p> nesting, which the browser
        // auto-corrects and causes a hydration mismatch.
        const unwrapped = subtitle
            .trim()
            .replace(/^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>\s*$/i, "$1");

        const segments = unwrapped
            .split(/(?<=[.!?])\s+/)
            .map((line) => line.trim())
            .filter(Boolean);

        return segments.length > 0 ? segments : [unwrapped];
    }, [subtitle]);
    const localizedPrimaryHref = localizeHref(locale, primaryCta.href);
    const localizedSecondaryHref = localizeHref(locale, secondaryCta.href);
    const isArabicLocale = locale === "ar";
    const isLightTone = tone === "light";

    useEffect(() => {
        if (!canvasRef.current || !heroRef.current) return;

        // Performance gating — on low-power devices and when the user prefers
        // reduced motion we skip the heavy WebGL scene entirely and let the
        // CSS gradient backdrop carry the section. This is the single biggest
        // lever against the "browser crash on landing" reports.
        const prefersReducedMotion =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const isSmallViewport =
            typeof window !== "undefined" && window.innerWidth < 768;
        const deviceMemoryRaw =
            typeof navigator !== "undefined"
                ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
                : undefined;
        const isLowMemory = typeof deviceMemoryRaw === "number" && deviceMemoryRaw < 4;
        const isLowCore =
            typeof navigator !== "undefined" &&
            typeof navigator.hardwareConcurrency === "number" &&
            navigator.hardwareConcurrency < 4;

        if (prefersReducedMotion || isSmallViewport || isLowMemory || isLowCore) {
            return;
        }

        const refs = threeRefs.current;

        refs.scene = new THREE.Scene();
        refs.scene.fog = new THREE.FogExp2(0x001f3f, 0.00025);

        refs.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        refs.camera.position.set(0, 30, 300);

        // Wrap WebGL renderer construction — Chrome can block context creation
        // ("Web page caused context loss and was blocked"), and an uncaught
        // throw here used to surface as Next's Application Error page. On
        // failure we leave `refs.renderer` undefined and bail; the CSS
        // gradient fallback under the canvas keeps the section presentable.
        try {
            refs.renderer = new THREE.WebGLRenderer({
                canvas: canvasRef.current,
                antialias: false,
                alpha: true,
                powerPreference: "default",
                failIfMajorPerformanceCaveat: false,
            });
        } catch (rendererError) {
            console.warn("[horizon-hero] WebGL renderer could not be created; skipping 3D hero.", rendererError);
            return;
        }
        refs.renderer.setSize(window.innerWidth, window.innerHeight);
        refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        refs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        refs.renderer.toneMappingExposure = 0.55;
        refs.renderer.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            console.warn("[horizon-hero] WebGL context lost.");
        });

        // Bloom is the single most expensive post-pass — gate it to large
        // viewports only. Smaller screens still get the scene but without the
        // bloom overhead.
        const enableBloom = window.innerWidth >= 1280;
        refs.composer = new EffectComposer(refs.renderer);
        refs.composer.addPass(new RenderPass(refs.scene, refs.camera));
        if (enableBloom) {
            refs.composer.addPass(
                new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.92)
            );
        }

        const createStarField = () => {
            // Reduced from 2600 × 3 = 7800 down to 800 × 3 = 2400. Visually
            // still reads as a dense starfield but ~3x cheaper per frame.
            const starCount = 800;

            for (let layer = 0; layer < 3; layer += 1) {
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(starCount * 3);
                const colors = new Float32Array(starCount * 3);
                const sizes = new Float32Array(starCount);

                for (let i = 0; i < starCount; i += 1) {
                    const radius = 260 + Math.random() * 900;
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(Math.random() * 2 - 1);

                    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
                    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                    positions[i * 3 + 2] = radius * Math.cos(phi);

                    const color = new THREE.Color();
                    const random = Math.random();

                    if (random < 0.7) {
                        color.setHSL(0.58, 0.25, 0.86 + Math.random() * 0.08);
                    } else if (random < 0.9) {
                        color.setHSL(0.56, 0.6, 0.78);
                    } else {
                        color.setHSL(0.1, 0.7, 0.8);
                    }

                    colors[i * 3] = color.r;
                    colors[i * 3 + 1] = color.g;
                    colors[i * 3 + 2] = color.b;
                    sizes[i] = Math.random() * 1.8 + 0.4;
                }

                geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
                geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

                const material = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        depth: { value: layer },
                    },
                    vertexShader: `
                        attribute float size;
                        attribute vec3 color;
                        varying vec3 vColor;
                        uniform float time;
                        uniform float depth;

                        void main() {
                            vColor = color;
                            vec3 pos = position;
                            float angle = time * 0.04 * (1.0 - depth * 0.25);
                            mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                            pos.xy = rot * pos.xy;
                            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                            gl_PointSize = size * (300.0 / -mvPosition.z);
                            gl_Position = projectionMatrix * mvPosition;
                        }
                    `,
                    fragmentShader: `
                        varying vec3 vColor;

                        void main() {
                            float dist = length(gl_PointCoord - vec2(0.5));
                            if (dist > 0.5) discard;
                            float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
                            gl_FragColor = vec4(vColor, opacity);
                        }
                    `,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });

                const stars = new THREE.Points(geometry, material);
                refs.scene?.add(stars);
                refs.stars.push(stars);
            }
        };

        const createNebula = () => {
            // Reduced from 100x100 (20k vertices) to 32x32 (~2k) — wave
            // animation is still smooth at this segment density.
            const geometry = new THREE.PlaneGeometry(8000, 4000, 32, 32);
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color1: { value: new THREE.Color(0x0b3b6a) },
                    color2: { value: new THREE.Color(0x1c73b8) },
                    opacity: { value: 0.22 },
                },
                vertexShader: `
                    varying vec2 vUv;
                    varying float vElevation;
                    uniform float time;

                    void main() {
                        vUv = uv;
                        vec3 pos = position;
                        float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 18.0;
                        pos.z += elevation;
                        vElevation = elevation;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 color1;
                    uniform vec3 color2;
                    uniform float opacity;
                    uniform float time;
                    varying vec2 vUv;
                    varying float vElevation;

                    void main() {
                        float mixFactor = sin(vUv.x * 8.0 + time) * cos(vUv.y * 8.0 + time * 0.8);
                        vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);
                        float alpha = opacity * (1.0 - length(vUv - 0.5) * 1.9);
                        alpha *= 1.0 + vElevation * 0.008;
                        gl_FragColor = vec4(color, alpha);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false,
            });

            const nebula = new THREE.Mesh(geometry, material);
            nebula.position.z = -950;
            refs.scene?.add(nebula);
            refs.nebula = nebula;
        };

        const createMountains = () => {
            const layers = [
                { distance: -70, height: 60, color: 0x001f3f, opacity: 1 },
                { distance: -130, height: 88, color: 0x002f58, opacity: 0.82 },
                { distance: -190, height: 118, color: 0x0b3b6a, opacity: 0.65 },
                { distance: -250, height: 140, color: 0x15538d, opacity: 0.36 },
            ];

            layers.forEach((layer, index) => {
                const points: THREE.Vector2[] = [];
                const segments = 50;

                for (let i = 0; i <= segments; i += 1) {
                    const x = (i / segments - 0.5) * 1000;
                    const y =
                        Math.sin(i * 0.1) * layer.height +
                        Math.sin(i * 0.05) * layer.height * 0.5 +
                        Math.random() * layer.height * 0.18 -
                        105;
                    points.push(new THREE.Vector2(x, y));
                }

                points.push(new THREE.Vector2(5000, -320));
                points.push(new THREE.Vector2(-5000, -320));

                const shape = new THREE.Shape(points);
                const geometry = new THREE.ShapeGeometry(shape);
                const material = new THREE.MeshBasicMaterial({
                    color: layer.color,
                    transparent: true,
                    opacity: layer.opacity,
                    side: THREE.DoubleSide,
                });

                const mountain = new THREE.Mesh(geometry, material);
                mountain.position.z = layer.distance;
                mountain.position.y = 50;
                mountain.userData = { baseZ: layer.distance, index };
                refs.scene?.add(mountain);
                refs.mountains.push(mountain);
            });
        };

        const createAtmosphere = () => {
            const geometry = new THREE.SphereGeometry(600, 24, 24);
            const material = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 } },
                vertexShader: `
                    varying vec3 vNormal;
                    void main() {
                        vNormal = normalize(normalMatrix * normal);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    varying vec3 vNormal;
                    uniform float time;

                    void main() {
                        float intensity = pow(0.75 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                        vec3 atmosphere = vec3(0.15, 0.48, 0.88) * intensity;
                        float pulse = sin(time * 2.0) * 0.08 + 0.92;
                        atmosphere *= pulse;
                        gl_FragColor = vec4(atmosphere, intensity * 0.26);
                    }
                `,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                transparent: true,
            });

            const atmosphere = new THREE.Mesh(geometry, material);
            refs.scene?.add(atmosphere);
            refs.atmosphere = atmosphere;
        };

        const animate = () => {
            refs.animationId = requestAnimationFrame(animate);

            // Skip frames when the tab is hidden — prevents WebGL work from
            // piling up in the background and leaking across long sessions.
            if (typeof document !== "undefined" && document.hidden) return;

            const time = Date.now() * 0.001;

            refs.stars.forEach((starField) => {
                const material = starField.material;
                if (material instanceof THREE.ShaderMaterial) {
                    material.uniforms.time.value = time;
                }
            });

            if (refs.nebula?.material.uniforms) {
                refs.nebula.material.uniforms.time.value = time * 0.45;
            }

            if (refs.atmosphere?.material.uniforms) {
                refs.atmosphere.material.uniforms.time.value = time;
            }

            if (refs.camera) {
                const smoothing = 0.11;
                smoothCameraPos.current.x += (targetCameraPos.current.x - smoothCameraPos.current.x) * smoothing;
                smoothCameraPos.current.y += (targetCameraPos.current.y - smoothCameraPos.current.y) * smoothing;
                smoothCameraPos.current.z += (targetCameraPos.current.z - smoothCameraPos.current.z) * smoothing;

                refs.camera.position.x = smoothCameraPos.current.x + Math.sin(time * 0.08) * 1.8;
                refs.camera.position.y = smoothCameraPos.current.y + Math.cos(time * 0.13) * 1.2;
                refs.camera.position.z = smoothCameraPos.current.z;
                refs.camera.lookAt(0, 10, -550);
            }

            refs.mountains.forEach((mountain, index) => {
                const parallaxFactor = 1 + index * 0.45;
                mountain.position.x = Math.sin(time * 0.08) * 2.4 * parallaxFactor;
                mountain.position.y = 48 + Math.cos(time * 0.12) * 1.2 * parallaxFactor;
            });

            refs.composer?.render();
        };

        createStarField();
        createNebula();
        createMountains();
        createAtmosphere();
        animate();

        const handleResize = () => {
            if (!refs.camera || !refs.renderer || !refs.composer) return;

            refs.camera.aspect = window.innerWidth / window.innerHeight;
            refs.camera.updateProjectionMatrix();
            refs.renderer.setSize(window.innerWidth, window.innerHeight);
            refs.composer.setSize(window.innerWidth, window.innerHeight);
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);

            if (refs.animationId) cancelAnimationFrame(refs.animationId);

            refs.stars.forEach((starField) => {
                starField.geometry.dispose();
                if (starField.material instanceof THREE.Material) {
                    starField.material.dispose();
                }
            });

            refs.mountains.forEach((mountain) => {
                mountain.geometry.dispose();
                mountain.material.dispose();
            });

            refs.nebula?.geometry.dispose();
            refs.nebula?.material.dispose();
            refs.atmosphere?.geometry.dispose();
            refs.atmosphere?.material.dispose();
            refs.composer?.dispose();
            refs.renderer?.dispose();
        };
    }, []);

    useEffect(() => {
        const host = rootRef.current;
        const hero = heroRef.current;
        if (!host || !hero) return;

        const animatedNodes = [
            eyebrowRef.current,
            subtitleRef.current,
            actionsRef.current,
            trustRef.current,
            progressRef.current,
        ].filter(Boolean);

        gsap.set(animatedNodes, { visibility: "visible" });
        gsap.set(eyebrowRef.current, { y: 18, opacity: 0 });
        gsap.set(actionsRef.current, { y: 22, opacity: 0 });
        gsap.set(trustRef.current?.children ?? [], { y: 22, opacity: 0 });
        gsap.set(progressRef.current, { y: 20, opacity: 0.25 });

        if (subtitleRef.current) {
            gsap.set(subtitleRef.current.querySelectorAll(".subtitle-line"), { y: 18, opacity: 0 });
        }

        const timeline = gsap.timeline({
            scrollTrigger: {
                trigger: host,
                start: "top top",
                end: "+=140%",
                scrub: 1.1,
            },
        });

        if (eyebrowRef.current) {
            timeline.to(eyebrowRef.current, { y: 0, opacity: 1, duration: 0.18 }, 0.06);
        }

        if (subtitleRef.current) {
            timeline.to(
                subtitleRef.current.querySelectorAll(".subtitle-line"),
                { y: 0, opacity: 1, duration: 0.2, stagger: 0.05 },
                0.28
            );
        }

        if (actionsRef.current) {
            timeline.to(actionsRef.current, { y: 0, opacity: 1, duration: 0.18 }, 0.34);
        }

        if (trustRef.current) {
            timeline.to(trustRef.current.children, { y: 0, opacity: 1, duration: 0.18, stagger: 0.03 }, 0.38);
        }

        if (progressRef.current) {
            timeline.to(progressRef.current, { y: 0, opacity: 1, duration: 0.18 }, 0.14);
        }

        return () => {
            timeline.scrollTrigger?.kill();
            timeline.kill();
        };
    }, []);

    useEffect(() => {
        const host = rootRef.current;
        if (!host) return;

        const totalSections = 2;
        const cameraPositions: CameraTarget[] = [
            { x: 0, y: 30, z: 300 },
            { x: 0, y: 35, z: 160 },
            { x: 0, y: 40, z: 40 },
        ];

        const updateScene = (progress: number) => {
            const clampedProgress = Math.min(Math.max(progress, 0), 1);

            setScrollProgress(clampedProgress);

            const steppedSection = Math.min(Math.floor(clampedProgress * totalSections) + 1, totalSections);
            setCurrentSection(steppedSection);

            const totalProgress = clampedProgress * totalSections;
            const sectionIndex = Math.min(Math.floor(totalProgress), totalSections - 1);
            const sectionProgress = totalProgress - sectionIndex;
            const currentPos = cameraPositions[sectionIndex] ?? cameraPositions[0];
            const nextPos = cameraPositions[sectionIndex + 1] ?? currentPos;

            targetCameraPos.current = {
                x: currentPos.x + (nextPos.x - currentPos.x) * sectionProgress,
                y: currentPos.y + (nextPos.y - currentPos.y) * sectionProgress,
                z: currentPos.z + (nextPos.z - currentPos.z) * sectionProgress,
            };

            const refs = threeRefs.current;
            refs.mountains.forEach((mountain, index) => {
                const baseZ = mountain.userData.baseZ as number;
                const targetZ = baseZ + clampedProgress * (110 + index * 60);
                mountain.position.z = targetZ;
            });

            if (refs.nebula) {
                refs.nebula.position.z = -950 + clampedProgress * 120;
            }
        };

        updateScene(0);

        const scrollTrigger = ScrollTrigger.create({
            trigger: host,
            start: "top top",
            end: "+=140%",
            pin: heroRef.current,
            pinSpacing: true,
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
                updateScene(self.progress);
            },
        });

        return () => {
            scrollTrigger.kill();
        };
    }, []);

    const renderTitleLine = (text: string) => {
        if (isArabicLocale) {
            // Arabic glyph shaping breaks when every character is wrapped in an
            // inline-block span. Keep the full phrase as one text run so the
            // browser can join letters correctly.
            return <span className="title-run">{text}</span>;
        }

        return text.split("").map((char, index) => (
            <span key={`${char}-${index}`} className="title-char inline-block">
                {char === " " ? "\u00A0" : char}
            </span>
        ));
    };

    return (
        <div ref={rootRef} className={`relative ${isLightTone ? "[background:var(--template-surface-canvas)] text-[var(--template-text-primary)]" : "bg-[#001f3f] text-white"}`}>
            <section ref={heroRef} className={`relative flex h-screen items-center overflow-hidden ${isLightTone ? "[background:var(--template-surface-canvas)]" : "bg-[#002f58]"}`}>
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

                <div className={isLightTone ? "absolute inset-0 bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,var(--template-primary)_16%,transparent),_transparent_32%),radial-gradient(circle_at_75%_20%,color-mix(in_oklch,var(--template-accent)_18%,transparent),transparent_30%),linear-gradient(90deg,color-mix(in_oklch,oklch(0.982_0.012_248)_96%,transparent)_0%,color-mix(in_oklch,oklch(0.982_0.012_248)_90%,transparent)_42%,color-mix(in_oklch,oklch(0.94_0.026_246)_84%,transparent)_100%)]" : "absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.10),_transparent_30%),linear-gradient(90deg,rgba(0,47,88,0.98)_0%,rgba(0,47,88,0.92)_36%,rgba(0,47,88,0.62)_72%,rgba(0,47,88,0.3)_100%)]"} />
                <div className={isLightTone ? "absolute inset-y-0 left-0 w-full bg-[linear-gradient(180deg,color-mix(in_oklch,oklch(0.988_0.01_248)_55%,transparent)_0%,color-mix(in_oklch,oklch(0.988_0.01_248)_24%,transparent)_58%,color-mix(in_oklch,oklch(0.945_0.024_246)_94%,transparent)_100%)]" : "absolute inset-y-0 left-0 w-full bg-[linear-gradient(180deg,rgba(0,31,63,0.16)_0%,rgba(0,31,63,0.36)_62%,rgba(0,31,63,0.84)_100%)]"} />

                <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-32 lg:py-40">
                    <div className="max-w-5xl">
                        <div
                            ref={eyebrowRef}
                            style={{ visibility: "hidden" }}
                            className={`mb-4 uppercase tracking-[0.28em] ${isLightTone ? "text-[var(--template-text-accent-strong)]" : "text-white/55"}`}
                        >
                            {eyebrow.map((line, index) => (
                                <p
                                    key={`${line}-${index}`}
                                    className={index === 0 ? "text-[0.9rem] font-semibold sm:text-[1.08rem]" : "mt-1 text-xs font-semibold sm:text-sm"}
                                >
                                    {line}
                                </p>
                            ))}
                        </div>

                        <h1
                            ref={titleRef}
                            dir={isArabicLocale ? "rtl" : "ltr"}
                            lang={locale}
                            className={`mb-6 max-w-full [font-family:var(--public-font-display,var(--font-inter))] text-[1.55rem] font-extrabold leading-[1.08] sm:text-[1.9rem] md:text-[2.25rem] lg:text-[2.7rem] xl:text-[3.1rem] ${isLightTone ? "text-[var(--template-text-primary)]" : "text-white"} ${isArabicLocale ? "text-right tracking-normal" : "tracking-[-0.02em]"}`}
                        >
                            <span className={`block pe-[0.08em] ${isArabicLocale ? "whitespace-normal [text-wrap:balance]" : "whitespace-nowrap"}`}>{renderTitleLine(titleLines[0])}</span>
                            <span className={`block pe-[0.08em] ${isArabicLocale ? "whitespace-normal [text-wrap:balance]" : "whitespace-nowrap"}`}>{renderTitleLine(titleLines[1])}</span>
                        </h1>

                        <div
                            ref={subtitleRef}
                            style={{ visibility: "hidden" }}
                            className={`mb-10 max-w-xl text-lg leading-relaxed ${isLightTone ? "text-[var(--template-text-secondary)]" : "text-white/75"}`}
                        >
                            {subtitleLines.map((line, index) => (
                                <SafeRichText
                                    key={`${line}-${index}`}
                                    as="p"
                                    value={line}
                                    className="subtitle-line"
                                />
                            ))}
                        </div>

                        <div ref={actionsRef} style={{ visibility: "hidden" }} className="flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className={isLightTone ? "rounded-none px-8 py-6 font-semibold text-white shadow-[var(--template-depth-md)] transition-colors hover:opacity-95 [background:linear-gradient(135deg,var(--template-primary),var(--template-gradient-to))]" : "rounded-none bg-white px-8 py-6 font-semibold text-[#002f58] transition-colors hover:bg-slate-100"}>
                                <Link href={localizedPrimaryHref}>{primaryCta.label}</Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className={isLightTone ? "rounded-none border-[var(--template-border-strong)] bg-[var(--template-surface-glass)] px-8 py-6 font-semibold text-[var(--template-text-primary)] transition-colors hover:[background:var(--template-surface-light)]" : "rounded-none border-white/30 bg-transparent px-8 py-6 font-semibold text-white transition-colors hover:bg-white/10"}>
                                <Link href={localizedSecondaryHref}>{secondaryCta.label}</Link>
                            </Button>
                        </div>

                        <div ref={trustRef} style={{ visibility: "hidden" }} className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {trustBadges.map((badge) => (
                                <span
                                    key={badge}
                                    className={`inline-flex min-h-12 items-center justify-center gap-2 border px-4 py-3 text-center text-xs font-medium tracking-[0.12em] backdrop-blur-sm sm:justify-start sm:text-left ${isLightTone ? "border-[var(--template-border-soft)] bg-[var(--template-surface-glass)] text-[var(--template-text-secondary)]" : "border-white/15 bg-white/5 text-white/85"}`}
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{badge}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div
                    ref={progressRef}
                    style={{ visibility: "hidden" }}
                    className={`absolute bottom-8 left-6 right-6 z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 text-[0.65rem] font-semibold tracking-[0.34em] sm:bottom-10 ${isLightTone ? "text-[var(--template-text-subtle)]" : "text-white/60"}`}
                >
                    <span>SCROLL</span>
                    <div className="flex w-full max-w-xs items-center gap-3">
                        <div className={`h-px flex-1 overflow-hidden ${isLightTone ? "bg-slate-300/70" : "bg-white/20"}`}>
                            <div className={`h-full transition-[width] duration-200 ${isLightTone ? "bg-[var(--template-primary)]" : "bg-white/75"}`} style={{ width: `${scrollProgress * 100}%` }} />
                        </div>
                        <span className={`min-w-fit tracking-[0.24em] ${isLightTone ? "text-[var(--template-text-secondary)]" : "text-white/75"}`}>{String(currentSection).padStart(2, "0")} / 02</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
