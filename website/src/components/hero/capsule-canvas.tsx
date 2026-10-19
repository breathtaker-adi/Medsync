"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseRadius: number;
  scale: number;
}

const PARTICLE_COUNT = 190;
const INNER_RADIUS = 0.51;
const CYLINDER_HALF_HEIGHT = 0.675;
const FLUID_FILL_LEVEL = -0.05; // Rest height of fluid in capsule (partially filled)

function CapsuleRig({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const fluidMesh = useRef<THREE.Mesh>(null);
  const instancedParticles = useRef<THREE.InstancedMesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);

  const tilt = useRef({ x: 0.12, y: -0.25 });
  const pointerPrev = useRef({ x: 0, y: 0 });
  const sloshAngle = useRef({ x: 0, z: 0 });
  const timeRef = useRef(0);

  // Initialize particle array inside lower capsule volume
  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // spawn mostly in the lower half of the capsule (fluid zone)
      const r = Math.pow(Math.random(), 0.75) * (INNER_RADIUS - 0.08);
      const theta = Math.random() * Math.PI * 2;
      // y distributed from bottom pole (-1.15) up to fluid level (-0.05)
      const y = -1.1 + Math.random() * 1.05;
      arr.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.01,
        vz: (Math.random() - 0.5) * 0.01,
        baseRadius: 0.032 + Math.random() * 0.024,
        scale: 0.8 + Math.random() * 0.4,
      });
    }
    return arr;
  }, []);

  // Set per-instance particle colors (cyan to mint green to crystal white)
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const colArray = new Float32Array(PARTICLE_COUNT * 3);
    const c1 = new THREE.Color("#00F0FF");
    const c2 = new THREE.Color("#34D399");
    const c3 = new THREE.Color("#E0FCFF");
    const temp = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ratio = Math.random();
      if (ratio < 0.5) {
        temp.copy(c1).lerp(c2, ratio * 2);
      } else {
        temp.copy(c2).lerp(c3, (ratio - 0.5) * 2);
      }
      colArray[i * 3] = temp.r;
      colArray[i * 3 + 1] = temp.g;
      colArray[i * 3 + 2] = temp.b;
    }
    return colArray;
  }, []);

  // Soft cyan radial backdrop texture
  const glowTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(0,240,255,0.45)");
    g.addColorStop(0.4, "rgba(0,240,255,0.14)");
    g.addColorStop(1, "rgba(0,240,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state, delta) => {
    const safeDelta = Math.min(delta, 0.08);
    timeRef.current += safeDelta;
    const t = timeRef.current;
    const g = group.current;

    // Pointer delta for fluid slosh impulse
    const pX = state.pointer.x;
    const pY = state.pointer.y;
    const dX = pX - pointerPrev.current.x;
    const dY = pY - pointerPrev.current.y;
    pointerPrev.current = { x: pX, y: pY };

    if (g && !reduced) {
      // Smooth autonomous spin + cursor parallax
      g.rotation.y += safeDelta * 0.14;
      const targetX = 0.16 + pY * -0.24;
      const targetZ = -0.38 + pX * 0.22 + Math.sin(t * 0.5) * 0.05;
      tilt.current.x = THREE.MathUtils.lerp(tilt.current.x, targetX, 0.045);
      g.rotation.x = tilt.current.x;
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, targetZ, 0.045);

      // Slosh reaction based on movement impulses
      sloshAngle.current.x = THREE.MathUtils.lerp(sloshAngle.current.x, -dY * 2.5 + Math.sin(t * 2.2) * 0.06, 0.08);
      sloshAngle.current.z = THREE.MathUtils.lerp(sloshAngle.current.z, dX * 2.5 + Math.cos(t * 2.2) * 0.06, 0.08);
    }

    // ── Particle & Fluid Physics Step ──
    const mesh = instancedParticles.current;
    if (mesh) {
      // Effective local gravity vector (tilted with capsule)
      const curRotX = g ? g.rotation.x : 0;
      const curRotZ = g ? g.rotation.z : 0;

      // Downward gravity in local space:
      const gravY = -2.8 * Math.cos(curRotX) * Math.cos(curRotZ);
      const gravX = -2.8 * Math.sin(curRotZ) + sloshAngle.current.z * 1.5;
      const gravZ = 2.8 * Math.sin(curRotX) + sloshAngle.current.x * 1.5;

      const currentFill = FLUID_FILL_LEVEL + Math.sin(t * 1.8) * 0.02;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        // 1. Gravity & forces
        p.vx += gravX * safeDelta;
        p.vy += gravY * safeDelta;
        p.vz += gravZ * safeDelta;

        // 2. Liquid buoyancy & damping
        const inFluid = p.y <= currentFill + (p.x * sloshAngle.current.z + p.z * sloshAngle.current.x) * 0.5;
        if (inFluid) {
          // Buoyancy counters downward gravity
          p.vy += 1.8 * safeDelta;
          // Fluid viscosity / drag
          p.vx *= 0.93;
          p.vy *= 0.93;
          p.vz *= 0.93;

          // Gentle internal micro-currents / Brownian motion
          p.vx += Math.sin(t * 2.4 + p.y * 5) * 0.003;
          p.vz += Math.cos(t * 2.4 + p.x * 5) * 0.003;
        } else {
          // Air resistance / freefall outside fluid
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.vz *= 0.98;
        }

        // 3. Integrate position
        p.x += p.vx * safeDelta * 60;
        p.y += p.vy * safeDelta * 60;
        p.z += p.vz * safeDelta * 60;

        // 4. Capsule Collision Detection & Response
        // Bottom sphere center: (0, -CYLINDER_HALF_HEIGHT, 0)
        // Cylinder zone: y between -CYLINDER_HALF_HEIGHT and +CYLINDER_HALF_HEIGHT
        // Top sphere center: (0, +CYLINDER_HALF_HEIGHT, 0)
        const effRadius = INNER_RADIUS - p.baseRadius;

        if (p.y < -CYLINDER_HALF_HEIGHT) {
          // Inside bottom hemispherical cap
          const bY = p.y - (-CYLINDER_HALF_HEIGHT);
          const dist = Math.sqrt(p.x * p.x + bY * bY + p.z * p.z);
          if (dist > effRadius && dist > 0.0001) {
            const nx = p.x / dist;
            const ny = bY / dist;
            const nz = p.z / dist;
            p.x = nx * effRadius;
            p.y = -CYLINDER_HALF_HEIGHT + ny * effRadius;
            p.z = nz * effRadius;
            // Bounce and damping
            const dot = p.vx * nx + p.vy * ny + p.vz * nz;
            p.vx = (p.vx - 1.4 * dot * nx) * 0.65;
            p.vy = (p.vy - 1.4 * dot * ny) * 0.65;
            p.vz = (p.vz - 1.4 * dot * nz) * 0.65;
          }
        } else if (p.y > CYLINDER_HALF_HEIGHT) {
          // Inside top hemispherical cap
          const tY = p.y - CYLINDER_HALF_HEIGHT;
          const dist = Math.sqrt(p.x * p.x + tY * tY + p.z * p.z);
          if (dist > effRadius && dist > 0.0001) {
            const nx = p.x / dist;
            const ny = tY / dist;
            const nz = p.z / dist;
            p.x = nx * effRadius;
            p.y = CYLINDER_HALF_HEIGHT + ny * effRadius;
            p.z = nz * effRadius;
            const dot = p.vx * nx + p.vy * ny + p.vz * nz;
            p.vx = (p.vx - 1.4 * dot * nx) * 0.65;
            p.vy = (p.vy - 1.4 * dot * ny) * 0.65;
            p.vz = (p.vz - 1.4 * dot * nz) * 0.65;
          }
        } else {
          // Inside cylindrical middle wall
          const rCyl = Math.sqrt(p.x * p.x + p.z * p.z);
          if (rCyl > effRadius && rCyl > 0.0001) {
            const nx = p.x / rCyl;
            const nz = p.z / rCyl;
            p.x = nx * effRadius;
            p.z = nz * effRadius;
            const dot = p.vx * nx + p.vz * nz;
            p.vx = (p.vx - 1.4 * dot * nx) * 0.65;
            p.vz = (p.vz - 1.4 * dot * nz) * 0.65;
          }
        }

        // 5. Update instanced matrix
        dummy.position.set(p.x, p.y, p.z);
        const dynamicScale = p.baseRadius * (inFluid ? 1 : 0.85);
        dummy.scale.set(dynamicScale, dynamicScale, dynamicScale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Dynamic fluid meniscus wave tilt
    if (fluidMesh.current && !reduced) {
      fluidMesh.current.rotation.x = THREE.MathUtils.lerp(fluidMesh.current.rotation.x, sloshAngle.current.x * 0.6, 0.1);
      fluidMesh.current.rotation.z = THREE.MathUtils.lerp(fluidMesh.current.rotation.z, sloshAngle.current.z * 0.6, 0.1);
    }

    // Precessing orbit rings
    if (ringA.current && !reduced) ringA.current.rotation.y = t * 0.22;
    if (ringB.current && !reduced) ringB.current.rotation.y = -t * 0.16;
  });

  return (
    <group ref={group} rotation={[0.16, -0.28, -0.38]}>
      <Float
        speed={reduced ? 0 : 1.4}
        rotationIntensity={reduced ? 0 : 0.18}
        floatIntensity={reduced ? 0 : 0.65}
      >
        {/* Outer Clear Glass Capsule */}
        <mesh>
          <capsuleGeometry args={[0.6, 1.35, 32, 64]} />
          <meshPhysicalMaterial
            transmission={0.97}
            thickness={1.15}
            roughness={0.04}
            ior={1.48}
            clearcoat={1}
            clearcoatRoughness={0.05}
            color="#d8feff"
            attenuationColor="#00f0ff"
            attenuationDistance={3.2}
            envMapIntensity={1.8}
            specularIntensity={1.2}
            transparent
          />
        </mesh>

        {/* Center Precision Joint Ring / Waist Band */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.603, 0.012, 16, 64]} />
          <meshStandardMaterial
            color="#00f0ff"
            metalness={0.85}
            roughness={0.15}
            emissive="#00b4cc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Dynamic Inner Fluid Volume in Lower Half */}
        <group position={[0, 0, 0]} ref={fluidMesh}>
          <mesh position={[0, -0.63, 0]}>
            {/* truncated cylinder filling the lower capsule zone */}
            <cylinderGeometry args={[0.505, 0.505, 1.15, 32]} />
            <meshPhysicalMaterial
              color="#023b42"
              emissive="#00f0ff"
              emissiveIntensity={0.22}
              transmission={0.45}
              roughness={0.22}
              thickness={0.8}
              transparent
              opacity={0.82}
            />
          </mesh>
          {/* Bottom rounded cap of the fluid */}
          <mesh position={[0, -CYLINDER_HALF_HEIGHT, 0]}>
            <sphereGeometry args={[0.505, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshPhysicalMaterial
              color="#023b42"
              emissive="#10b981"
              emissiveIntensity={0.2}
              transmission={0.45}
              roughness={0.22}
              transparent
              opacity={0.82}
            />
          </mesh>
          {/* Surface Meniscus Disc */}
          <mesh position={[0, FLUID_FILL_LEVEL, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.505, 32]} />
            <meshStandardMaterial
              color="#00f0ff"
              emissive="#00f0ff"
              emissiveIntensity={0.4}
              transparent
              opacity={0.65}
              roughness={0.1}
            />
          </mesh>
        </group>

        {/* Instanced Dynamic Physical Particles / Medicine Beads */}
        <instancedMesh
          ref={instancedParticles}
          args={[undefined, undefined, PARTICLE_COUNT]}
        >
          <sphereGeometry args={[1, 14, 14]}>
            <instancedBufferAttribute
              attach="attributes-color"
              args={[colors, 3]}
            />
          </sphereGeometry>
          <meshStandardMaterial
            vertexColors
            roughness={0.18}
            metalness={0.35}
            emissive="#00f0ff"
            emissiveIntensity={0.35}
          />
        </instancedMesh>
      </Float>

      {/* Orbit Telemetry Rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.15, 0.18, 0]}>
        <torusGeometry args={[1.22, 0.0035, 8, 128]} />
        <meshBasicMaterial color="#7ef0ff" transparent opacity={0.38} toneMapped={false} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 1.85, -0.32, 0]}>
        <torusGeometry args={[1.45, 0.0028, 8, 128]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.28} toneMapped={false} />
      </mesh>

      {/* Ambient Luminescent Backdrop */}
      {glowTex && (
        <mesh position={[0, 0, -1.6]} scale={[4.8, 4.8, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Biometric suspended micro-sparkles */}
      <Sparkles
        count={85}
        scale={[4.8, 3.2, 2.4]}
        size={1.6}
        speed={reduced ? 0 : 0.3}
        color="#7ef0ff"
        opacity={0.45}
      />
    </group>
  );
}

/**
 * Hero WebGL scene: partially liquid-filled glass capsule with authentic
 * physical hydrodynamics, sloshing meniscus, and buoyant interactive beads.
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
        <Lightformer form="rect" intensity={3.4} color="#00f0ff" position={[-4, 2, 3]} scale={[5, 3]} />
        <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[3, 1, 4]} scale={[4, 2]} />
        <Lightformer form="rect" intensity={2.4} color="#10b981" position={[-2, -3, -3]} scale={[4, 4]} />
        <Lightformer form="ring" intensity={2.5} color="#9ffcf4" position={[3, -2, -2]} scale={2.5} />
      </Environment>
    </Canvas>
  );
}
