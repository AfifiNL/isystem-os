/**
 * GSAP Scroll-Driven Animation Utilities for the Facility-Services Theme
 *
 * KEY DESIGN PRINCIPLE:
 * Animations are SCRUB-BASED — tied to scroll position, not time.
 * As the user scrolls, elements reveal proportionally.
 * This creates smooth, section-driven motion that adapts to any scroll speed.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ── Reduced-motion detection ──────────────────────────────────
export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Scrub value ───────────────────────────────────────────────
/** Scrub smoothing: higher = more lag behind scroll (smoother feel) */
export const SCRUB_SMOOTH = 2.2;

/**
 * Creates a scroll-scrubbed reveal animation for a SECTION.
 * The children animate as the section scrolls through the viewport.
 *
 * @param trigger   The section element
 * @param targets   Selector string or NodeList of elements to animate
 * @param from      GSAP fromTo "from" vars (e.g. { y: 60, opacity: 0 })
 * @param to        GSAP fromTo "to" vars (WITHOUT scrollTrigger — we add it)
 * @param opts      Optional overrides for ScrollTrigger config
 */
export function scrubReveal(
    trigger: Element | null,
    targets: string | NodeListOf<Element> | Element[],
    from: gsap.TweenVars,
    to: gsap.TweenVars,
    opts?: {
        startOffset?: string;   // default "top 85%"
        endOffset?: string;     // default "top 25%"
        stagger?: number;       // default 0.15  (in scrub context: fraction of timeline)
    }
) {
    if (!trigger) return;

    const startOffset = opts?.startOffset ?? "top 85%";
    const endOffset = opts?.endOffset ?? "top 25%";
    const stagger = opts?.stagger ?? 0.15;

    gsap.fromTo(targets, from, {
        ...to,
        stagger,
        scrollTrigger: {
            trigger,
            start: startOffset,
            end: endOffset,
            scrub: SCRUB_SMOOTH,
            // Don't toggle actions — once revealed, stay revealed
            toggleActions: "play none none none",
        },
    });
}

/**
 * Creates a scrub-driven timeline for a section.
 * Add multiple animations to reveal content progressively as user scrolls.
 *
 * @param trigger   The section element
 * @param opts      ScrollTrigger start/end overrides
 * @returns         The GSAP timeline (add .fromTo() calls to it)
 */
export function scrubTimeline(
    trigger: Element | null,
    opts?: {
        startOffset?: string;
        endOffset?: string;
    }
) {
    const startOffset = opts?.startOffset ?? "top 85%";
    const endOffset = opts?.endOffset ?? "top 20%";

    return gsap.timeline({
        scrollTrigger: {
            trigger,
            start: startOffset,
            end: endOffset,
            scrub: SCRUB_SMOOTH,
        },
    });
}

/**
 * Batch-reveal for a staggered set of cards/items within a section.
 * Each item fades in + slides up, tied to scroll progress.
 */
export function scrubCards(
    trigger: Element | null,
    selector: string,
    opts?: {
        y?: number;
        startOffset?: string;
        endOffset?: string;
        stagger?: number;
    }
) {
    if (!trigger) return;
    const y = opts?.y ?? 50;
    scrubReveal(
        trigger,
        selector,
        { y, opacity: 0 },
        { y: 0, opacity: 1, ease: "power1.out" },
        {
            startOffset: opts?.startOffset ?? "top 80%",
            endOffset: opts?.endOffset ?? "top 30%",
            stagger: opts?.stagger ?? 0.1,
        }
    );
}

/**
 * Scroll-scrubbed clip-path "wipe" reveal.
 * Animates clipPath from fully hidden to fully visible, creating a clean
 * horizontal wipe that symbolises a cleaning/clearing action.
 *
 * @param trigger   The section element
 * @param targets   Selector string or Element(s) to reveal
 * @param opts      Direction and ScrollTrigger overrides
 */
export function scrubMaskReveal(
    trigger: Element | null,
    targets: string | NodeListOf<Element> | Element[],
    opts?: {
        direction?: "left" | "right" | "top" | "bottom";
        startOffset?: string;
        endOffset?: string;
        stagger?: number;
    }
) {
    if (!trigger) return;

    const dir = opts?.direction ?? "left";
    const hidden: Record<string, string> = {
        left: "inset(0 100% 0 0)",
        right: "inset(0 0 0 100%)",
        top: "inset(100% 0 0 0)",
        bottom: "inset(0 0 100% 0)",
    };

    gsap.fromTo(
        targets,
        { clipPath: hidden[dir], willChange: "clip-path" },
        {
            clipPath: "inset(0 0% 0 0)",
            ease: "power2.inOut",
            stagger: opts?.stagger ?? 0,
            scrollTrigger: {
                trigger,
                start: opts?.startOffset ?? "top 80%",
                end: opts?.endOffset ?? "top 30%",
                scrub: SCRUB_SMOOTH,
            },
        }
    );
}

/**
 * Scroll-scrubbed parallax for an image element inside a container.
 * The image should be slightly overscaled (e.g. scale 1.15) and the
 * container must have overflow:hidden.  The yPercent shifts subtly
 * as the section scrolls through the viewport.
 *
 * @param trigger   The container element (must have overflow:hidden)
 * @param target    The image element or selector
 * @param opts      Parallax intensity and ScrollTrigger overrides
 */
export function parallaxImage(
    trigger: Element | null,
    target: string | Element,
    opts?: {
        yFrom?: number;   // default -10
        yTo?: number;     // default 10
        scale?: number;   // default 1.15
        startOffset?: string;
        endOffset?: string;
    }
) {
    if (!trigger) return;

    const yFrom = opts?.yFrom ?? -10;
    const yTo = opts?.yTo ?? 10;
    const scale = opts?.scale ?? 1.15;

    gsap.set(target, { scale, willChange: "transform" });

    gsap.fromTo(
        target,
        { yPercent: yFrom },
        {
            yPercent: yTo,
            ease: "none",
            scrollTrigger: {
                trigger,
                start: opts?.startOffset ?? "top bottom",
                end: opts?.endOffset ?? "bottom top",
                scrub: SCRUB_SMOOTH,
            },
        }
    );
}
