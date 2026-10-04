"use client";

import type { Ref } from "react";
import type * as THREE from "three";
import type { RobotAssets } from "./robot-assets";
import type { RobotSide } from "./robot-eye";

/*
 * One arm: shoulder ball, upper arm capsule, elbow joint, forearm and a mitten
 * hand. Built hanging down from the shoulder pivot so the idle animation only
 * has to rotate the group.
 *
 * The arm is mounted a little away from the torso (`ARM_X`) and rotated
 * slightly outward (`REST_Z`), which keeps a clean gap between the hand and
 * the leg — that silhouette is what makes the character read as a figure with
 * two arms rather than a blob.
 */

export const ARM_X = 0.455;
export const ARM_Y = 1.03;
/** Rest rotation per side; the idle animation adds a small delta to this. */
export const ARM_REST_Z = { left: -0.16, right: 0.16 } as const;
const MIRROR = { left: -1, right: 1 } as const;

export function RobotArm({
  side,
  assets,
  pivotRef,
}: {
  side: RobotSide;
  assets: RobotAssets;
  pivotRef?: Ref<THREE.Group>;
}) {
  const s = MIRROR[side];
  return (
    <group
      ref={pivotRef}
      name={`robot-arm-${side}`}
      position={[ARM_X * s, ARM_Y, 0]}
      rotation={[0.06, 0, ARM_REST_Z[side]]}
    >
      <mesh geometry={assets.geo.shoulder} material={assets.mat.shell} castShadow />
      <mesh
        geometry={assets.geo.upperArm}
        material={assets.mat.shell}
        position={[0, -0.145, 0]}
        castShadow
      />
      <mesh geometry={assets.geo.elbow} material={assets.mat.joint} position={[0, -0.3, 0]} />
      <mesh
        geometry={assets.geo.foreArm}
        material={assets.mat.shell}
        position={[0, -0.42, 0]}
        castShadow
      />
      <mesh
        name={`robot-hand-${side}`}
        geometry={assets.geo.hand}
        material={assets.mat.shell}
        position={[0, -0.6, 0.01]}
        scale={[1, 0.9, 0.78]}
        castShadow
      />
    </group>
  );
}
