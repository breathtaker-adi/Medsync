"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

/** Double-helix parametric curve for the interior DNA / pulse strand. */
function makeHelix(offset: number, turns: number, height: number, radius: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const a = t * Math.PI * 2 * turns + offset;
    pts.push(
      new THREE.Vector3(
        Math.cos(a) * radius,
        (t - 0.5) * height,
        Math.sin(a) * radius
      )
    );
  }
  return new THREE.CatmullRomCurve3(pts);
}

function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pulseA = useRef<THREE.Mesh>(null);
  const pulseB = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const tilt = useRef(0);

  const helixA = useMemo(() => makeHelix(0, 2.35, 1.7, 0.235), []);
  const helixB = useMemo(() => makeHelix(Math.PI, 2.35, 1.7, 0.235), []);
  const tubeA = useMemo(
    () => new THREE.TubeGeometry(helixA, 130, 0.02, 8, false),
    [helixA]
  );
  const tubeB = useMemo(
    () => new THREE.TubeGeometry(helixB, 130, 0.02, 8, false),
    [helixB]
  );

  /** Soft cyan halo behind the capsule — radial gradient on an additive plane. */
  const glowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(0,240,255,0.5)");
    g.addColorStop(0.35, "rgba(0,240,255,0.16)");
    g.addColorStop(1, "rgba(0,240,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state, delta) => {
    if (reduced) return;
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (g) {
      // slow autonomous spin + cursor-parallax tilt
      g.rotation.y += delta * 0.12;
      const target = 0.12 + state.pointer.y * -0.22;
      tilt.current = THREE.MathUtils.lerp(tilt.current, target, 0.045);
      g.rotation.x = tilt.current;
      g.rotation.z = -0.42 + Math.sin(t * 0.4) * 0.045;
    }
    // light pulses traveling the strands
    if (pulseA.current) {
      pulseA.current.position.copy(helixA.getPointAt((t * 0.13) % 1));
      const s = 1 + Math.sin(t * 6) * 0.3;
      pulseA.current.scale.setScalar(s);
    }
    if (pulseB.current) {
      pulseB.current.position.copy(helixB.getPointAt((t * 0.13 + 0.5) % 1));
      const s = 1 + Math.cos(t * 5) * 0.3;
      pulseB.current.scale.setScalar(s);
    }
    // precessing orbit rings
    if (ringA.current) ringA.current.rotation.y = t * 0.24;
    if (ringB.current) ringB.current.rotation.y = -t * 0.18;
  });

  return (
    <group ref={group} rotation={[0.12, -0.3, -0.42]}>
      <Float
        speed={reduced ? 0 : 1.6}
        rotationIntensity={reduced ? 0 : 0.25}
        floatIntensity={reduced ? 0 : 0.85}
      >
        {/* translucent glass capsule */}
        <mesh>
          <capsuleGeometry args={[0.6, 1.35, 24, 48]} />
          <meshPhysicalMaterial
            transmission={0.96}
            thickness={1.25}
            roughness={0.05}
            ior={1.45}
            clearcoat={1}
            clearcoatRoughness={0.08}
            color="#a8fdf6"
            attenuationColor="#00f0ff"
            attenuationDistance={2.6}
            envMapIntensity={1.5}
            specularIntensity={1.1}
            transparent
          />
        </mesh>

        {/* interior glowing DNA / pulse strand */}
        <mesh geometry={tubeA}>
          <meshBasicMaterial color="#00f0ff" toneMapped={false} transparent opacity={0.95} />
        </mesh>
        <mesh geometry={tubeB}>
          <meshBasicMaterial color="#34d399" toneMapped={false} transparent opacity={0.9} />
        </mesh>

        {/* traveling light pulses */}
        <mesh ref={pulseA}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#d8feff" toneMapped={false} />
        </mesh>
        <mesh ref={pulseB}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#c3ffe6" toneMapped={false} />
        </mesh>
      </Float>

      {/* precessing orbit rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.15, 0.2, 0]}>
        <torusGeometry args={[1.18, 0.004, 8, 128]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.85, -0.35, 0]}>
        <torusGeometry args={[1.42, 0.003, 8, 128]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.3} toneMapped={false} />
      </mesh>

      {/* halo backdrop */}
      <mesh position={[0, 0, -1.5]} scale={[4.6, 4.6, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={glowTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.55}
        />
      </mesh>

      {/* biometric particle cloud */}
      <Sparkles
        count={110}
        scale={[5.2, 3.4, 2.6]}
        size={1.8}
        speed={reduced ? 0 : 0.35}
        color="#7ef0ff"
        opacity={0.5}
      />
    </group>
  );
}

/**
 * Hero WebGL scene — zero-gravity glass capsule refracting an interior
 * DNA pulse strand. Props: frameloop pauses when scrolled off-screen.
 */
export default function CapsuleCanvas({
  frameloop = "always",
  reduced = false,
}: {
  frameloop?: "always" | "never" | "demand";
  reduced?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.6], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={reduced ? "demand" : frameloop}
      style={{ background: "transparent" }}
    >
      <CapsuleRig reduced={reduced} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3.2} color="#00f0ff" position={[-4, 2, 3]} scale={[5, 3]} />
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[3, 1, 4]} scale={[4, 2]} />
        <Lightformer form="rect" intensity={2.2} color="#10b981" position={[-2, -3, -3]} scale={[4, 4]} />
        <Lightformer form="ring" intensity={2.4} color="#9ffcf4" position={[3, -2, -2]} scale={2.5} />
      </Environment>
    </Canvas>
  );
}
