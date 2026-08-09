"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { CityEnvironment } from "./environment-map";

function GlobeMesh() {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((_, delta) => {
        if (!groupRef.current) return;
        groupRef.current.rotation.y += delta * 0.15;
    });

    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[1.48, 64, 64]} />
                <meshPhysicalMaterial color="#0f172a" transmission={0.25} roughness={0.08} metalness={0.32} clearcoat={1} clearcoatRoughness={0.08} emissive="#22d3ee" emissiveIntensity={0.06} />
            </mesh>
            <mesh scale={1.02}>
                <sphereGeometry args={[1.48, 48, 48]} />
                <meshBasicMaterial color="#67e8f9" wireframe transparent opacity={0.2} />
            </mesh>
        </group>
    );
}

function OrbitArcs() {
    const curves = useMemo(() => [
        [new THREE.Vector3(-1.15, 0.52, 0.32), new THREE.Vector3(-0.15, 1.28, 1.0), new THREE.Vector3(1.15, 0.48, 0.22)],
        [new THREE.Vector3(-0.98, -0.55, -0.28), new THREE.Vector3(0.2, 0.18, 1.38), new THREE.Vector3(0.98, -0.42, -0.2)],
        [new THREE.Vector3(-0.3, -1.1, 0.05), new THREE.Vector3(0.0, -0.1, 1.52), new THREE.Vector3(0.72, 0.96, 0.24)],
    ], []);

    return (
        <group>
            {curves.map((curve, index) => (
                <Line key={index} points={curve} color={index % 2 === 0 ? "#67e8f9" : "#c084fc"} lineWidth={1.8} transparent opacity={0.8} />
            ))}
        </group>
    );
}

function OrbitNodes() {
    const nodes = useMemo(() => [
        [-1.15, 0.52, 0.32],
        [1.15, 0.48, 0.22],
        [-0.98, -0.55, -0.28],
        [0.98, -0.42, -0.2],
        [0.72, 0.96, 0.24],
    ] as const, []);

    return (
        <group>
            {nodes.map((position, index) => (
                <Float key={index} speed={1.2 + index * 0.08} rotationIntensity={0.2} floatIntensity={0.35}>
                    <mesh position={position}>
                        <sphereGeometry args={[0.07, 24, 24]} />
                        <meshStandardMaterial color={index % 2 === 0 ? "#67e8f9" : "#c084fc"} emissive={index % 2 === 0 ? "#67e8f9" : "#c084fc"} emissiveIntensity={0.65} />
                    </mesh>
                </Float>
            ))}
        </group>
    );
}

export function SectorGlobeScene({ className = "h-[360px] w-full" }: { className?: string }) {
    return (
        <div className={className}>
            <Canvas camera={{ position: [0, 0, 4.8], fov: 38 }} dpr={[1, 1.5]}>
                <Suspense fallback={null}>
                    <color attach="background" args={["#020617"]} />
                    <ambientLight intensity={0.9} />
                    <directionalLight position={[3, 3, 4]} intensity={2.6} color="#67e8f9" />
                    <pointLight position={[-2.5, -1.5, 2]} intensity={2.1} color="#c084fc" />
                    <Sparkles count={90} scale={[5, 4, 4]} size={2.2} speed={0.28} color="#67e8f9" opacity={0.35} />
                    <GlobeMesh />
                    <OrbitArcs />
                    <OrbitNodes />
                    <CityEnvironment />
                    <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.42} />
                </Suspense>
            </Canvas>
        </div>
    );
}
