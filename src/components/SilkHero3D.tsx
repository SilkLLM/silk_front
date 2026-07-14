/**
 * SilkHero3D.tsx
 * Interactive 3D neural-network / data-flow hero using @react-three/fiber.
 * Replaces the ribbon concept with:
 *  - A central SilkLLM core node (glowing gold sphere)
 *  - 5 orbiting provider nodes in their brand colors
 *  - Animated glowing edges between core and each provider
 *  - Particle packets travelling along the edges
 *  - Subtle mouse parallax on the whole scene
 * Lazy-loaded - never blocks first paint.
 */

// File: silkllm-frontend/src/components/SilkHero3D.tsx

import React, { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Stars, Sphere, Line, Trail } from "@react-three/drei";
import * as THREE from "three";

// ── Provider config ──────────────────────────────────────────────────────────
const PROVIDERS = [
  { name: "OpenAI",    color: "#74aa9c", orbit: 2.6, speed: 0.38, phase: 0 },
  { name: "Anthropic", color: "#D97757", orbit: 3.0, speed: 0.28, phase: Math.PI * 0.4 },
  { name: "Google",    color: "#4285f4", orbit: 2.7, speed: 0.22, phase: Math.PI * 0.8 },
  { name: "DeepSeek",  color: "#0e7fbe", orbit: 2.9, speed: 0.32, phase: Math.PI * 1.2 },
  { name: "xAI",       color: "#e0e0e0", orbit: 2.5, speed: 0.45, phase: Math.PI * 1.6 },
];

// ── Utility: position on tilted orbit ───────────────────────────────────────
function orbitPosition(t: number, radius: number, speed: number, phase: number, tilt = 0.4): THREE.Vector3 {
  const angle = t * speed + phase;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle * 0.5) * radius * tilt,
    Math.sin(angle) * radius * 0.6,
  );
}

// ── Central core node ────────────────────────────────────────────────────────
function CoreNode() {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.3;
      ref.current.rotation.z = t * 0.15;
    }
    if (glowRef.current) {
      const s = 1 + 0.12 * Math.sin(t * 1.8);
      glowRef.current.scale.setScalar(s);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.06 * Math.sin(t * 1.8);
    }
  });

  return (
    <group>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#D29A2D" transparent opacity={0.1} />
      </mesh>
      {/* Core */}
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.28, 2]} />
        <meshStandardMaterial
          color="#D29A2D"
          emissive="#D0A020"
          emissiveIntensity={1.2}
          metalness={0.7}
          roughness={0.15}
          wireframe={false}
        />
      </mesh>
      {/* Wireframe shell */}
      <mesh>
        <icosahedronGeometry args={[0.35, 2]} />
        <meshBasicMaterial color="#D29A2D" wireframe transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

// ── Single orbiting provider node ────────────────────────────────────────────
function ProviderNode({ color, orbit, speed, phase }: typeof PROVIDERS[0]) {
  const meshRef   = useRef<THREE.Mesh>(null);
  const ringRef   = useRef<THREE.Mesh>(null);
  const posRef    = useRef(new THREE.Vector3());

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = orbitPosition(t, orbit, speed, phase);
    posRef.current.copy(pos);
    if (meshRef.current) {
      meshRef.current.position.copy(pos);
      meshRef.current.rotation.y = t * 0.8;
    }
    if (ringRef.current) {
      ringRef.current.position.copy(pos);
      const s = 1 + 0.15 * Math.sin(t * 2.5 + phase);
      ringRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      {/* Glow ring */}
      <mesh ref={ringRef}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      {/* Provider sphere */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

// ── Edge beam between core and provider ─────────────────────────────────────
function EdgeBeam({ color, orbit, speed, phase }: typeof PROVIDERS[0]) {
  const ref = useRef<THREE.Line>(null);
  const positions = useMemo(() => new Float32Array(6), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const end = orbitPosition(t, orbit, speed, phase);
    // start = core (origin)
    positions[0] = 0; positions[1] = 0; positions[2] = 0;
    positions[3] = end.x; positions[4] = end.y; positions[5] = end.z;
    if (ref.current) {
      (ref.current.geometry as THREE.BufferGeometry)
        .setAttribute("position", new THREE.BufferAttribute(positions, 3));
      (ref.current.geometry as THREE.BufferGeometry).attributes.position.needsUpdate = true;
      // pulse opacity
      const mat = ref.current.material as THREE.LineBasicMaterial;
      mat.opacity = 0.18 + 0.12 * Math.sin(t * 1.5 + phase);
    }
  });

  return (
    <line ref={ref as any}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={0.25} linewidth={1} />
    </line>
  );
}

// ── Packet travelling along an edge ─────────────────────────────────────────
function Packet({ color, orbit, speed, phase }: typeof PROVIDERS[0]) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    // t_local: 0→1 cycling over ~2s, offset by phase
    const cycle = ((t * 0.55 + phase * 0.3) % 1);
    const end = orbitPosition(t, orbit, speed, phase);
    ref.current.position.lerpVectors(new THREE.Vector3(0, 0, 0), end, cycle);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    // fade at ends
    mat.opacity = Math.sin(cycle * Math.PI) * 0.9;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.028, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

// ── Mouse-reactive scene wrapper ─────────────────────────────────────────────
function Scene() {
  const groupRef = useRef<THREE.Group>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const target = useRef({ rx: 0, ry: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useFrame((_, delta) => {
    target.current.ry += (mouse.current.x * 0.3 - target.current.ry) * 0.04;
    target.current.rx += (mouse.current.y * 0.15 - target.current.rx) * 0.04;
    if (groupRef.current) {
      groupRef.current.rotation.y = target.current.ry;
      groupRef.current.rotation.x = target.current.rx;
    }
  });

  return (
    <group ref={groupRef}>
      <CoreNode />
      {PROVIDERS.map(p => (
        <React.Fragment key={p.name}>
          <EdgeBeam   {...p} />
          <Packet     {...p} />
          <ProviderNode {...p} />
        </React.Fragment>
      ))}
    </group>
  );
}

// ── Canvas ───────────────────────────────────────────────────────────────────
export default function SilkHero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 55 }}
      style={{ width: "100%", height: "100%" }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]}  intensity={3}   color="#D29A2D" distance={8}  decay={2} />
      <pointLight position={[5, 3, 2]}  intensity={0.8} color="#D0C51E" distance={10} decay={2} />
      <pointLight position={[-4, -2, -3]} intensity={0.5} color="#4285f4" distance={8} decay={2} />

      {/* Stars */}
      <Stars radius={90} depth={60} count={2500} factor={2.8} saturation={0} fade />

      <Scene />
    </Canvas>
  );
}

// EOF silkllm-frontend/src/components/SilkHero3D.tsx