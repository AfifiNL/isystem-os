"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas } from "./lazy-canvas";
import { Float, Line, OrbitControls, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CityEnvironment } from "./environment-map";

function OrbCore() {
    const shellRef = useRef<THREE.Mesh>(null);
    const innerRef = useRef<THREE.Mesh>(null);

    useFrame((_, delta) => {
        if (shellRef.current) {
            shellRef.current.rotation.y += delta * 0.18;
            shellRef.current.rotation.x += delta * 0.08;
        }
        if (innerRef.current) {
            innerRef.current.rotation.y -= delta * 0.32;
            innerRef.current.rotation.z += delta * 0.12;
        }
    });

    return (
        <group>
            <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.8}>
                <mesh ref={shellRef}>
                    <icosahedronGeometry args={[1.45, 18]} />
                    <meshPhysicalMaterial color="#67e8f9" roughness={0.05} metalness={0.28} transmission={0.72} thickness={1.8} clearcoat={1} clearcoatRoughness={0.04} emissive="#67e8f9" emissiveIntensity={0.08} envMapIntensity={1.6} />
                </mesh>
            </Float>
            <Float speed={1.9} rotationIntensity={0.4} floatIntensity={0.45}>
                <mesh ref={innerRef} scale={0.72}>
                    <octahedronGeometry args={[1, 2]} />
                    <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={0.55} metalness={0.65} roughness={0.15} />
                </mesh>
            </Float>
        </group>
    );
}

function OrbitConnections() {
    const curves = useMemo(() => {
        return [
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(-2.2, 0.1, 0.2),
                new THREE.Vector3(-0.8, 1.1, 1.1),
                new THREE.Vector3(0.8, 1.1, -0.4),
                new THREE.Vector3(2.1, 0.3, 0.5),
            ]),
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(-2.1, -0.45, -0.4),
                new THREE.Vector3(-0.2, -1.3, 0.9),
                new THREE.Vector3(1.2, -0.7, -0.9),
                new THREE.Vector3(2.2, -0.25, 0.25),
            ]),
        ];
    }, []);

    return (
        <group>
            {curves.map((curve, index) => (
                <Line key={index} points={curve.getPoints(80)} color={index === 0 ? "#67e8f9" : "#c084fc"} lineWidth={1.2} transparent opacity={0.72} />
            ))}
        </group>
    );
}

export function SystemOrbScene({ className = "h-[420px] w-full" }: { className?: string }) {
    return (
        <div className={className}>
            <Canvas camera={{ position: [0, 0, 5.5], fov: 38 }} dpr={[1, 1.5]}>
                <Suspense fallback={null}>
                    <color attach="background" args={["#020617"]} />
                    <fog attach="fog" args={["#020617", 5.5, 10]} />
                    <ambientLight intensity={0.8} />
                    <directionalLight position={[4, 4, 4]} intensity={2.8} color="#67e8f9" />
                    <pointLight position={[-3, -1.5, 2]} intensity={2.2} color="#c084fc" />
                    <spotLight position={[0, 3, 4]} angle={0.45} penumbra={1} intensity={1.9} color="#f8fafc" />
                    <Sparkles count={120} scale={[6, 4, 4]} size={2.5} speed={0.35} color="#67e8f9" opacity={0.55} />
                    <OrbitConnections />
                    <OrbCore />
                    <CityEnvironment />
                    <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.45} />
                </Suspense>
            </Canvas>
        </div>
    );
}
