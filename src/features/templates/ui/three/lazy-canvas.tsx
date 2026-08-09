"use client";

import { Component, type ComponentProps, type ReactNode } from "react";
import { Canvas as R3FCanvas } from "@react-three/fiber";

type CanvasProps = ComponentProps<typeof R3FCanvas>;

interface WebGLErrorBoundaryState {
    hasError: boolean;
}

// Some browsers (and Chrome with strict fingerprinting protections, or pages
// that hit the per-tab WebGL context budget) block context creation, return
// a context-loss error, or throw inside `new WebGLRenderer()`. Without a
// boundary that crash unwinds the whole React tree and the user sees Next's
// "Application error" page. Catch it here, render nothing, and log once.
class WebGLErrorBoundary extends Component<{ children: ReactNode }, WebGLErrorBoundaryState> {
    state: WebGLErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): WebGLErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: unknown) {
        console.warn("[three] WebGL canvas failed to mount; rendering fallback.", error);
    }

    render() {
        if (this.state.hasError) {
            return null;
        }
        return this.props.children;
    }
}

export function Canvas(props: CanvasProps) {
    const { gl: glOverride, onCreated, ...rest } = props;
    return (
        <WebGLErrorBoundary>
            <R3FCanvas
                {...rest}
                gl={{
                    // Resilient defaults so integrated GPUs and battery-saver
                    // browsers don't refuse the context. Callers can still
                    // override via the `gl` prop.
                    failIfMajorPerformanceCaveat: false,
                    powerPreference: "default",
                    preserveDrawingBuffer: false,
                    antialias: false,
                    ...(typeof glOverride === "object" && glOverride !== null ? glOverride : {}),
                }}
                onCreated={(state) => {
                    const canvas = state.gl.domElement;
                    canvas.addEventListener("webglcontextlost", (event) => {
                        event.preventDefault();
                        console.warn("[three] WebGL context lost; awaiting restore.");
                    });
                    canvas.addEventListener("webglcontextrestored", () => {
                        state.invalidate();
                    });
                    onCreated?.(state);
                }}
            />
        </WebGLErrorBoundary>
    );
}
