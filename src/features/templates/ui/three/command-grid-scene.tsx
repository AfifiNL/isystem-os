"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { CityEnvironment } from "./environment-map";

function DataColumns() {
    const groupRef = useRef<THREE.Group>(null);
    const cubes = useMemo(() => Array.from({ length: 32 }, (_, index) => ({
        position: [((index % 8) - 3.5) * 0.42, (Math.floor(index / 8) - 1.5) * 0.42, Math.sin(index * 1.2) * 0.25] as [number, number, number],
        height: 0.14 + ((index % 4) * 0.09),
        color: index % 3 === 0 ? "#67e8f9" : index % 3 === 1 ? "#c084fc" : "#f59e0b",
    })), []);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.18;
        groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.2) * 0.04;
        groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.04;
        groupRef.current.rotation.z += delta * 0.01;
    });

    return (
        <group ref={groupRef}>
            {cubes.map((cube, index) => (
                <Float key={index} speed={1 + (index % 5) * 0.08} rotationIntensity={0.08} floatIntensity={0.16}>
                    <mesh position={cube.position}>
                        <boxGeometry args={[0.2, cube.height, 0.2]} />
                        <meshStandardMaterial color={cube.color} emissive={cube.color} emissiveIntensity={0.22} metalness={0.52} roughness={0.14} />
                    </mesh>
                </Float>
            ))}
        </group>
    );
}

export function CommandGridScene({ className = "h-[280px] w-full" }: { className?: string }) {
    return (
        <div className={className}>
            <Canvas camera={{ position: [0, 0.4, 5.2], fov: 38 }} dpr={[1, 1.5]}>
                <Suspense fallback={null}>
                    <color attach="background" args={["#020617"]} />
                    <ambientLight intensity={0.8} />
                    <directionalLight position={[3, 4, 5]} intensity={2.6} color="#67e8f9" />
                    <pointLight position={[-2, -1, 3]} intensity={1.9} color="#c084fc" />
                    <Sparkles count={80} scale={[5, 3.5, 3.5]} size={2.2} speed={0.28} color="#67e8f9" opacity={0.35} />
                    <DataColumns />
                    <CityEnvironment />
                </Suspense>
            </Canvas>
        </div>
    );
}
