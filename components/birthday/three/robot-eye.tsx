"use client";

import type { RobotAssets } from "./robot-assets";

/*
 * One eye: an emissive lens plus an unlit white glint. The lens sits in its own
 * group so a future blink is a single `scale.y` change on that group.
 */

export type RobotSide = "left" | "right";

const MIRROR = { left: -1, right: 1 } as const;

export function RobotEye({ side, assets }: { side: RobotSide; assets: RobotAssets }) {
  const s = MIRROR[side];
  return (
    <group name={`robot-eye-${side}`} position={[0.105 * s, 0.045, 0.3]}>
      <mesh geometry={assets.geo.eye} material={assets.mat.eye} scale={[1, 1.12, 0.5]} />
      <mesh
        geometry={assets.geo.eyeGlint}
        material={assets.mat.glint}
        position={[-0.024 * s, 0.03, 0.028]}
        scale={0.9}
      />
    </group>
  );
}
