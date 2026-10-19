"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

interface Bead {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
}

const BEAD_COUNT = 380;
const CAPSULE_RADIUS = 0.54;
const CYLINDER_HALF_HEIGHT = 0.68;

function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const instancedBeads = useRef<THREE.InstancedMesh>(null);

  const tilt = useRef({ x: 0.16, z: -0.36 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const impulse = useRef({ x: 0, y: 0, z: 0 });
  const timeRef = useRef(0);

  // Initialize beads concentrated in the lower hemisphere & bottom half of the capsule
  const beads = useMemo<Bead[]>(() => {
    const list: Bead[] = [];
    for (let i = 0; i < BEAD_COUNT; i++) {
      // Distribute beads inside lower capsule volume (y from -1.15 to +0.1)
      const rRatio = Math.cbrt(Math.random());
      const maxR = (CAPSULE_RADIUS - 0.055) * rRatio;
      const angle = Math.random() * Math.PI * 2;
      const y = -1.12 + Math.random() * 1.15; // partially filled lower-to-mid section
      list.push({
        x: Math.cos(angle) * maxR,
        y,
        z: Math.sin(angle) * maxR,
        vx: (Math.random() - 0.5) * 0.008,
        vy: (Math.random() - 0.5) * 0.008,
        vz: (Math.random() - 0.5) * 0.008,
        radius: 0.036 + (i % 5 === 0 ? 0.008 : (i % 3 === 0 ? -0.006 : 0)),
      });
    }
    return list;
  }, []);

  // Palette matching Image 2 in brand colors:
  // Cyan (#00F0FF), Mint Green (#10B981), Royal Blue (#2563EB), Crisp White (#FFFFFF)
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const colArray = new Float32Array(BEAD_COUNT * 3);
    const colorCyan = new THREE.Color("#00F0FF");
    const colorMint = new THREE.Color("#10B981");
    const colorBlue = new THREE.Color("#2563EB");
    const colorWhite = new THREE.Color("#FFFFFF");

    for (let i = 0; i < BEAD_COUNT; i++) {
      const roll = Math.random();
      let chosen: THREE.Color;
      if (roll < 0.35) {
        chosen = colorCyan;
      } else if (roll < 0.65) {
        chosen = colorMint;
      } else if (roll < 0.85) {
        chosen = colorBlue;
      } else {
        chosen = colorWhite;
      }

      colArray[i * 3] = chosen.r;
      colArray[i * 3 + 1] = chosen.g;
      colArray[i * 3 + 2] = chosen.b;
    }
    return colArray;
  }, []);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.05);
    timeRef.current += safeDelta;
    const t = timeRef.current;
    const g = group.current;

    // Pointer velocity delta for reactive physical inertia
    const pX = state.pointer.x;
    const pY = state.pointer.y;
    const dX = pX - pointerPrev.current.x;
    const dY = pY - pointerPrev.current.y;
    pointerPrev.current = { x: pX, y: pY };

    if (g && !reduced) {
      // Smooth continuous gentle idle roll + mouse tilt
      g.rotation.y += safeDelta * 0.16;
      const targetX = 0.18 + pY * -0.26;
      const targetZ = -0.36 + pX * 0.24 + Math.sin(t * 0.6) * 0.04;
      tilt.current.x = THREE.MathUtils.lerp(tilt.current.x, targetX, 0.06);
      tilt.current.z = THREE.MathUtils.lerp(tilt.current.z, targetZ, 0.06);
      g.rotation.x = tilt.current.x;
      g.rotation.z = tilt.current.z;

      // Cursor movement impulse transmitted to inner beads
      impulse.current.x = THREE.MathUtils.lerp(impulse.current.x, dX * 18, 0.12);
      impulse.current.y = THREE.MathUtils.lerp(impulse.current.y, -dY * 18, 0.12);
    }

    // ── Solid Bead Physics Step ──
    const mesh = instancedBeads.current;
    if (mesh) {
      const curRotX = g ? g.rotation.x : 0;
      const curRotZ = g ? g.rotation.z : 0;

      // Downward gravity mapped into local capsule frame
      const gravityMagnitude = 3.8;
      const gravY = -gravityMagnitude * Math.cos(curRotX) * Math.cos(curRotZ);
      const gravX = -gravityMagnitude * Math.sin(curRotZ) + impulse.current.x;
      const gravZ = gravityMagnitude * Math.sin(curRotX);

      for (let i = 0; i < BEAD_COUNT; i++) {
        const b = beads[i];

        // Apply local gravity
        b.vx += gravX * safeDelta;
        b.vy += gravY * safeDelta;
        b.vz += gravZ * safeDelta;

        // Bead air/friction damping
        b.vx *= 0.94;
        b.vy *= 0.94;
        b.vz *= 0.94;

        // Subtle micro-jostle so beads don't stack unnaturally
        b.vx += (Math.random() - 0.5) * 0.0015;
        b.vz += (Math.random() - 0.5) * 0.0015;

        // Integrate position
        b.x += b.vx * safeDelta * 60;
        b.y += b.vy * safeDelta * 60;
        b.z += b.vz * safeDelta * 60;

        // Capsule boundary collision
        const effR = CAPSULE_RADIUS - b.radius;

        if (b.y < -CYLINDER_HALF_HEIGHT) {
          // Bottom spherical endcap
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

            // Restitution bounce
            const dot = b.vx * nx + b.vy * ny + b.vz * nz;
            b.vx = (b.vx - 1.4 * dot * nx) * 0.55;
            b.vy = (b.vy - 1.4 * dot * ny) * 0.55;
            b.vz = (b.vz - 1.4 * dot * nz) * 0.55;
          }
        } else if (b.y > CYLINDER_HALF_HEIGHT) {
          // Top spherical endcap
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

            const dot = b.vx * nx + b.vy * ny + b.vz * nz;
            b.vx = (b.vx - 1.4 * dot * nx) * 0.55;
            b.vy = (b.vy - 1.4 * dot * ny) * 0.55;
            b.vz = (b.vz - 1.4 * dot * nz) * 0.55;
          }
        } else {
          // Cylindrical side wall
          const rCyl = Math.hypot(b.x, b.z);
          if (rCyl > effR && rCyl > 0.0001) {
            const nx = b.x / rCyl;
            const nz = b.z / rCyl;
            b.x = nx * effR;
            b.z = nz * effR;

            const dot = b.vx * nx + b.vz * nz;
            b.vx = (b.vx - 1.4 * dot * nx) * 0.55;
            b.vz = (b.vz - 1.4 * dot * nz) * 0.55;
          }
        }

        // Update 3D instance matrix
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
        rotationIntensity={reduced ? 0 : 0.15}
        floatIntensity={reduced ? 0 : 0.55}
      >
        {/* Crystal Clear Glass Capsule Shell */}
        <mesh>
          <capsuleGeometry args={[0.6, 1.35, 32, 64]} />
          <meshPhysicalMaterial
            transmission={0.98}
            thickness={0.85}
            roughness={0.03}
            ior={1.48}
            clearcoat={1}
            clearcoatRoughness={0.04}
            color="#ffffff"
            attenuationColor="#00f0ff"
            attenuationDistance={4.5}
            envMapIntensity={2.0}
            specularIntensity={1.3}
            transparent
            opacity={0.98}
          />
        </mesh>

        {/* Precision Center Joint Ring */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.603, 0.009, 16, 64]} />
          <meshStandardMaterial
            color="#00f0ff"
            metalness={0.9}
            roughness={0.12}
            emissive="#00b4cc"
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* Isolated Brand-Colored Solid Spherical Beads */}
        <instancedMesh
          ref={instancedBeads}
          args={[undefined, undefined, BEAD_COUNT]}
        >
          <sphereGeometry args={[1, 16, 16]}>
            <instancedBufferAttribute
              attach="attributes-color"
              args={[colors, 3]}
            />
          </sphereGeometry>
          <meshStandardMaterial
            vertexColors
            roughness={0.24}
            metalness={0.28}
            emissive="#002d38"
            emissiveIntensity={0.18}
          />
        </instancedMesh>
      </Float>

      {/* Floating subtle ambient micro-sparkles */}
      <Sparkles
        count={50}
        scale={[4.2, 2.8, 2.2]}
        size={1.4}
        speed={reduced ? 0 : 0.25}
        color="#7ef0ff"
        opacity={0.4}
      />
    </group>
  );
}

/**
 * Hero WebGL scene: crystal-clear transparent capsule filled with individual,
 * solid brand-colored beads with authentic tumbling physics, blending seamlessly
 * with the hero page.
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
        <Lightformer form="rect" intensity={3.5} color="#00f0ff" position={[-4, 2, 3]} scale={[5, 3]} />
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[3, 1, 4]} scale={[4, 2]} />
        <Lightformer form="rect" intensity={2.6} color="#10b981" position={[-2, -3, -3]} scale={[4, 4]} />
        <Lightformer form="ring" intensity={2.0} color="#9ffcf4" position={[3, -2, -2]} scale={2.5} />
      </Environment>
    </Canvas>
  );
}

