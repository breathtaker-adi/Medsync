"use client";

import { Float } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// ── Dimensions & Calibrated Physics Constants ─────────────────────
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;
// Calibrated to 1000 beads: fills ~42% of the capsule with plenty of space for cascading avalanches
const BEAD_COUNT = 1000;
const BEAD_BASE_RADIUS = 0.046;

interface PhysicalBead {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  radius: number;
  color: THREE.Color;
}

/**
 * Initializes independent, free-floating physical beads in lower ~40% of the capsule.
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

    // Distribute vertically in lower 40% of capsule from y = -1.10 to -0.15
    const y = -1.10 + rand() * 0.95;
    const effR = Math.max(0.02, (CAPSULE_RADIUS - BEAD_BASE_RADIUS - 0.03) * Math.sqrt(rand()));
    const angle = rand() * Math.PI * 2;

    const x = Math.cos(angle) * effR;
    const z = Math.sin(angle) * effR;

    beads.push({
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      prevX: x,
      prevY: y,
      prevZ: z,
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
        roughness={0.16}
        metalness={0.14}
        emissive="#001824"
        emissiveIntensity={0.24}
      />
    </instancedMesh>
  );
}

// ── Crystal Glass Capsule Shell Component (Seamless, No Ring) ────
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
    </group>
  );
}

// ── Dynamic Capsule Rig with Gyroscope Sensor & Position-Based Dynamics ──
function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedMesh = useRef<THREE.InstancedMesh>(null);

  // Full 3D orientation quaternion for unrestricted 360° rotation
  const orientation = useRef(
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.32, -0.28))
  );
  const angularVelocity = useRef(new THREE.Vector2(0, 0));
  const isDragging = useRef(false);
  const pointerPrev = useRef({ x: 0, y: 0 });
  const userDragAccel = useRef(new THREE.Vector3(0, 0, 0));

  // Gyroscopic Sensor State
  const gyro = useRef({
    active: false,
    tiltX: 0,
    tiltZ: 0,
    gravityX: 0,
    gravityY: -18,
    gravityZ: 0,
  });
  const smoothGyroQuat = useRef(new THREE.Quaternion());

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize beads array
  const beads = useMemo(() => initPhysicalBeads(), []);

  // Spatial grid partitioning buffers (12 x 26 x 12 cells, pitch = 0.10)
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

  // ── Phone Gyroscope / DeviceOrientation Sensor Listener ────────
  useEffect(() => {
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null && e.gamma !== null) {
        gyro.current.active = true;

        // beta: front-to-back tilt in degrees (-180 to 180). Typical phone hold is ~45°
        // gamma: left-to-right tilt in degrees (-90 to 90)
        const betaRad = (e.beta * Math.PI) / 180;
        const gammaRad = (e.gamma * Math.PI) / 180;

        // Smooth physical gravity vector driven by phone orientation in world space
        // Holding phone level -> pulls down (-y)
        // Tilting left/right -> pulls along x
        // Tilting forward/back -> pulls along z/y
        gyro.current.gravityX = Math.sin(gammaRad) * 18.0;
        gyro.current.gravityY = -Math.cos(gammaRad) * Math.sin(betaRad) * 18.0;
        gyro.current.gravityZ = -Math.cos(gammaRad) * Math.cos(betaRad) * 18.0;

        // Full 360° gyroscope rotation angles (UNCLAMPED)
        // beta: front-to-back tilt in degrees (-180° to 180°)
        // gamma: left-to-right tilt in degrees (-90° to 90°)
        // Normal phone holding posture is ~50°
        gyro.current.tiltX = ((e.beta - 50) * Math.PI) / 180;
        gyro.current.tiltZ = (e.gamma * Math.PI) / 180;
      }
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });

    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, []);

  // ── Unrestricted 360° Pointer & Touch Drag / Swipe Handlers ────
  useEffect(() => {
    const dom = gl.domElement;
    if (!dom) return;

    const onPointerDown = (e: PointerEvent) => {
      // Allow primary left-click (0), touch, pen, or right-click (2)
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
      isDragging.current = true;
      pointerPrev.current = { x: e.clientX, y: e.clientY };
      angularVelocity.current.set(0, 0);
      dom.style.cursor = "grabbing";
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {}

      // Optional iOS permission request on user interaction
      if (
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === "function"
      ) {
        (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
          .requestPermission()
          .then((response) => {
            if (response === "granted") gyro.current.active = true;
          })
          .catch(() => {});
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - pointerPrev.current.x;
      const dy = e.clientY - pointerPrev.current.y;
      pointerPrev.current = { x: e.clientX, y: e.clientY };

      if (isDragging.current) {
        // Sensitivity: ~0.0075 rad per pixel
        const rotY = dx * 0.0075;
        const rotX = dy * 0.0075;

        // Unrestricted 360° spherical rotation in world space (premultiply)
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
        orientation.current.premultiply(qYaw).premultiply(qPitch);

        // Track angular velocity and drag acceleration for bead inertia
        angularVelocity.current.set(rotX, rotY);
        userDragAccel.current.set(dx * 0.14, -dy * 0.14, 0);
      } else {
        // Free hover / swipe motion (like previously): gently stirs beads without holding
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          userDragAccel.current.x = THREE.MathUtils.lerp(userDragAccel.current.x, dx * 0.06, 0.25);
          userDragAccel.current.y = THREE.MathUtils.lerp(userDragAccel.current.y, -dy * 0.06, 0.25);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      dom.style.cursor = "grab";
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
    };

    // Dedicated touch events to guarantee mobile touch swipe works seamlessly
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        pointerPrev.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        angularVelocity.current.set(0, 0);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - pointerPrev.current.x;
      const dy = e.touches[0].clientY - pointerPrev.current.y;
      pointerPrev.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const rotY = dx * 0.0075;
      const rotX = dy * 0.0075;

      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
      orientation.current.premultiply(qYaw).premultiply(qPitch);

      angularVelocity.current.set(rotX, rotY);
      userDragAccel.current.set(dx * 0.14, -dy * 0.14, 0);
    };

    const onTouchEnd = () => {
      isDragging.current = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevents right click menu on 3D canvas so dragging is seamless
    };

    dom.style.cursor = "grab";
    dom.style.touchAction = "none";
    dom.style.userSelect = "none";
    dom.style.webkitUserSelect = "none";

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    dom.addEventListener("contextmenu", onContextMenu);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl]);

  // ── Physics Simulation Frame Loop ─────────────────────────────
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.033);
    const g = group.current;

    if (g && !reduced) {
      if (!isDragging.current) {
        // Continuous gentle autonomous self-rotation around Y axis (very slow, smooth and hypnotic, like it was previously)
        const qAuto = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          dt * 0.18
        );
        orientation.current.premultiply(qAuto);

        // Smooth rotational inertia with exponential decay from user drag/swipe
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
          angularVelocity.current.multiplyScalar(0.92);
        }

        // Decay user drag acceleration
        userDragAccel.current.multiplyScalar(0.85);
      }

      // Smoothly interpolate full 360° gyroscopic orientation
      if (gyro.current.active) {
        const targetGyro = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(gyro.current.tiltX, 0, -gyro.current.tiltZ, "YXZ")
        );
        smoothGyroQuat.current.slerp(targetGyro, Math.min(1, dt * 6.0));
      } else {
        smoothGyroQuat.current.slerp(new THREE.Quaternion(), Math.min(1, dt * 4.0));
      }

      // Visual orientation = base orientation * smooth gyroscopic tilt
      const visualQuat = orientation.current.clone().multiply(smoothGyroQuat.current);
      g.quaternion.copy(visualQuat);
    }

    // ── Position-Based Granular Dynamics (PBD) Simulation ─────────
    const mesh = instancedMesh.current;
    if (mesh && g) {
      // Base world gravity: if phone gyro is active, uses physical device orientation;
      // otherwise, uses standard earth gravity (0, -18, 0)
      const baseGx = gyro.current.active ? gyro.current.gravityX : 0;
      const baseGy = gyro.current.active ? gyro.current.gravityY : -18.0;
      const baseGz = gyro.current.active ? gyro.current.gravityZ : 0;

      const worldGravity = new THREE.Vector3(
        baseGx + userDragAccel.current.x * 0.7,
        baseGy + userDragAccel.current.y * 0.7,
        baseGz
      );

      // Transform world gravity into capsule's local frame:
      // When capsule inverts 180° upside-down, local gravity inverts to +y!
      // When tilted 90°, local gravity pulls along x/z!
      const invOrientation = g.quaternion.clone().invert();
      const localGravity = worldGravity.applyQuaternion(invOrientation);

      const gx = localGravity.x;
      const gy = localGravity.y;
      const gz = localGravity.z;

      // 3 sub-steps per frame
      const subSteps = 3;
      const subDt = dt / subSteps;
      const N = beads.length;

      for (let s = 0; s < subSteps; s++) {
        // 1. Integration & Candidate Position Projection
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          b.prevX = b.x;
          b.prevY = b.y;
          b.prevZ = b.z;

          // Apply gravity
          b.vx += gx * subDt;
          b.vy += gy * subDt;
          b.vz += gz * subDt;

          // Air damping
          b.vx *= 0.986;
          b.vy *= 0.986;
          b.vz *= 0.986;

          // Predict candidate position
          b.x += b.vx * subDt;
          b.y += b.vy * subDt;
          b.z += b.vz * subDt;
        }

        // 2. Spatial Grid Indexing (12 x 26 x 12 cells)
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

        // 3. PBD Hard-Sphere Non-Penetration Constraint (2 Relaxation Iterations)
        // Guarantees beads CANNOT get inside each other!
        for (let iter = 0; iter < 2; iter++) {
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
                      const dx = bi.x - bj.x;
                      const dy = bi.y - bj.y;
                      const dz = bi.z - bj.z;
                      const minDist = bi.radius + bj.radius;

                      if (Math.abs(dx) < minDist && Math.abs(dy) < minDist && Math.abs(dz) < minDist) {
                        const distSq = dx * dx + dy * dy + dz * dz;
                        if (distSq < minDist * minDist && distSq > 0.000001) {
                          const dist = Math.sqrt(distSq);
                          const overlap = minDist - dist;
                          const nx = dx / dist;
                          const ny = dy / dist;
                          const nz = dz / dist;

                          // 100% hard positional projection (neither bead penetrates)
                          const sep = overlap * 0.5;
                          bi.x += nx * sep;
                          bi.y += ny * sep;
                          bi.z += nz * sep;

                          bj.x -= nx * sep;
                          bj.y -= ny * sep;
                          bj.z -= nz * sep;

                          // Granular shear friction between beads
                          const relVx = bi.vx - bj.vx;
                          const relVy = bi.vy - bj.vy;
                          const relVz = bi.vz - bj.vz;
                          const normV = relVx * nx + relVy * ny + relVz * nz;
                          const tangVx = relVx - normV * nx;
                          const tangVy = relVy - normV * ny;
                          const tangVz = relVz - normV * nz;

                          bi.vx -= tangVx * 0.12;
                          bi.vy -= tangVy * 0.12;
                          bi.vz -= tangVz * 0.12;

                          bj.vx += tangVx * 0.12;
                          bj.vy += tangVy * 0.12;
                          bj.vz += tangVz * 0.12;
                        }
                      }
                    }
                    j = gridNext[j];
                  }
                }
              }
            }
          }
        }

        // 4. Capsule Glass Wall Geometric Boundary Projection (Seamless & Symmetrical)
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          const effR = CAPSULE_RADIUS - b.radius;

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
                b.vx -= (1 + 0.20) * vDotN * nx;
                b.vy -= (1 + 0.20) * vDotN * ny;
                b.vz -= (1 + 0.20) * vDotN * nz;
              }
              // Wall roll friction
              b.vx *= 0.84;
              b.vy *= 0.84;
              b.vz *= 0.84;
            }
          } else if (b.y > CYLINDER_HALF_HEIGHT) {
            // Top hemisphere dome (supports upside-down tumbling)
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
                b.vx -= (1 + 0.20) * vDotN * nx;
                b.vy -= (1 + 0.20) * vDotN * ny;
                b.vz -= (1 + 0.20) * vDotN * nz;
              }
              b.vx *= 0.84;
              b.vy *= 0.84;
              b.vz *= 0.84;
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
                b.vx -= (1 + 0.20) * vDotN * nx;
                b.vz -= (1 + 0.20) * vDotN * nz;
              }
              b.vy *= 0.86;
              b.vx *= 0.86;
              b.vz *= 0.86;
            }
          }
        }

        // 5. Update Velocity from Position Changes & Rest Stabilization
        // Eliminates internal jitter/churning when settled
        for (let i = 0; i < N; i++) {
          const b = beads[i];
          b.vx = (b.x - b.prevX) / subDt;
          b.vy = (b.y - b.prevY) / subDt;
          b.vz = (b.z - b.prevZ) / subDt;

          const vSq = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
          if (vSq < 0.0005) {
            b.vx = 0;
            b.vy = 0;
            b.vz = 0;
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

        {/* Layer 2: Seamless Crystal Glass Capsule Shell (renderOrder=2) */}
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
 * seamless transparent capsule with gyroscopic mobile sensor tracking,
 * unrestricted 360° drag rotation, PBD hard-sphere non-penetration physics,
 * and stable resting settlement.
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
