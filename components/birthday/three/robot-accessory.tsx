"use client";

import type { RobotAssets } from "./robot-assets";
import type { RobotAccessoryKind } from "./robot-profiles";

/*
 * The style accessory â€” the one thing that changes the character's read per
 * birthday style. Each variant is deliberately small and built from the same
 * procedural geometry as the body, so the accessory can never cost the stage
 * an extra asset load.
 *
 * Anchors are in head-local space; the robot root uses `anchor[1]` as the base
 * height for the idle float.
 */

export const ACCESSORY_ANCHOR: Record<RobotAccessoryKind, [number, number, number]> = {
  /* Floating beside the head â€” a glowing heart. */
  heart: [-0.3, 0.36, 0.03],
  /* Sat on the crown â€” a party hat. */
  "party-hat": [0, 0.22, -0.02],
  /* A slim band around the crown with a gem. */
  circlet: [0, 0.225, 0],
  /* Floating above the head â€” a neon halo. */
  halo: [0, 0.55, -0.03],
  /* A small dish on the side of the head. */
  "explorer-dish": [0.34, 0.16, -0.04],
};

export function RobotAccessory({ kind, assets }: { kind: RobotAccessoryKind; assets: RobotAssets }) {
  const { geo, mat } = assets;

  if (kind === "heart") {
    return (
      <mesh
        name="robot-accessory-heart"
        geometry={geo.heart}
        material={mat.accessory}
        rotation={[0, 0, 0.18]}
      />
    );
  }

  if (kind === "party-hat") {
    return (
      <group name="robot-accessory-party-hat">
        <mesh geometry={geo.hatBrim} material={mat.panel} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.hatCone} material={mat.accessory} position={[0, 0.13, 0]} castShadow />
        <mesh geometry={geo.pompom} material={mat.glow} position={[0, 0.27, 0]} />
      </group>
    );
  }

  if (kind === "circlet") {
    return (
      <group name="robot-accessory-circlet">
        <mesh
          geometry={geo.circlet}
          material={mat.metal}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1, 0.62, 1]}
          castShadow
        />
        <mesh geometry={geo.gem} material={mat.accessory} position={[0, 0.02, 0.19]} />
      </group>
    );
  }

  if (kind === "halo") {
    return (
      <group name="robot-accessory-halo">
        <mesh geometry={geo.halo} material={mat.accessory} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.stud} material={mat.glow} position={[0.24, -0.02, 0]} />
        <mesh geometry={geo.stud} material={mat.glow} position={[-0.24, -0.02, 0]} />
      </group>
    );
  }

  return (
    <group name="robot-accessory-explorer-dish" rotation={[0, 0, -0.4]}>
      <mesh geometry={geo.dishStem} material={mat.metal} position={[0, 0.06, 0]} />
      <mesh
        geometry={geo.dish}
        material={mat.accessory}
        position={[0.05, 0.125, 0]}
        rotation={[0.35, 0, 0]}
      />
      <mesh geometry={geo.stud} material={mat.metal} position={[0.06, 0.15, 0]} scale={0.7} />
    </group>
  );
}
