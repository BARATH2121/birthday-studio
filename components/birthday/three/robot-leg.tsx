"use client";

import type { RobotAssets } from "./robot-assets";
import type { RobotSide } from "./robot-eye";

/*
 * One leg and its foot. The feet are kept apart (`LEG_X`) so the character has
 * two clearly separated legs in silhouette, and they use the panel colour so the
 * shoes read as a deliberate two-tone detail.
 */

export const LEG_X = 0.185;
const MIRROR = { left: -1, right: 1 } as const;

export function RobotLeg({ side, assets }: { side: RobotSide; assets: RobotAssets }) {
  const s = MIRROR[side];
  return (
    <group name={`robot-leg-${side}`} position={[LEG_X * s, 0, 0]}>
      <mesh geometry={assets.geo.leg} material={assets.mat.shell} position={[0, 0.3, 0]} castShadow />
      <mesh
        name={`robot-foot-${side}`}
        geometry={assets.geo.foot}
        material={assets.mat.panel}
        position={[0, 0.075, 0.045]}
        castShadow
      />
    </group>
  );
}
