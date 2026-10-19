"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

// ── Dimensions & Physics Constants ──────────────────────────────
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;
const BEAD_COUNT = 220;
const BEAD_BASE_RADIUS = 0.052;

interface PhysicalBead {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: THREE.Color;
}

/**
 * Initializes independent, free-floating physical beads in the lower half of the capsule.
 * Brand palette: Cyan (#00F0FF), Mint (#10B981), Royal Blue (#2563EB), Crisp White (#FFFFFF).
 */
function initPhysicalBeads(): PhysicalBead[] {
  const beads: PhysicalBead[] = [];
  const colorCyan = new THREE.Color("#00F0FF");
  const colorMint = new THREE.Color("#10B981");
  const colorBlue = new THREE.Color("#2563EB");
  const colorWhite = new THREE.Color("#FFFFFF");

  // Pseudo-random deterministic seed
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < BEAD_COUNT; i++) {
    const roll = rand();
    const color =
      roll < 0.35
        ? colorCyan
        : roll < 0.65
        ? colorMint
        : roll < 0.85
        ? colorBlue
        : colorWhite;

    // Distribute vertically in lower capsule from y = -1.05 to 0.12
    const y = -1.05 + rand() * 1.17;
    const effR = Math.max(0.02, (CAPSULE_RADIUS - BEAD_BASE_RADIUS - 0.02) * Math.sqrt(rand()));
    const angle = rand() * Math.PI * 2;

    beads.push({
      x: Math.cos(angle) * effR,
      y,
      z: Math.sin(angle) * effR,
      vx: (rand() - 0.5) * 0.02,
      vy: (rand() - 0.5) * 0.02,
      vz: (rand() - 0.5) * 0.02,
      radius: BEAD_BASE_RADIUS * (0.94 + rand() * 0.14),
      color,
    });
  }

  return beads;
}

// ── Physical Beads Layer Component ──────────────────────────────
function PhysicalBeadsLayer({
  beads,
  instancedRef,
  colorsArray,
}: {
  beads: PhysicalBead[];
  instancedRef: React.RefObject<THREE.InstancedMesh | null>;
  colorsArray: Float32Array;
}) {
  return (
    <instancedMesh
      ref={instancedRef}
      args={[undefined, undefined, beads.length]}
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
        roughness={0.24}
        metalness={0.22}
        emissive="#001a24"
        emissiveIntensity={0.28}
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
          opacity={0.07}
          roughness={0.03}
          metalness={0.05}
          clearcoat={1.0}
          clearcoatRoughness={0.03}
          ior={1.46}
          specularIntensity={1.8}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle Capsule Cap Joint Seam */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[CAPSULE_RADIUS + 0.002, 0.004, 12, 64]} />
        <meshStandardMaterial
          color="#00f0ff"
          transparent
          opacity={0.25}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

// ── Dynamic Capsule Rig with Real Granular Physics ──────────────
function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedMesh = useRef<THREE.InstancedMesh>(null);

  const tilt = useRef({ x: 0.16, z: -0.36 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const mouseImpulse = useRef({ x: 0, y: 0 });

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize beads array with their own independent state
  const beads = useMemo(() => initPhysicalBeads(), []);

  // Color buffer
  const colorsArray = useMemo(() => {
    const arr = new Float32Array(beads.length * 3);
    for (let i = 0; i < beads.length; i++) {
      const c = beads[i].color;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, [beads]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.035);
    const g = group.current;

    // Track mouse velocity
    const pX = state.pointer.x;
    const pY = state.pointer.y;
    const dX = pX - pointerPrev.current.x;
    const dY = pY - pointerPrev.current.y;
    pointerPrev.current = { x: pX, y: pY };

    if (g && !reduced) {
      // Autonomous smooth spin & cursor tilt
      g.rotation.y += dt * 0.15;
      const targetX = 0.18 + pY * -0.32;
      const targetZ = -0.36 + pX * 0.28;
      tilt.current.x = THREE.MathUtils.lerp(tilt.current.x, targetX, 0.06);
      tilt.current.z = THREE.MathUtils.lerp(tilt.current.z, targetZ, 0.06);
      g.rotation.x = tilt.current.x;
      g.rotation.z = tilt.current.z;

      mouseImpulse.current.x = THREE.MathUtils.lerp(mouseImpulse.current.x, dX * 24, 0.14);
      mouseImpulse.current.y = THREE.MathUtils.lerp(mouseImpulse.current.y, -dY * 24, 0.14);
    }

    // ── Free Particle Physics Step with Pairwise Collisions ──
    const mesh = instancedMesh.current;
    if (mesh) {
      const rotX = g ? g.rotation.x : 0;
      const rotZ = g ? g.rotation.z : 0;

      // 2 sub-steps per frame for rock-solid stability and crisp collisions
      const subSteps = 2;
      const subDt = dt / subSteps;

      // Local gravity vector inside rotating capsule frame
      const gx = -11.0 * Math.sin(rotZ) + mouseImpulse.current.x;
      const gy = -11.0 * Math.cos(rotX) * Math.cos(rotZ);
      const gz = 11.0 * Math.sin(rotX) + mouseImpulse.current.y;

      const N = beads.length;

      for (let s = 0; s < subSteps; s++) {
        // 1. Apply gravity, inertia, and position integration
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          b.vx += gx * subDt;
          b.vy += gy * subDt;
          b.vz += gz * subDt;

          // Rolling and air friction
          b.vx *= 0.985;
          b.vy *= 0.985;
          b.vz *= 0.985;

          // Integrate position
          b.x += b.vx * subDt;
          b.y += b.vy * subDt;
          b.z += b.vz * subDt;

          // 2. Capsule inner wall boundary collision
          const effR = CAPSULE_RADIUS - b.radius;
          if (b.y < -CYLINDER_HALF_HEIGHT) {
            // Bottom spherical cap
            const capCenterY = -CYLINDER_HALF_HEIGHT;
            const dy = b.y - capCenterY;
            const dist = Math.hypot(b.x, dy, b.z);
            if (dist > effR && dist > 0.0001) {
              const nx = b.x / dist;
              const ny = dy / dist;
              const nz = b.z / dist;
              b.x = nx * effR;
              b.y = capCenterY + ny * effR;
              b.z = nz * effR;

              const vDotN = b.vx * nx + b.vy * ny + b.vz * nz;
              if (vDotN > 0) {
                b.vx = (b.vx - 1.4 * vDotN * nx) * 0.6;
                b.vy = (b.vy - 1.4 * vDotN * ny) * 0.6;
                b.vz = (b.vz - 1.4 * vDotN * nz) * 0.6;
              }
            }
          } else if (b.y > CYLINDER_HALF_HEIGHT) {
            // Top spherical cap
            const capCenterY = CYLINDER_HALF_HEIGHT;
            const dy = b.y - capCenterY;
            const dist = Math.hypot(b.x, dy, b.z);
            if (dist > effR && dist > 0.0001) {
              const nx = b.x / dist;
              const ny = dy / dist;
              const nz = b.z / dist;
              b.x = nx * effR;
              b.y = capCenterY + ny * effR;
              b.z = nz * effR;

              const vDotN = b.vx * nx + b.vy * ny + b.vz * nz;
              if (vDotN > 0) {
                b.vx = (b.vx - 1.4 * vDotN * nx) * 0.6;
                b.vy = (b.vy - 1.4 * vDotN * ny) * 0.6;
                b.vz = (b.vz - 1.4 * vDotN * nz) * 0.6;
              }
            }
          } else {
            // Cylindrical side wall
            const rCyl = Math.hypot(b.x, b.z);
            if (rCyl > effR && rCyl > 0.0001) {
              const nx = b.x / rCyl;
              const nz = b.z / rCyl;
              b.x = nx * effR;
              b.z = nz * effR;

              const vDotN = b.vx * nx + b.vz * nz;
              if (vDotN > 0) {
                b.vx = (b.vx - 1.4 * vDotN * nx) * 0.6;
                b.vz = (b.vz - 1.4 * vDotN * nz) * 0.6;
              }
            }
          }
        }

        // 3. Pairwise sphere-sphere collision relaxation (volume exclusion)
        for (let i = 0; i < N; i++) {
          const bi = beads[i];
          for (let j = i + 1; j < N; j++) {
            const bj = beads[j];
            const dy = bi.y - bj.y;
            const minDist = bi.radius + bj.radius;
            if (Math.abs(dy) >= minDist) continue;

            const dx = bi.x - bj.x;
            if (Math.abs(dx) >= minDist) continue;

            const dz = bi.z - bj.z;
            if (Math.abs(dz) >= minDist) continue;

            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq < minDist * minDist && distSq > 0.00001) {
              const dist = Math.sqrt(distSq);
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;

              // Push apart along contact normal
              const sep = overlap * 0.5;
              bi.x += nx * sep;
              bi.y += ny * sep;
              bi.z += nz * sep;

              bj.x -= nx * sep;
              bj.y -= ny * sep;
              bj.z -= nz * sep;

              // Velocity exchange along collision normal
              const relVx = bi.vx - bj.vx;
              const relVy = bi.vy - bj.vy;
              const relVz = bi.vz - bj.vz;
              const normalVel = relVx * nx + relVy * ny + relVz * nz;

              if (normalVel < 0) {
                const impulse = -1.25 * normalVel * 0.5;
                bi.vx += nx * impulse;
                bi.vy += ny * impulse;
                bi.vz += nz * impulse;

                bj.vx -= nx * impulse;
                bj.vy -= ny * impulse;
                bj.vz -= nz * impulse;
              }
            }
          }
        }
      }

      // Update 3D instance matrices
      for (let i = 0; i < N; i++) {
        const b = beads[i];
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.set(b.radius, b.radius, b.radius);
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
        rotationIntensity={reduced ? 0 : 0.12}
        floatIntensity={reduced ? 0 : 0.45}
      >
        {/* Layer 1: Free Physical Beads (renderOrder=1) */}
        <PhysicalBeadsLayer
          beads={beads}
          instancedRef={instancedMesh}
          colorsArray={colorsArray}
        />

        {/* Layer 2: Crystal Glass Capsule Shell (renderOrder=2, depthWrite=false) */}
        <CapsuleGlassShell />
      </Float>

      {/* 3D ambient floating micro-sparkles around capsule */}
      <Sparkles
        count={70}
        scale={[6.5, 4.5, 3.0]}
        size={1.6}
        speed={reduced ? 0 : 0.3}
        color="#7ef0ff"
        opacity={0.45}
      />
    </group>
  );
}

// ── Clean Studio Lighting Component ─────────────────────────────
function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[-4, 4, 4]} intensity={2.6} color="#ffffff" />
      <directionalLight position={[4, -2, 3]} intensity={1.8} color="#00f0ff" />
      <directionalLight position={[0, -4, -3]} intensity={1.6} color="#10b981" />
      <pointLight position={[2, 3, 2]} intensity={1.4} color="#eafcff" />
    </>
  );
}

/**
 * Hero WebGL Scene: Free-flowing, independent granular beads inside a
 * crystal-clear transparent capsule with realistic physical collisions,
 * tumbling reaction, and ambient 3D sparkles.
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
