"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import type { SceneConfig, SceneDensity, SceneKind } from "./style-theme";

const DENSITY_COUNTS: Record<SceneDensity, { field: number; rig: number }> = {
  low: { field: 70, rig: 12 },
  medium: { field: 150, rig: 24 },
  high: { field: 260, rig: 40 },
};

function hashSeed(...values: (string | number)[]): number {
  let h = 2166136261;
  for (const value of values) {
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ParticleFieldProps = {
  count: number;
  colors: readonly string[];
  size?: number;
  opacity?: number;
  additive?: boolean;
  upward?: boolean;
  sway?: number;
  swayFreq?: number;
  zDepth?: number;
};

function ParticleField({
  count,
  colors,
  size = 0.05,
  opacity = 0.7,
  additive = true,
  upward = true,
  sway = 0.05,
  swayFreq = 0.5,
  zDepth = 2.4,
}: ParticleFieldProps) {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const { nx, ny, nz, phase, speed, positions, cols } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const nx = new Float32Array(count);
    const ny = new Float32Array(count);
    const nz = new Float32Array(count);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    const rand = createRandom(hashSeed("field", count, ...colors));
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      nx[i] = rand() * 2 - 1;
      ny[i] = rand() * 2 - 1;
      nz[i] = rand() * 2 - 1;
      phase[i] = rand() * Math.PI * 2;
      speed[i] = 0.5 + rand() * 1.2;
      col.set(colors[(rand() * colors.length) | 0]);
      col.offsetHSL(
        (rand() - 0.5) * 0.04,
        (rand() - 0.5) * 0.12,
        (rand() - 0.5) * 0.1,
      );
      const i3 = i * 3;
      positions[i3] = nx[i] * 3;
      positions[i3 + 1] = ny[i] * 3.5;
      positions[i3 + 2] = nz[i] * 1.5;
      cols[i3] = col.r;
      cols[i3 + 1] = col.g;
      cols[i3 + 2] = col.b;
    }
    return { nx, ny, nz, phase, speed, positions, cols };
  }, [count, colors]);

  useFrame((frame) => {
    const geo = geometryRef.current;
    if (!geo) return;
    const t = frame.clock.elapsedTime;
    const { width, height } = frame.viewport;
    const spanY = height * 1.15;
    const pos = geo.attributes.position.array as Float32Array;
    const sign = upward ? 1 : -1;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const prev = (ny[i] + 1) * spanY * 0.5 + sign * speed[i] * 0.55 * t + phase[i];
      const wrap = ((prev % spanY) + spanY) % spanY;
      pos[i3] = nx[i] * (width * 0.54) + Math.sin(t * swayFreq + phase[i]) * width * sway;
      pos[i3 + 1] = wrap - spanY * 0.5;
      pos[i3 + 2] = nz[i] * zDepth + Math.sin(t * swayFreq * 0.65 + phase[i]) * 0.45;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[cols, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        sizeAttenuation
        vertexColors
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
}

type BalloonItem = {
  nx: number;
  ny: number;
  nz: number;
  r: number;
  phase: number;
  speed: number;
  color: THREE.Color;
};

function Balloons({ colors, count }: { colors: readonly string[]; count: number }) {
  const balloonRef = useRef<THREE.InstancedMesh>(null);
  const stringRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const items: BalloonItem[] = useMemo(() => {
    const rand = createRandom(hashSeed("balloons", count, ...colors));
    return Array.from({ length: count }, (_, i) => ({
      nx: rand() * 2 - 1,
      ny: rand() * 2 - 1,
      nz: rand() * 2 - 1,
      r: 0.16 + rand() * 0.11,
      phase: rand() * Math.PI * 2,
      speed: 0.5 + rand() * 1.1,
      color: new THREE.Color(colors[i % colors.length]),
    }));
  }, [count, colors]);

  useEffect(() => {
    const mesh = balloonRef.current;
    if (!mesh) return;
    items.forEach((item, i) => mesh.setColorAt(i, item.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  useFrame((frame) => {
    const mesh = balloonRef.current;
    const strings = stringRef.current;
    if (!mesh || !strings) return;
    const t = frame.clock.elapsedTime;
    const { width, height } = frame.viewport;
    const spanY = height * 1.15;
    const wobAmp = width * 0.05;
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const x = item.nx * width * 0.6;
      const z = item.nz * 1.5 - 0.5;
      const rise = item.speed * 0.62 * t + item.phase;
      const wrap = (((item.ny + 1) * spanY * 0.5 + rise) % spanY + spanY) % spanY;
      const y = wrap - spanY * 0.5;
      const wob = Math.sin(t * 0.7 + item.phase) * wobAmp;

      dummy.rotation.set(
        Math.sin(t * 0.4 + item.phase) * 0.15,
        0,
        Math.cos(t * 0.32 + item.phase) * 0.1,
      );
      dummy.position.set(x + wob, y, z);
      dummy.scale.setScalar(item.r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x + wob * 0.6, y - item.r - 0.26, z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      strings.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    strings.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={balloonRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={stringRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <meshBasicMaterial color="#dde3ff" transparent opacity={0.3} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

type ConfettiItem = {
  nx: number;
  ny: number;
  nz: number;
  s: number;
  phase: number;
  speed: number;
  spinX: number;
  spinY: number;
  color: THREE.Color;
};

function Confetti({ colors, count }: { colors: readonly string[]; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const items: ConfettiItem[] = useMemo(() => {
    const rand = createRandom(hashSeed("confetti", count, ...colors));
    return Array.from({ length: count }, (_, i) => ({
      nx: rand() * 2 - 1,
      ny: rand() * 2 - 1,
      nz: rand() * 2 - 1,
      s: 0.05 + rand() * 0.09,
      phase: rand() * Math.PI * 2,
      speed: 0.6 + rand() * 0.9,
      spinX: 1.4 + rand() * 2,
      spinY: 1.8 + rand() * 2.2,
      color: new THREE.Color(colors[i % colors.length]),
    }));
  }, [count, colors]);

  useEffect(() => {
    const meshRef = mesh.current;
    if (!meshRef) return;
    items.forEach((item, i) => meshRef.setColorAt(i, item.color));
    if (meshRef.instanceColor) meshRef.instanceColor.needsUpdate = true;
  }, [items]);

  useFrame((frame) => {
    const meshRef = mesh.current;
    if (!meshRef) return;
    const t = frame.clock.elapsedTime;
    const { width, height } = frame.viewport;
    const spanY = height * 1.15;
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const wave = -(item.speed * 1.15 * t + item.phase);
      const wrap = (((item.ny + 1) * spanY * 0.5 + wave) % spanY + spanY) % spanY;
      dummy.position.set(
        item.nx * (width * 0.56) + Math.sin(t * 0.9 + item.phase) * width * 0.03,
        wrap - spanY * 0.5,
        item.nz * 2.2 + Math.sin(t * 0.5 + item.phase) * 0.4,
      );
      dummy.rotation.set(t * item.spinX + item.phase, t * item.spinY + item.phase * 2, t * 1.2);
      dummy.scale.setScalar(item.s);
      dummy.updateMatrix();
      meshRef.setMatrixAt(i, dummy.matrix);
    }
    meshRef.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[1, 0.45, 0.03]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function SpinRing({
  radius,
  tube,
  color,
  opacity,
  tilt,
  speeds,
}: {
  radius: number;
  tube: number;
  color: string;
  opacity: number;
  tilt: [number, number, number];
  speeds: [number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const meshRef = ref.current;
    if (!meshRef) return;
    meshRef.rotation.x += delta * speeds[0];
    meshRef.rotation.y += delta * speeds[1];
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, tube, 12, 96]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function OrbitRings({ colors }: { colors: readonly string[] }) {
  const group = useRef<THREE.Group>(null);
  const gold = colors[1] ?? "#e8cf9a";
  const light = colors[0] ?? "#f6ecd0";
  useFrame(({ viewport, clock }) => {
    const g = group.current;
    if (!g) return;
    g.scale.setScalar(Math.min(viewport.height * 0.52, 4.2) / 3.2);
    g.rotation.z = clock.elapsedTime * 0.05;
  });
  return (
    <group ref={group}>
      <SpinRing radius={3.2} tube={0.011} color={gold} opacity={0.4} tilt={[Math.PI / 2.6, 0.4, 0]} speeds={[0.16, 0.24]} />
      <SpinRing radius={2.2} tube={0.009} color={light} opacity={0.28} tilt={[Math.PI / 2.4, -0.5, 0]} speeds={[0.28, 0.16]} />
      <SpinRing radius={1.3} tube={0.008} color={gold} opacity={0.5} tilt={[Math.PI / 2.2, 0.2, 0]} speeds={[0.4, 0.3]} />
    </group>
  );
}

function Beam({ colors, density }: { colors: readonly string[]; density: SceneDensity }) {
  const cone = useRef<THREE.Mesh>(null);
  const moteCount = DENSITY_COUNTS[density].field;
  useFrame(({ viewport, clock }) => {
    const c = cone.current;
    if (!c) return;
    const t = clock.elapsedTime;
    c.scale.setScalar(Math.min(viewport.height, 7.5) / 7);
    c.rotation.z = Math.sin(t * 0.11) * 0.1;
    c.rotation.x = Math.sin(t * 0.07 + 1.2) * 0.06;
  });
  return (
    <group>
      <mesh ref={cone} position={[0, 2.3, -2.2]}>
        <coneGeometry args={[3, 7, 32, 1, true]} />
        <meshBasicMaterial
          color={colors[0] ?? "#93b4ff"}
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <ParticleField count={moteCount} colors={colors} size={0.028} opacity={0.55} sway={0.04} swayFreq={0.35} zDepth={3} />
    </group>
  );
}

function Rig({ kind, children }: { kind: SceneKind; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const g = group.current;
    if (g) {
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -state.pointer.y * 0.08, 2.5, delta);
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, state.pointer.x * 0.1, 2.5, delta);
      g.position.x = THREE.MathUtils.damp(g.position.x, state.pointer.x * 0.4, 2.5, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, -state.pointer.y * 0.3, 2.5, delta);
    }
    if (kind === "beam") {
      const z = 8.5 + Math.sin(state.clock.elapsedTime * 0.16) * 0.55;
      state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, z, 1.5, delta);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return <group ref={group}>{children}</group>;
}

function SceneGraph({ config }: { config: SceneConfig }) {
  const counts = DENSITY_COUNTS[config.density];
  return (
    <Rig kind={config.kind}>
      {config.kind === "petals" ? (
        <ParticleField count={counts.field} colors={config.colors} size={0.05} opacity={0.72} sway={0.05} zDepth={2.4} />
      ) : null}
      {config.kind === "balloons" ? <Balloons colors={config.colors} count={counts.rig} /> : null}
      {config.kind === "orbits" ? (
        <>
          <OrbitRings colors={config.colors} />
          <ParticleField count={counts.field} colors={config.colors} size={0.026} opacity={0.5} sway={0.03} swayFreq={0.3} zDepth={2.6} />
        </>
      ) : null}
      {config.kind === "confetti" ? (
        <>
          <Confetti colors={config.colors} count={counts.field} />
          <ParticleField count={Math.round(counts.field * 0.4)} colors={["#ffffff", config.colors[0] ?? "#ffffff"]} size={0.045} opacity={0.9} zDepth={1.8} />
        </>
      ) : null}
      {config.kind === "beam" ? <Beam colors={config.colors} density={config.density} /> : null}
    </Rig>
  );
}

/**
 * Live per-style 3D backdrop for a birthday card.
 */
let cachedMode: "pending" | "on" | "off" = "pending";
let modeComputed = false;

function readSceneMode(): "pending" | "on" | "off" {
  if (modeComputed) return cachedMode;
  modeComputed = true;
  if (typeof window === "undefined") {
    cachedMode = "pending";
    return cachedMode;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cachedMode = "off";
    return cachedMode;
  }
  const probe = document.createElement("canvas");
  const supported = Boolean(
    probe.getContext("webgl2") ||
      probe.getContext("webgl") ||
      probe.getContext("experimental-webgl"),
  );
  cachedMode = supported ? "on" : "off";
  return cachedMode;
}

const subscribeSceneMode = () => () => {};

export default function BirthdayScene({ scene }: { scene: SceneConfig }) {
  const mode = useSyncExternalStore(subscribeSceneMode, readSceneMode, () => "pending");

  if (mode !== "on") return null;

  return (
    <div className="bp-scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 9], fov: 52, near: 0.1, far: 40 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <SceneGraph config={scene} />
      </Canvas>
    </div>
  );
}