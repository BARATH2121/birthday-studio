"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import BirthdayRobot from "./birthday-robot";
import { toHex, type WorldTheme } from "./world-theme";
import { useMotionRef } from "./use-motion-ref";

/*
 * Phase 4A â€” real three.js stage, Phase 4B â€” the birthday robot.
 *
 * A deliberately small, unreachable-by-default world inside the existing
 * `.bp-stage`:
 *   - a fixed-tuned perspective camera (R3F re-applies the aspect and
 *     projection matrix on resize, so the framing holds across the stage
 *     aspect range in the verification matrix);
 *   - a lighting rig driven by the theme's key + accent colours;
 *   - the procedural birthday robot (`birthday-robot.tsx`), which owns its own
 *     materials, parts and idle motion;
 *   - an environment foundation: floor + glow pool, soft backdrop glows,
 *     deterministic floating dust and a few decorative rings.
 *
 * Everything animated is driven by the renderer clock (never Math.random),
 * and every animation checks the motion flag so `prefers-reduced-motion`
 * renders a single static frame instead (frameloop "demand").
 */

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

function KeyLights({ theme }: { theme: WorldTheme }) {
  return (
    <>
      <ambientLight intensity={0.5} color="#8d96c9" />
      <directionalLight
        castShadow
        position={[3.2, 4.6, 3.4]}
        intensity={1.35}
        color={toHex(theme.key)}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={22}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-0.6}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4.2, 1.6, -1.4]} intensity={0.55} color={toHex(theme.accent)} />
      {/* Gentle frontal fill from the opposite side of the key, so the robot's
          shaded cheek and the dark elegant shell still read. */}
      <directionalLight position={[-2.4, 1.6, 3.8]} intensity={0.32} color="#eef1ff" />
      <spotLight
        position={[0, 3.4, -4.6]}
        angle={0.55}
        penumbra={0.9}
        intensity={30}
        color={toHex(theme.accent)}
        distance={16}
      />
      <pointLight position={[0, 2.4, -2]} intensity={5} color={toHex(theme.key)} distance={9} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

function FloatingDust({ theme, motionEnabled }: { theme: WorldTheme; motionEnabled: boolean }) {
  const motion = useMotionRef(motionEnabled);
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 48;
    const arr = new Float32Array(count * 3);
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count; i++) {
      const radius = 1.4 + rand() * 3.2;
      const theta = rand() * Math.PI * 2;
      arr[i * 3] = Math.cos(theta) * radius;
      arr[i * 3 + 1] = 0.3 + rand() * 2.3;
      arr[i * 3 + 2] = -2.4 + rand() * 3.0;
    }
    return arr;
    // Re-seed per theme so each style's world reads differently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.styleId]);

  useFrame((state) => {
    if (!motion.current || !points.current) return;
    const t = state.clock.elapsedTime;
    points.current.position.y = Math.sin(t * 0.5) * 0.07;
    points.current.rotation.y = t * 0.04;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color={toHex(theme.particle)} transparent opacity={0.75} sizeAttenuation depthWrite={false} />
    </points>
  );
}

type FloaterConfig = {
  position: [number, number, number];
  scale: number;
  speed: number;
  phase: number;
};

const FLOATERS: FloaterConfig[] = [
  { position: [-2.6, 2.2, -1.2], scale: 0.2, speed: 0.9, phase: 0 },
  { position: [2.8, 2.5, -1.4], scale: 0.15, speed: 0.7, phase: 2.1 },
  { position: [0.4, 2.9, -2.2], scale: 0.13, speed: 0.6, phase: 4.2 },
];

function FloatingRing({
  config,
  color,
  motionEnabled,
}: {
  config: FloaterConfig;
  color: THREE.Color;
  motionEnabled: boolean;
}) {
  const motion = useMotionRef(motionEnabled);
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!motion.current || !ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = config.position[1] + Math.sin(t * config.speed + config.phase) * 0.12;
    ref.current.rotation.y = t * config.speed * 0.4;
    ref.current.rotation.z = Math.sin(t * config.speed * 0.5 + config.phase) * 0.3;
  });

  return (
    <mesh ref={ref} position={config.position} scale={config.scale}>
      <torusGeometry args={[1, 0.3, 12, 24]} />
      <meshStandardMaterial color={toHex(color)} emissive={toHex(color)} emissiveIntensity={0.35} roughness={0.4} metalness={0.3} transparent opacity={0.9} />
    </mesh>
  );
}

function Environment({ theme, motionEnabled }: { theme: WorldTheme; motionEnabled: boolean }) {
  return (
    <>
      {/* soft backdrop glows (sized for the widest stage in the matrix) */}
      <mesh position={[0, 1.9, -3.6]}>
        <sphereGeometry args={[6, 24, 24]} />
        <meshBasicMaterial color={toHex(theme.key)} transparent opacity={0.09} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.3, -4.8]}>
        <sphereGeometry args={[4.4, 24, 24]} />
        <meshBasicMaterial color={toHex(theme.accent)} transparent opacity={0.06} depthWrite={false} />
      </mesh>

      {/* floor + glow pool */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[7, 64]} />
        <meshStandardMaterial color="#101526" roughness={0.94} metalness={0.06} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
        <circleGeometry args={[2.6, 56]} />
        <meshBasicMaterial color={toHex(theme.floorPool)} transparent opacity={0.18} depthWrite={false} />
      </mesh>

      <FloatingDust theme={theme} motionEnabled={motionEnabled} />
      {FLOATERS.map((config, index) => (
        <FloatingRing key={index} config={config} color={index % 2 === 0 ? theme.key : theme.accent} motionEnabled={motionEnabled} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas export                                                       */
/* ------------------------------------------------------------------ */

export default function BirthdayWorld({
  theme,
  motionEnabled,
}: {
  theme: WorldTheme;
  motionEnabled: boolean;
}) {
  return (
    <div className="bp-stage-3d" data-motion={motionEnabled ? "idle" : "static"} data-webgl="on">
      <Canvas
        dpr={[1, 2]}
        shadows
        frameloop={motionEnabled ? "always" : "demand"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        style={{ pointerEvents: "none" }}
        camera={{ position: [0, 0, 5.7], fov: 40, near: 0.1, far: 60 }}
        onCreated={(state) => {
          state.gl.domElement.setAttribute("data-ready", "1");
        }}
      >
        <group position={[0, -0.5, 0]}>
          <KeyLights theme={theme} />
          <Environment theme={theme} motionEnabled={motionEnabled} />
          {/* The robot stands with its soles at local y = 0 and reaches ~2.13
              with the tallest accessory: about half the frame height, with
              ~10% headroom and the feet a quarter up from the bottom, at every
              stage aspect in the matrix. Sits a touch in front of the backdrop
              for separation. */}
          <group position={[0, 0, 0.15]}>
            <BirthdayRobot theme={theme} motionEnabled={motionEnabled} />
          </group>
        </group>
      </Canvas>
    </div>
  );
}
