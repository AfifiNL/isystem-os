"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Count dropped from 1200 → 500. On top of the hero's Three.js scene this
// used to be a second WebGL context contributing to OOM on low-end GPUs.
const PARTICLE_COUNT = 500;

function Particles() {
    const ref = useRef<THREE.Points>(null);
    const positions = useMemo(() => {
        const array = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i += 1) {
            array[i * 3] = (Math.random() - 0.5) * 8;
            array[i * 3 + 1] = (Math.random() - 0.5) * 5.5;
            array[i * 3 + 2] = (Math.random() - 0.5) * 5;
        }
        return array;
    }, []);

    useFrame((_, delta) => {
        if (!ref.current) return;
        ref.current.rotation.y += delta * 0.03;
        ref.current.rotation.x -= delta * 0.015;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial color="#67e8f9" size={0.035} sizeAttenuation transparent opacity={0.9} />
        </points>
    );
}

export function ParticleFieldScene({ className = "absolute inset-0" }: { className?: string }) {
    // Gate WebGL mount behind viewport size + reduced-motion. The hero itself
    // already runs a full Three.js scene; stacking a second r3f Canvas on top
    // is what historically pushed low-end browsers over the edge.
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const sizeQuery = window.matchMedia("(min-width: 1024px)");
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const recompute = () => {
            setEnabled(sizeQuery.matches && !motionQuery.matches);
        };
        recompute();
        sizeQuery.addEventListener("change", recompute);
        motionQuery.addEventListener("change", recompute);
        return () => {
            sizeQuery.removeEventListener("change", recompute);
            motionQuery.removeEventListener("change", recompute);
        };
    }, []);

    if (!enabled) return null;

    return (
        <div className={className}>
            <Canvas
                camera={{ position: [0, 0, 4], fov: 50 }}
                dpr={[1, 1.25]}
                frameloop="always"
                gl={{ antialias: false, powerPreference: "high-performance" }}
            >
                <Suspense fallback={null}>
                    <Particles />
                </Suspense>
            </Canvas>
        </div>
    );
}
