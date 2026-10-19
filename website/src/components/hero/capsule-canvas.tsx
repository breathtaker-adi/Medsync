"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// ── Dimensions & Physics Constants ──────────────────────────────
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;
const BEAD_COUNT = 2000;
const BEAD_BASE_RADIUS = 0.050;

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
 * Initializes independent, free-floating physical beads filling up to ~60% of the capsule.
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

    // Distribute vertically in lower 60% of capsule from y = -1.14 to +0.24 (60% fill)
    const y = -1.14 + rand() * 1.38;
    const effR = Math.max(0.02, (CAPSULE_RADIUS - BEAD_BASE_RADIUS - 0.02) * Math.sqrt(rand()));
    const angle = rand() * Math.PI * 2;

    beads.push({
      x: Math.cos(angle) * effR,
      y,
      z: Math.sin(angle) * effR,
      vx: (rand() - 0.5) * 0.005,
      vy: (rand() - 0.5) * 0.005,
      vz: (rand() - 0.5) * 0.005,
      radius: BEAD_BASE_RADIUS * (0.94 + rand() * 0.12),
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
      <sphereGeometry args={[1, 14, 14]}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colorsArray, 3]}
        />
      </sphereGeometry>
      <meshStandardMaterial
        vertexColors
        roughness={0.2}
        metalness={0.24}
        emissive="#001824"
        emissiveIntensity={0.26}
      />
    </instancedMesh>
  );
}

// ── Crystal Glass Capsule Shell Component ───────────────────────
function CapsuleGlassShell() {
  return (
    <group renderOrder={2}>
      {/* Layer 1: Luminous Outer Silhouette Contour (Inverted Hull) */}
      <mesh renderOrder={4}>
        <capsuleGeometry args={[CAPSULE_RADIUS + 0.007, CYLINDER_HALF_HEIGHT * 2, 32, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.32}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Layer 2: Crystal Tinted Bio-Glass Shell with Specular Luster */}
      <mesh renderOrder={3}>
        <capsuleGeometry args={[CAPSULE_RADIUS, CYLINDER_HALF_HEIGHT * 2, 32, 64]} />
        <meshPhysicalMaterial
          color="#00f0ff"
          transparent
          opacity={0.2}
          roughness={0.03}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.02}
          ior={1.52}
          specularIntensity={3.0}
          specularColor="#ffffff"
          emissive="#002b3d"
          emissiveIntensity={0.24}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Dynamic Capsule Rig with Fast Spatial-Grid Granular Physics ──
function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedMesh = useRef<THREE.InstancedMesh>(null);

  const tilt = useRef({ x: 0.16, z: -0.36 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const mouseImpulse = useRef({ x: 0, y: 0 });

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize beads array with their own independent state
  const beads = useMemo(() => initPhysicalBeads(), []);

  // Spatial grid partitioning buffers (12 x 26 x 12 cells)
  const gridHead = useMemo(() => new Int32Array(3744), []);
  const gridNext = useMemo(() => new Int32Array(BEAD_COUNT), []);

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

  const { viewport } = useThree();
  const responsiveScale = Math.min(1.04, Math.max(0.78, viewport.width / 4.8));

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
      // Autonomous smooth spin & cursor tilt with ultra-high responsiveness
      g.rotation.y += dt * 0.22;
      const targetX = 0.22 + pY * -0.52;
      const targetZ = -0.38 + pX * 0.48;
      tilt.current.x = THREE.MathUtils.lerp(tilt.current.x, targetX, 0.18);
      tilt.current.z = THREE.MathUtils.lerp(tilt.current.z, targetZ, 0.18);
      g.rotation.x = tilt.current.x;
      g.rotation.z = tilt.current.z;

      mouseImpulse.current.x = THREE.MathUtils.lerp(mouseImpulse.current.x, dX * 14, 0.16);
      mouseImpulse.current.y = THREE.MathUtils.lerp(mouseImpulse.current.y, -dY * 14, 0.16);
    }

    // ── Free Particle Physics Step with Fast Spatial Grid Collisions ──
    const mesh = instancedMesh.current;
    if (mesh) {
      const rotX = g ? g.rotation.x : 0;
      const rotZ = g ? g.rotation.z : 0;

      // 2 sub-steps per frame for rock-solid stability and crisp collisions
      const subSteps = 2;
      const subDt = dt / subSteps;

      // Local gravity vector inside rotating capsule frame
      const gx = -13.0 * Math.sin(rotZ) + mouseImpulse.current.x;
      const gy = -13.0 * Math.cos(rotX) * Math.cos(rotZ);
      const gz = 13.0 * Math.sin(rotX) + mouseImpulse.current.y;

      const N = beads.length;

      for (let s = 0; s < subSteps; s++) {
        // 1. Apply gravity, inertia, and position integration (heavy damping, very low kinetic energy)
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          b.vx += gx * subDt;
          b.vy += gy * subDt;
          b.vz += gz * subDt;

          // Rolling and air friction - heavily damped, low kinetic energy
          b.vx *= 0.92;
          b.vy *= 0.92;
          b.vz *= 0.92;

          // Integrate position
          b.x += b.vx * subDt;
          b.y += b.vy * subDt;
          b.z += b.vz * subDt;
        }

        // 2. Build spatial grid index
        gridHead.fill(-1);
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          const cx = Math.max(0, Math.min(11, Math.floor((b.x + 0.6) * 10)));
          const cy = Math.max(0, Math.min(25, Math.floor((b.y + 1.3) * 10)));
          const cz = Math.max(0, Math.min(11, Math.floor((b.z + 0.6) * 10)));
          const cell = cx + cy * 12 + cz * 312;
          gridNext[i] = gridHead[cell];
          gridHead[cell] = i;
        }

        // 3. Resolve inter-bead collisions via spatial grid
        for (let i = 0; i < N; i++) {
          const bi = beads[i];
          const cx = Math.max(0, Math.min(11, Math.floor((bi.x + 0.6) * 10)));
          const cy = Math.max(0, Math.min(25, Math.floor((bi.y + 1.3) * 10)));
          const cz = Math.max(0, Math.min(11, Math.floor((bi.z + 0.6) * 10)));

          for (let ox = -1; ox <= 1; ox++) {
            const ncx = cx + ox;
            if (ncx < 0 || ncx >= 12) continue;
            for (let oy = -1; oy <= 1; oy++) {
              const ncy = cy + oy;
              if (ncy < 0 || ncy >= 26) continue;
              for (let oz = -1; oz <= 1; oz++) {
                const ncz = cz + oz;
                if (ncz < 0 || ncz >= 12) continue;

                let j = gridHead[ncx + ncy * 12 + ncz * 312];
                while (j !== -1) {
                  if (j > i) {
                    const bj = beads[j];
                    const dy = bi.y - bj.y;
                    const minDist = bi.radius + bj.radius;

                    if (Math.abs(dy) < minDist) {
                      const dx = bi.x - bj.x;
                      if (Math.abs(dx) < minDist) {
                        const dz = bi.z - bj.z;
                        if (Math.abs(dz) < minDist) {
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
                              const impulse = -0.25 * normalVel * 0.5;
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
                  }
                  j = gridNext[j];
                }
              }
            }
          }
        }

        // 4. FINAL RIGOROUS WALL CONTAINMENT CLAMP (Executed AFTER inter-bead relaxation)
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          const effR = CAPSULE_RADIUS - b.radius - 0.002;
          if (b.y < -CYLINDER_HALF_HEIGHT) {
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
                b.vx = (b.vx - 1.2 * vDotN * nx) * 0.18;
                b.vy = (b.vy - 1.2 * vDotN * ny) * 0.18;
                b.vz = (b.vz - 1.2 * vDotN * nz) * 0.18;
              }
            }
          } else if (b.y > CYLINDER_HALF_HEIGHT) {
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
                b.vx = (b.vx - 1.2 * vDotN * nx) * 0.18;
                b.vy = (b.vy - 1.2 * vDotN * ny) * 0.18;
                b.vz = (b.vz - 1.2 * vDotN * nz) * 0.18;
              }
            }
          } else {
            const rCyl = Math.hypot(b.x, b.z);
            if (rCyl > effR && rCyl > 0.0001) {
              const nx = b.x / rCyl;
              const nz = b.z / rCyl;
              b.x = nx * effR;
              b.z = nz * effR;

              const vDotN = b.vx * nx + b.vz * nz;
              if (vDotN > 0) {
                b.vx = (b.vx - 1.2 * vDotN * nx) * 0.18;
                b.vz = (b.vz - 1.2 * vDotN * nz) * 0.18;
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
    <group ref={group} scale={responsiveScale} rotation={[0.18, -0.28, -0.36]}>
      <Float
        speed={reduced ? 0 : 1.7}
        rotationIntensity={reduced ? 0 : 0.16}
        floatIntensity={reduced ? 0 : 0.55}
      >
        {/* Layer 1: Free Physical Beads (renderOrder=1) */}
        <PhysicalBeadsLayer
          beads={beads}
          instancedRef={instancedMesh}
          colorsArray={colorsArray}
        />

        {/* Layer 2: Crystal Glass Capsule Shell with Luminous Silhouette Rim */}
        <CapsuleGlassShell />
      </Float>
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
