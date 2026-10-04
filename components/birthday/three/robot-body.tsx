"use client";

import type { RobotAssets } from "./robot-assets";

/*
 * The torso: a bevelled rounded box with an inset chest plate, a glowing core,
 * a metal collar ring and the neck.
 *
 * The upper body (torso + arms) is wrapped in one group by the robot root, so
 * the idle "breath" can scale the whole chest and take the shoulders with it.
 */

/**
 * Torso centre height. `roundedBoxGeometry` returns geometry centred on its
 * origin, so the shell (0.74 tall) is lifted to sit on the legs: its underside
 * meets the leg tops at ~0.42 and its shoulders meet the collar at ~1.16, which
 * is where the plate, collar, neck and head coordinates below already expect it.
 */
export const TORSO_Y = 0.79;

export function RobotBody({ assets }: { assets: RobotAssets }) {
  return (
    <>
      <mesh geometry={assets.geo.torso} material={assets.mat.shell} position={[0, TORSO_Y, 0]} castShadow />

      <mesh
        geometry={assets.geo.chestPlate}
        material={assets.mat.panel}
        position={[0, 0.86, 0.285]}
        castShadow
      />
      <mesh
        name="robot-chest-core"
        geometry={assets.geo.chestCore}
        material={assets.mat.glow}
        position={[0, 0.86, 0.35]}
      />

      <mesh
        geometry={assets.geo.collar}
        material={assets.mat.metal}
        position={[0, 1.185, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      />
      <mesh geometry={assets.geo.neck} material={assets.mat.joint} position={[0, 1.235, 0]} />
    </>
  );
}
