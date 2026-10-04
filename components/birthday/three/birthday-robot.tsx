"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { WorldTheme } from "./world-theme";
import { useRobotAssets } from "./robot-assets";
import { robotProfile } from "./robot-profiles";
import { useMotionRef } from "./use-motion-ref";
import { RobotBody, TORSO_Y } from "./robot-body";
import { RobotHead } from "./robot-head";
import { ARM_REST_Z, RobotArm } from "./robot-arm";
import { RobotLeg } from "./robot-leg";
import { ACCESSORY_ANCHOR, RobotAccessory } from "./robot-accessory";

/*
 * The birthday robot.
 *
 * Everything here is procedural geometry from `robot-assets` — no models, no
 * textures, nothing to download. `robot-profiles` supplies the per-style
 * palette and the single accessory that gives each style its own read.
 *
 * Framing contract: local y = 0 is the soles, and the tallest accessory reaches
 * about y = 2.13, which keeps the figure inside the stage's existing camera
 * with roughly 10% headroom and its feet about a third up from the bottom.
 * Because the rest pose is written into the JSX (not applied by the frame
 * loop), reduced motion renders a properly composed standing pose with no
 * frames to run at all.
 */

/* Idle amplitudes. Deliberately tiny: this is a resting character, not a
   performance. Every value is constant and the phase comes from the renderer
   clock, so two runs of the same style always animate identically. */
const FLOAT_HEIGHT = 0.035;
const FLOAT_SPEED = 0.9;
const FLOAT_TURN = 0.05;
const BREATH_SPEED = 1.7;
const HEAD_TURN = 0.11;
const HEAD_TILT = 0.045;
const HEAD_ROLL = 0.028;
const ARM_SWING = 0.05;
const ACCESSORY_LIFT = 0.018;
const ACCESSORY_TILT = 0.04;

export default function BirthdayRobot({
  theme,
  motionEnabled,
}: {
  theme: WorldTheme;
  motionEnabled: boolean;
}) {
  const assets = useRobotAssets(theme.styleId, motionEnabled);
  const profile = robotProfile(theme.styleId);
  const motion = useMotionRef(motionEnabled);

  const floatRef = useRef<THREE.Group>(null);
  const breathRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLeftRef = useRef<THREE.Group>(null);
  const armRightRef = useRef<THREE.Group>(null);
  const accessoryRef = useRef<THREE.Group>(null);

  const accessoryAnchor = ACCESSORY_ANCHOR[profile.accessory];

  useFrame((state) => {
    if (!motion.current) return;
    const t = state.clock.elapsedTime;

    /* Gentle hover, plus a very slow drift so the pose is never frozen. */
    if (floatRef.current) {
      floatRef.current.position.y = FLOAT_HEIGHT * Math.sin(t * FLOAT_SPEED);
      floatRef.current.rotation.y = FLOAT_TURN * Math.sin(t * 0.42);
    }

    /* Breath: the chest swells a hair, shoulders included. */
    if (breathRef.current) {
      const breath = Math.sin(t * BREATH_SPEED);
      breathRef.current.scale.set(
        1 + 0.014 * breath,
        1 + 0.026 * breath,
        1 + 0.014 * breath,
      );
    }

    /* The head looks around a little, like it is listening to the party. */
    if (headRef.current) {
      headRef.current.rotation.set(
        HEAD_TILT * Math.cos(t * 0.72),
        HEAD_TURN * Math.sin(t * 0.5),
        HEAD_ROLL * Math.sin(t * 0.61),
      );
    }

    /* A hint of arm movement, out of phase between the two sides. */
    if (armLeftRef.current) {
      armLeftRef.current.rotation.z = ARM_REST_Z.left + ARM_SWING * Math.sin(t * 1.15);
    }
    if (armRightRef.current) {
      armRightRef.current.rotation.z = ARM_REST_Z.right - ARM_SWING * Math.sin(t * 1.15 + 0.9);
    }

    /* The accessory breathes with the character. */
    if (accessoryRef.current) {
      accessoryRef.current.position.y = accessoryAnchor[1] + ACCESSORY_LIFT * Math.sin(t * 1.2);
      accessoryRef.current.rotation.z = ACCESSORY_TILT * Math.sin(t * 0.8);
    }
  });

  return (
    /* `dispose={null}`: the shared geometries and materials are created and
       disposed by `useRobotAssets`, so R3F must not also free them here. */
    <group ref={floatRef} name="robot" dispose={null}>
      <RobotLeg side="left" assets={assets} />
      <RobotLeg side="right" assets={assets} />

      {/* Pivoted on the chest so the breath swells the torso and takes the
          shoulders with it, instead of stretching the whole figure from the
          soles. The inner group keeps every child's coordinates absolute. */}
      <group ref={breathRef} name="robot-body" position={[0, TORSO_Y, 0]}>
        <group position={[0, -TORSO_Y, 0]}>
          <RobotBody assets={assets} />
          <RobotArm side="left" assets={assets} pivotRef={armLeftRef} />
          <RobotArm side="right" assets={assets} pivotRef={armRightRef} />
        </group>
      </group>

      <RobotHead
        assets={assets}
        headRef={headRef}
        accessorySlot={
          <group ref={accessoryRef} name="robot-accessory" position={accessoryAnchor}>
            <RobotAccessory kind={profile.accessory} assets={assets} />
          </group>
        }
      />
    </group>
  );
}
