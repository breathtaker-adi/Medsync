"use client";

import { Float } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// ── Dimensions & Physics Constants ──────────────────────────────
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;
const BEAD_COUNT = 1800;
const BEAD_BASE_RADIUS = 0.048;

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
 * Initializes independent, free-floating physical beads filling ~55% of the capsule.
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

    // Distribute vertically in lower 55% of capsule from y = -1.14 to +0.10
    const y = -1.14 + rand() * 1.24;
    const effR = Math.max(0.02, (CAPSULE_RADIUS - BEAD_BASE_RADIUS - 0.02) * Math.sqrt(rand()));
    const angle = rand() * Math.PI * 2;

    beads.push({
      x: Math.cos(angle) * effR,
      y,
      z: Math.sin(angle) * effR,
      vx: (rand() - 0.5) * 0.002,
      vy: (rand() - 0.5) * 0.002,
      vz: (rand() - 0.5) * 0.002,
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
        roughness={0.18}
        metalness={0.16}
        emissive="#001824"
        emissiveIntensity={0.25}
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
        <capsuleGeometry args={[CAPSULE_RADIUS + 0.008, CYLINDER_HALF_HEIGHT * 2, 32, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.30}
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
          opacity={0.22}
          roughness={0.025}
          metalness={0.08}
          clearcoat={1.0}
          clearcoatRoughness={0.02}
          ior={1.52}
          specularIntensity={3.2}
          specularColor="#ffffff"
          emissive="#002b3d"
          emissiveIntensity={0.22}
          depthWrite={false}
        />
      </mesh>

      {/* Layer 3: Central Pharmaceutical Capsule Seam Band */}
      <mesh position={[0, 0, 0]} renderOrder={3}>
        <torusGeometry args={[CAPSULE_RADIUS + 0.003, 0.007, 16, 64]} />
        <meshStandardMaterial
          color="#00f0ff"
          transparent
          opacity={0.65}
          roughness={0.1}
          metalness={0.8}
          emissive="#00f0ff"
          emissiveIntensity={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Dynamic Capsule Rig with Unrestricted 360° Drag & True Granular Physics ──
function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedMesh = useRef<THREE.InstancedMesh>(null);

  // Full 3D orientation quaternion for unrestricted 360° rotation in all directions
  const orientation = useRef(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.32, -0.28))
  );
  const angularVelocity = useRef(new THREE.Vector2(0, 0));
  const isDragging = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const userDragAccel = useRef(new THREE.Vector3(0, 0, 0));

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize beads array
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

  const { gl, viewport } = useThree();
  const responsiveScale = Math.min(1.04, Math.max(0.78, viewport.width / 4.8));

  // ── Unrestricted 360° Pointer & Touch Drag Handlers ───────────
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      pointerStart.current = { x: e.clientX, y: e.clientY };
      pointerPrev.current = { x: e.clientX, y: e.clientY };
      angularVelocity.current.set(0, 0);
      dom.style.cursor = "grabbing";
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - pointerPrev.current.x;
      const dy = e.clientY - pointerPrev.current.y;
      pointerPrev.current = { x: e.clientX, y: e.clientY };

      // Sensitivity: ~0.007 rad per pixel
      const rotY = dx * 0.007;
      const rotX = dy * 0.007;

      // Unrestricted 360° spherical rotation in world space (premultiply)
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
      orientation.current.premultiply(qYaw).premultiply(qPitch);

      // Track angular velocity and drag acceleration for bead inertia
      angularVelocity.current.set(rotX, rotY);
      userDragAccel.current.set(dx * 0.15, -dy * 0.15, 0);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      dom.style.cursor = "grab";
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
    };

    dom.style.cursor = "grab";
    dom.style.touchAction = "none";
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl]);

  // ── Physics Simulation Frame Loop ─────────────────────────────
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.033);
    const g = group.current;

    if (g && !reduced) {
      if (!isDragging.current) {
        // Smooth rotational inertia with exponential decay
        if (angularVelocity.current.lengthSq() > 0.000001) {
          const qPitch = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            angularVelocity.current.x
          );
          const qYaw = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            angularVelocity.current.y
          );
          orientation.current.premultiply(qYaw).premultiply(qPitch);
          angularVelocity.current.multiplyScalar(0.94);
        } else {
          // Living ambient spin: gentle 360° yaw spin around vertical axis
          const qAuto = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            dt * 0.22
          );
          orientation.current.premultiply(qAuto);
        }

        // Decay user drag acceleration
        userDragAccel.current.multiplyScalar(0.85);
      }

      g.quaternion.copy(orientation.current);
    }

    // ── Free Particle Granular Physics Step ───────────────────────
    const mesh = instancedMesh.current;
    if (mesh && g) {
      // World gravity always pulls straight down toward earth: (0, -20.0, 0)
      const worldGravity = new THREE.Vector3(
        userDragAccel.current.x * 0.8,
        -20.0 + userDragAccel.current.y * 0.8,
        0
      );

      // Transform world gravity into capsule's local coordinate system:
      // When capsule inverts upside-down (180°), local gravity inverts to +y!
      // When capsule tilts sideways (90°), local gravity points along x/z!
      const invOrientation = orientation.current.clone().invert();
      const localGravity = worldGravity.applyQuaternion(invOrientation);

      const gx = localGravity.x;
      const gy = localGravity.y;
      const gz = localGravity.z;

      // 3 sub-steps per frame for rock-solid stability and realistic granular pile formation
      const subSteps = 3;
      const subDt = dt / subSteps;
      const N = beads.length;

      for (let s = 0; s < subSteps; s++) {
        // 1. Velocity & Position Integration with natural air friction
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          b.vx += gx * subDt;
          b.vy += gy * subDt;
          b.vz += gz * subDt;

          // Air damping
          b.vx *= 0.985;
          b.vy *= 0.985;
          b.vz *= 0.985;

          b.x += b.vx * subDt;
          b.y += b.vy * subDt;
          b.z += b.vz * subDt;
        }

        // 2. Spatial Grid Indexing (12 x 26 x 12 cells, width = 0.10)
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

        // 3. Inter-bead Collisions with Elastic Rebound & Granular Shear Friction
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

                            // Full geometric separation
                            const sep = overlap * 0.5;
                            bi.x += nx * sep;
                            bi.y += ny * sep;
                            bi.z += nz * sep;

                            bj.x -= nx * sep;
                            bj.y -= ny * sep;
                            bj.z -= nz * sep;

                            // Collision impulse with realistic restitution
                            const relVx = bi.vx - bj.vx;
                            const relVy = bi.vy - bj.vy;
                            const relVz = bi.vz - bj.vz;
                            const normalVel = relVx * nx + relVy * ny + relVz * nz;

                            if (normalVel < 0) {
                              const restitution = 0.28;
                              const impulse = -(1 + restitution) * normalVel * 0.5;
                              bi.vx += nx * impulse;
                              bi.vy += ny * impulse;
                              bi.vz += nz * impulse;

                              bj.vx -= nx * impulse;
                              bj.vy -= ny * impulse;
                              bj.vz -= nz * impulse;

                              // Granular shear friction (creates realistic angle of repose and bead tumbling)
                              const tangVx = relVx - normalVel * nx;
                              const tangVy = relVy - normalVel * ny;
                              const tangVz = relVz - normalVel * nz;
                              const fCoeff = 0.16;

                              bi.vx -= tangVx * fCoeff;
                              bi.vy -= tangVy * fCoeff;
                              bi.vz -= tangVz * fCoeff;

                              bj.vx += tangVx * fCoeff;
                              bj.vy += tangVy * fCoeff;
                              bj.vz += tangVz * fCoeff;
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

        // 4. Symmetrical Glass Capsule Boundary Containment (Full 360° Support)
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          const effR = CAPSULE_RADIUS - b.radius - 0.002;

          if (b.y < -CYLINDER_HALF_HEIGHT) {
            // Bottom hemisphere dome
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
                b.vx -= (1 + 0.25) * vDotN * nx;
                b.vy -= (1 + 0.25) * vDotN * ny;
                b.vz -= (1 + 0.25) * vDotN * nz;
              }
              // Wall roll friction
              b.vx *= 0.82;
              b.vy *= 0.82;
              b.vz *= 0.82;
            }
          } else if (b.y > CYLINDER_HALF_HEIGHT) {
            // Top hemisphere dome (supports upside-down 180° rotation!)
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
                b.vx -= (1 + 0.25) * vDotN * nx;
                b.vy -= (1 + 0.25) * vDotN * ny;
                b.vz -= (1 + 0.25) * vDotN * nz;
              }
              // Wall roll friction
              b.vx *= 0.82;
              b.vy *= 0.82;
              b.vz *= 0.82;
            }
          } else {
            // Cylindrical body
            const rCyl = Math.hypot(b.x, b.z);
            if (rCyl > effR && rCyl > 0.0001) {
              const nx = b.x / rCyl;
              const nz = b.z / rCyl;
              b.x = nx * effR;
              b.z = nz * effR;

              const vDotN = b.vx * nx + b.vz * nz;
              if (vDotN > 0) {
                b.vx -= (1 + 0.25) * vDotN * nx;
                b.vz -= (1 + 0.25) * vDotN * nz;
              }
              // Wall roll friction along cylinder axis
              b.vy *= 0.85;
              b.vx *= 0.85;
              b.vz *= 0.85;
            }
          }
        }

        // 5. Rest threshold: calm down fully settled beads to eliminate jitter
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          const vSq = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
          if (vSq < 0.0004) {
            b.vx *= 0.7;
            b.vy *= 0.7;
            b.vz *= 0.7;
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
    <group ref={group} scale={responsiveScale}>
      <Float
        speed={reduced ? 0 : 1.4}
        rotationIntensity={reduced ? 0 : 0.08}
        floatIntensity={reduced ? 0 : 0.35}
      >
        {/* Layer 1: Free Physical Beads (renderOrder=1) */}
        <PhysicalBeadsLayer
          beads={beads}
          instancedRef={instancedMesh}
          colorsArray={colorsArray}
        />

        {/* Layer 2: Crystal Glass Capsule Shell with Luminous Silhouette Rim & Center Seam */}
        <CapsuleGlassShell />
      </Float>
    </group>
  );
}

// ── Clean Studio Lighting Component ─────────────────────────────
function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[-4, 4, 4]} intensity={2.8} color="#ffffff" />
      <directionalLight position={[4, -2, 3]} intensity={1.8} color="#00f0ff" />
      <directionalLight position={[0, -4, -3]} intensity={1.6} color="#10b981" />
      <pointLight position={[2, 3, 2]} intensity={1.5} color="#eafcff" />
    </>
  );
}

/**
 * Hero WebGL Scene: Free-flowing, independent granular beads inside a
 * crystal-clear transparent capsule with unrestricted 360° interactive rotation,
 * realistic granular physics, cascading avalanches, and ambient 3D sparkles.
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
