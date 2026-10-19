"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// ── Constants & Dimensions ──────────────────────────────────────
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;
const BEAD_RADIUS = 0.046;
const FILL_MAX_Y = 0.22; // Fills ~58% of the capsule volume
const FILL_MIN_Y = -1.10;

interface BeadSpec {
  baseX: number;
  baseY: number;
  baseZ: number;
  radius: number;
  phase: number;
  color: THREE.Color;
}

/**
 * Generates a realistic, dense packing of beads filling the lower half of
 * the capsule shell, matching the multi-pellet sustained release reference image.
 */
function createBeadPack(): BeadSpec[] {
  const specs: BeadSpec[] = [];
  const colorCyan = new THREE.Color("#00F0FF");
  const colorMint = new THREE.Color("#10B981");
  const colorBlue = new THREE.Color("#2563EB");
  const colorWhite = new THREE.Color("#FFFFFF");

  const layers = 14;
  const dy = (FILL_MAX_Y - FILL_MIN_Y) / (layers - 1);

  // Deterministic pseudo-random seed helper
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let l = 0; l < layers; l++) {
    const y = FILL_MIN_Y + l * dy;

    // Calculate maximum available radius at this height inside capsule
    let maxR = CAPSULE_RADIUS - BEAD_RADIUS - 0.015;
    if (y < -CYLINDER_HALF_HEIGHT) {
      const capDist = y - (-CYLINDER_HALF_HEIGHT);
      const capR = CAPSULE_RADIUS - BEAD_RADIUS - 0.015;
      maxR = Math.sqrt(Math.max(0.001, capR * capR - capDist * capDist));
    }

    if (maxR < 0.04) continue;

    // Center bead if wide enough
    if (maxR > 0.08) {
      const roll = pseudoRand();
      const col = roll < 0.35 ? colorCyan : roll < 0.65 ? colorMint : roll < 0.85 ? colorBlue : colorWhite;
      specs.push({
        baseX: (pseudoRand() - 0.5) * 0.02,
        baseY: y + (pseudoRand() - 0.5) * 0.02,
        baseZ: (pseudoRand() - 0.5) * 0.02,
        radius: BEAD_RADIUS * (0.92 + pseudoRand() * 0.16),
        phase: pseudoRand() * Math.PI * 2,
        color: col,
      });
    }

    // Concentric rings of beads
    const ringSpacing = BEAD_RADIUS * 1.95;
    const numRings = Math.floor(maxR / ringSpacing);

    for (let r = 1; r <= numRings; r++) {
      const ringRadius = r * ringSpacing;
      if (ringRadius > maxR) break;

      const circumference = 2 * Math.PI * ringRadius;
      const beadCountInRing = Math.max(4, Math.floor(circumference / (BEAD_RADIUS * 2.05)));
      const angleOffset = (l * 0.38) + (r * 0.52);

      for (let i = 0; i < beadCountInRing; i++) {
        const angle = angleOffset + (i / beadCountInRing) * Math.PI * 2;
        const jitterR = ringRadius + (pseudoRand() - 0.5) * 0.018;
        const jitterY = y + (pseudoRand() - 0.5) * 0.022;

        const bx = Math.cos(angle) * jitterR;
        const bz = Math.sin(angle) * jitterR;

        const roll = pseudoRand();
        const col =
          roll < 0.35
            ? colorCyan
            : roll < 0.65
            ? colorMint
            : roll < 0.85
            ? colorBlue
            : colorWhite;

        specs.push({
          baseX: bx,
          baseY: jitterY,
          baseZ: bz,
          radius: BEAD_RADIUS * (0.92 + pseudoRand() * 0.16),
          phase: pseudoRand() * Math.PI * 2,
          color: col,
        });
      }
    }
  }

  return specs;
}

// ── Beads Layer Component ───────────────────────────────────────
function BeadsLayer({
  beadSpecs,
  dummy,
  instancedRef,
  colorsArray,
}: {
  beadSpecs: BeadSpec[];
  dummy: THREE.Object3D;
  instancedRef: React.RefObject<THREE.InstancedMesh | null>;
  colorsArray: Float32Array;
}) {
  return (
    <instancedMesh
      ref={instancedRef}
      args={[undefined, undefined, beadSpecs.length]}
      renderOrder={1}
    >
      <sphereGeometry args={[1, 16, 16]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colorsArray, 3]}
        />
      </sphereGeometry>
      <meshStandardMaterial
        vertexColors
        roughness={0.25}
        metalness={0.2}
        emissive="#001820"
        emissiveIntensity={0.25}
      />
    </instancedMesh>
  );
}

// ── Crystal Glass Capsule Shell Component ───────────────────────
function CapsuleGlassShell() {
  return (
    <group renderOrder={2}>
      {/* Outer Clear Pharmaceutical Glass Shell */}
      <mesh>
        <capsuleGeometry args={[CAPSULE_RADIUS, CYLINDER_HALF_HEIGHT * 2, 32, 64]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.22}
          roughness={0.06}
          metalness={0.12}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          ior={1.48}
          specularIntensity={1.4}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle Capsule Cap Joint Seam */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[CAPSULE_RADIUS + 0.002, 0.005, 12, 64]} />
        <meshStandardMaterial
          color="#00f0ff"
          transparent
          opacity={0.35}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

// ── Capsule Rig with Authentic Tumbling Physics ─────────────────
function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedMesh = useRef<THREE.InstancedMesh>(null);

  const tilt = useRef({ x: 0.16, z: -0.36 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const mouseImpulse = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-generate packed beads
  const beadSpecs = useMemo(() => createBeadPack(), []);

  // Build colors array
  const colorsArray = useMemo(() => {
    const arr = new Float32Array(beadSpecs.length * 3);
    for (let i = 0; i < beadSpecs.length; i++) {
      const c = beadSpecs[i].color;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [beadSpecs]);

  // Initial bead position assignment
  useMemo(() => {
    // runs once on setup
    return true;
  }, []);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.05);
    timeRef.current += safeDelta;
    const t = timeRef.current;
    const g = group.current;

    const pX = state.pointer.x;
    const pY = state.pointer.y;
    const dX = pX - pointerPrev.current.x;
    const dY = pY - pointerPrev.current.y;
    pointerPrev.current = { x: pX, y: pY };

    if (g && !reduced) {
      // Gentle idle tumbling roll + cursor tilt
      g.rotation.y += safeDelta * 0.14;
      const targetX = 0.18 + pY * -0.28;
      const targetZ = -0.36 + pX * 0.25 + Math.sin(t * 0.5) * 0.03;
      tilt.current.x = THREE.MathUtils.lerp(tilt.current.x, targetX, 0.06);
      tilt.current.z = THREE.MathUtils.lerp(tilt.current.z, targetZ, 0.06);
      g.rotation.x = tilt.current.x;
      g.rotation.z = tilt.current.z;

      mouseImpulse.current.x = THREE.MathUtils.lerp(mouseImpulse.current.x, dX * 8, 0.1);
      mouseImpulse.current.y = THREE.MathUtils.lerp(mouseImpulse.current.y, -dY * 8, 0.1);
    }

    // Dynamic bead tumbling and physical jiggle
    const mesh = instancedMesh.current;
    if (mesh) {
      const curRotX = g ? g.rotation.x : 0;
      const curRotZ = g ? g.rotation.z : 0;

      // Effective gravity tilt in local capsule frame
      const tiltOffsetX = Math.sin(curRotZ) * 0.08 + mouseImpulse.current.x * 0.04;
      const tiltOffsetY = (Math.cos(curRotX) * Math.cos(curRotZ) - 1.0) * 0.06;
      const tiltOffsetZ = Math.sin(curRotX) * 0.08;

      const beadCount = beadSpecs.length;
      for (let i = 0; i < beadCount; i++) {
        const spec = beadSpecs[i];

        // Layer depth factor: beads near top of pile move more than tightly packed bottom beads
        const heightNorm = (spec.baseY - FILL_MIN_Y) / (FILL_MAX_Y - FILL_MIN_Y);
        const dynamicFactor = 0.4 + heightNorm * 0.9;

        // Micro-jiggle / organic fluid roll
        const jiggleX = Math.sin(t * 1.8 + spec.phase) * 0.008 * dynamicFactor;
        const jiggleY = Math.cos(t * 2.2 + spec.phase) * 0.006 * dynamicFactor;
        const jiggleZ = Math.cos(t * 1.8 + spec.phase * 1.5) * 0.008 * dynamicFactor;

        // Physical displacement
        let curX = spec.baseX + tiltOffsetX * dynamicFactor + jiggleX;
        let curY = spec.baseY + tiltOffsetY * dynamicFactor + jiggleY;
        let curZ = spec.baseZ + tiltOffsetZ * dynamicFactor + jiggleZ;

        // Boundary containment within capsule inner wall
        const effR = CAPSULE_RADIUS - spec.radius - 0.008;
        if (curY < -CYLINDER_HALF_HEIGHT) {
          const capDist = curY - (-CYLINDER_HALF_HEIGHT);
          const rHypot = Math.hypot(curX, capDist, curZ);
          if (rHypot > effR && rHypot > 0.001) {
            const scale = effR / rHypot;
            curX *= scale;
            curY = -CYLINDER_HALF_HEIGHT + capDist * scale;
            curZ *= scale;
          }
        } else {
          const rCyl = Math.hypot(curX, curZ);
          if (rCyl > effR && rCyl > 0.001) {
            const scale = effR / rCyl;
            curX *= scale;
            curZ *= scale;
          }
        }

        dummy.position.set(curX, curY, curZ);
        dummy.scale.set(spec.radius, spec.radius, spec.radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group} rotation={[0.18, -0.28, -0.36]}>
      <Float
        speed={reduced ? 0 : 1.3}
        rotationIntensity={reduced ? 0 : 0.14}
        floatIntensity={reduced ? 0 : 0.45}
      >
        {/* Layer 1: Isolated Solid Brand Beads (renderOrder=1) */}
        <BeadsLayer
          beadSpecs={beadSpecs}
          dummy={dummy}
          instancedRef={instancedMesh}
          colorsArray={colorsArray}
        />

        {/* Layer 2: Crystal Glass Capsule Shell (renderOrder=2, depthWrite=false) */}
        <CapsuleGlassShell />
      </Float>
    </group>
  );
}

// ── Clean Studio Lighting Component ─────────────────────────────
function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[-4, 4, 4]} intensity={2.6} color="#ffffff" />
      <directionalLight position={[4, -2, 3]} intensity={1.8} color="#00f0ff" />
      <directionalLight position={[0, -4, -3]} intensity={1.6} color="#10b981" />
      <pointLight position={[2, 3, 2]} intensity={1.4} color="#eafcff" />
    </>
  );
}

/**
 * Hero WebGL Scene: Modular transparent crystal capsule filled with isolated,
 * vibrant brand-colored beads (Cyan, Mint, Blue, White) with realistic tumbling
 * physics, blending seamlessly with the hero backdrop.
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
      camera={{ position: [0, 0, 4.4], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={reduced ? "demand" : frameloop}
      style={{ background: "transparent" }}
    >
      <StudioLights />
      <CapsuleRig reduced={reduced} />
    </Canvas>
  );
}


