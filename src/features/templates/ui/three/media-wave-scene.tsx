"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { CityEnvironment } from "./environment-map";

function WaveSurface() {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!meshRef.current) return;
        const geometry = meshRef.current.geometry as THREE.PlaneGeometry;
        const position = geometry.attributes.position;

        for (let i = 0; i < position.count; i += 1) {
            const x = position.getX(i);
            const y = position.getY(i);
            const time = state.clock.elapsedTime;
            const z = Math.sin(x * 2.2 + time * 1.35) * 0.16 + Math.cos(y * 3.6 + time * 0.8) * 0.11;
            position.setZ(i, z);
        }

        position.needsUpdate = true;
        geometry.computeVertexNormals();
    });

    return (
        <mesh ref={meshRef} rotation={[-1.08, 0.12, 0.05]}>
            <planeGeometry args={[5.7, 3.8, 72, 72]} />
            <meshPhysicalMaterial color="#0ea5e9" roughness={0.12} metalness={0.38} transmission={0.3} thickness={1.2} clearcoat={1} clearcoatRoughness={0.08} emissive="#a855f7" emissiveIntensity={0.12} wireframe />
        </mesh>
    );
}

export function MediaWaveScene({ className = "h-[320px] w-full" }: { className?: string }) {
    return (
        <div className={className}>
            <Canvas camera={{ position: [0, 1.3, 3.9], fov: 40 }} dpr={[1, 1.5]}>
                <Suspense fallback={null}>
                    <color attach="background" args={["#020617"]} />
                    <ambientLight intensity={0.85} />
                    <pointLight position={[0, 2, 3]} intensity={2.5} color="#67e8f9" />
                    <pointLight position={[-2, 1, -2]} intensity={1.9} color="#c084fc" />
                    <spotLight position={[0, 3, 4]} angle={0.52} penumbra={1} intensity={1.8} color="#ffffff" />
                    <Sparkles count={60} scale={[5, 3, 3]} size={2.2} speed={0.25} color="#67e8f9" opacity={0.32} />
                    <WaveSurface />
                    <CityEnvironment />
                </Suspense>
            </Canvas>
        </div>
    );
}
