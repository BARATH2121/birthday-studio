"use client";

import type { ReactNode, RefObject } from "react";
import type * as THREE from "three";
import type { RobotAssets } from "./robot-assets";
import { RobotEye } from "./robot-eye";

/*
 * The head: a bevelled rounded box shell, a glossy face plate, two eyes, a
 * small glowing smile, soft cheeks, side ear pods and the antenna.
 *
 * The whole head is one group so the idle animation can turn and tilt it
 * without touching the body, and so the style accessory can ride along.
 */

export function RobotHead({
  assets,
  headRef,
  accessorySlot,
}: {
  assets: RobotAssets;
  headRef: RefObject<THREE.Group | null>;
  accessorySlot: ReactNode;
}) {
  return (
    <group ref={headRef} name="robot-head" position={[0, 1.55, 0]}>
      <mesh geometry={assets.geo.head} material={assets.mat.shell} castShadow />

      {/* face plate */}
      <mesh
        name="robot-visor"
        geometry={assets.geo.visor}
        material={assets.mat.visor}
        position={[0, -0.01, 0.19]}
        scale={[1, 0.7, 0.42]}
      />

      <RobotEye side="left" assets={assets} />
      <RobotEye side="right" assets={assets} />

      {/* smile — the bottom half of a thin torus */}
      <mesh
        name="robot-mouth"
        geometry={assets.geo.smile}
        material={assets.mat.glow}
        position={[0, -0.115, 0.3]}
        rotation={[Math.PI, 0, 0]}
      />

      {/* cheeks */}
      <mesh
        geometry={assets.geo.cheek}
        material={assets.mat.blush}
        position={[-0.2, -0.075, 0.288]}
        scale={[1, 0.65, 0.35]}
      />
      <mesh
        geometry={assets.geo.cheek}
        material={assets.mat.blush}
        position={[0.2, -0.075, 0.288]}
        scale={[1, 0.65, 0.35]}
      />

      {/* ear pods */}
      <mesh
        geometry={assets.geo.earPod}
        material={assets.mat.panel}
        position={[-0.315, 0.02, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      />
      <mesh
        geometry={assets.geo.earPod}
        material={assets.mat.panel}
        position={[0.315, 0.02, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      />
      <mesh geometry={assets.geo.stud} material={assets.mat.metal} position={[-0.35, 0.02, 0]} />
      <mesh geometry={assets.geo.stud} material={assets.mat.metal} position={[0.35, 0.02, 0]} />

      {/* antenna */}
      <group name="robot-antenna" position={[0, 0.29, 0]}>
        <mesh geometry={assets.geo.antennaStem} material={assets.mat.joint} position={[0, 0.075, 0]} />
        <mesh geometry={assets.geo.antennaTip} material={assets.mat.glow} position={[0, 0.185, 0]} />
      </group>

      {accessorySlot}
    </group>
  );
}
