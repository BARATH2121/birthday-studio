"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BirthdayStyleId } from "@/lib/birthday";
import { robotProfile } from "./robot-profiles";
import { useMotionRef } from "./use-motion-ref";

/*
 * Phase 4B — the robot's procedural geometry and materials.
 *
 * Everything the character is made of is generated in code: no textures, no
 * downloaded models, no GLTF. Rounded forms come from a bevelled extrusion of a
 * rounded-rectangle shape, which gives the soft "premium toy" edges that a raw
 * box or a scaled sphere cannot.
 *
 * Every geometry and material is created once per style and shared by all the
 * parts that use it, so the robot stays at roughly 20k triangles and ~40 draw
 * calls. The single owner of their lifetime is `useRobotAssets`: it disposes
 * them on unmount, and the robot root is rendered with `dispose={null}` so
 * React Three Fiber does not double-dispose the shared instances.
 */

/* ------------------------------------------------------------------ */
/* Geometry factories                                                  */
/* ------------------------------------------------------------------ */

/**
 * A box with rounded vertical corners *and* a bevelled front/back edge.
 * `width`/`height` are the true outer cross-section and `depth` the true outer
 * depth; the bevel is inset from both so the result is centred on its origin.
 */
function roundedBoxGeometry(width: number, height: number, depth: number, radius: number) {
  const r = Math.min(radius, width / 2 - 1e-3, height / 2 - 1e-3);
  const bevel = Math.min(r * 0.55, depth * 0.24, 0.05);
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;

  const shape = new THREE.Shape();
  shape.moveTo(left + r, bottom);
  shape.lineTo(right - r, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + r);
  shape.lineTo(right, top - r);
  shape.quadraticCurveTo(right, top, right - r, top);
  shape.lineTo(left + r, top);
  shape.quadraticCurveTo(left, top, left, top - r);
  shape.lineTo(left, bottom + r);
  shape.quadraticCurveTo(left, bottom, left + r, bottom);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, depth - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 5,
    steps: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

/** A puffy extruded heart, used by the romantic accessory. */
function heartGeometry(size: number) {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, -0.2);
  s.bezierCurveTo(-0.3, -0.4, -0.3, -0.7, -0.1, -0.7);
  s.bezierCurveTo(-0.05, -0.7, 0, -0.65, 0, -0.6);
  s.bezierCurveTo(0, -0.65, 0.05, -0.7, 0.1, -0.7);
  s.bezierCurveTo(0.3, -0.7, 0.3, -0.4, 0, -0.2);
  s.bezierCurveTo(0.2, 0, 0.25, 0.25, 0.25, 0.25);

  const geometry = new THREE.ExtrudeGeometry(s, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.11,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 14,
    steps: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  geometry.scale(size, size, size);
  return geometry;
}

/** A smile: the bottom half of a thin torus, so no texture is needed. */
function smileGeometry(radius: number, tube: number) {
  return new THREE.TorusGeometry(radius, tube, 8, 20, Math.PI);
}

/* ------------------------------------------------------------------ */
/* Shared geometry set                                                 */
/* ------------------------------------------------------------------ */

export type RobotGeometry = {
  torso: THREE.BufferGeometry;
  chestPlate: THREE.BufferGeometry;
  chestCore: THREE.BufferGeometry;
  collar: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  visor: THREE.BufferGeometry;
  eye: THREE.BufferGeometry;
  eyeGlint: THREE.BufferGeometry;
  smile: THREE.BufferGeometry;
  cheek: THREE.BufferGeometry;
  earPod: THREE.BufferGeometry;
  antennaStem: THREE.BufferGeometry;
  antennaTip: THREE.BufferGeometry;
  shoulder: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  elbow: THREE.BufferGeometry;
  foreArm: THREE.BufferGeometry;
  hand: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  foot: THREE.BufferGeometry;
  heart: THREE.BufferGeometry;
  hatCone: THREE.BufferGeometry;
  hatBrim: THREE.BufferGeometry;
  pompom: THREE.BufferGeometry;
  circlet: THREE.BufferGeometry;
  gem: THREE.BufferGeometry;
  halo: THREE.BufferGeometry;
  dish: THREE.BufferGeometry;
  dishStem: THREE.BufferGeometry;
  stud: THREE.BufferGeometry;
};

function createGeometry(): RobotGeometry {
  return {
    torso: roundedBoxGeometry(0.8, 0.74, 0.62, 0.24),
    chestPlate: roundedBoxGeometry(0.46, 0.36, 0.12, 0.12),
    chestCore: new THREE.SphereGeometry(0.085, 20, 14),
    collar: new THREE.TorusGeometry(0.155, 0.042, 8, 28),
    neck: new THREE.CylinderGeometry(0.1, 0.105, 0.12, 16),
    head: roundedBoxGeometry(0.64, 0.58, 0.56, 0.2),
    visor: new THREE.SphereGeometry(0.3, 28, 20),
    eye: new THREE.SphereGeometry(0.072, 20, 14),
    eyeGlint: new THREE.SphereGeometry(0.02, 10, 8),
    smile: smileGeometry(0.075, 0.014),
    cheek: new THREE.SphereGeometry(0.045, 14, 10),
    earPod: new THREE.CylinderGeometry(0.095, 0.095, 0.075, 18),
    antennaStem: new THREE.CylinderGeometry(0.013, 0.019, 0.15, 8),
    antennaTip: new THREE.SphereGeometry(0.042, 14, 10),
    shoulder: new THREE.SphereGeometry(0.115, 20, 14),
    upperArm: new THREE.CapsuleGeometry(0.078, 0.17, 4, 14),
    elbow: new THREE.SphereGeometry(0.068, 16, 12),
    foreArm: new THREE.CapsuleGeometry(0.068, 0.15, 4, 14),
    hand: new THREE.SphereGeometry(0.095, 20, 14),
    leg: new THREE.CapsuleGeometry(0.095, 0.16, 4, 14),
    foot: roundedBoxGeometry(0.27, 0.15, 0.38, 0.07),
    heart: heartGeometry(0.3),
    hatCone: new THREE.CylinderGeometry(0.015, 0.17, 0.26, 20),
    hatBrim: new THREE.TorusGeometry(0.175, 0.022, 8, 24),
    pompom: new THREE.SphereGeometry(0.045, 14, 10),
    circlet: new THREE.TorusGeometry(0.26, 0.02, 8, 32),
    gem: new THREE.OctahedronGeometry(0.055, 0),
    halo: new THREE.TorusGeometry(0.24, 0.026, 10, 32),
    dish: new THREE.CylinderGeometry(0.1, 0.1, 0.028, 16),
    dishStem: new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
    stud: new THREE.SphereGeometry(0.035, 12, 8),
  };
}

/* ------------------------------------------------------------------ */
/* Shared material set                                                 */
/* ------------------------------------------------------------------ */

export type RobotMaterial = {
  shell: THREE.MeshPhysicalMaterial;
  panel: THREE.MeshStandardMaterial;
  visor: THREE.MeshPhysicalMaterial;
  joint: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  blush: THREE.MeshStandardMaterial;
  accessory: THREE.MeshStandardMaterial;
  /** Unlit specular dot in the eyes — always bright, never washed out. */
  glint: THREE.MeshBasicMaterial;
};

const GLOW_BASE = "#0b0a14";

function createMaterials(styleId: BirthdayStyleId): RobotMaterial {
  const p = robotProfile(styleId);
  return {
    /* Soft premium shell: a clearcoat over a fairly diffuse base. */
    shell: new THREE.MeshPhysicalMaterial({
      color: p.shell,
      roughness: p.roughness,
      metalness: p.metalness,
      clearcoat: p.clearcoat,
      clearcoatRoughness: 0.28,
    }),
    panel: new THREE.MeshStandardMaterial({
      color: p.panel,
      roughness: Math.min(1, p.roughness + 0.1),
      metalness: p.metalness * 0.7,
    }),
    /* Glossy face plate — reads as a screen, keeps the eyes readable. */
    visor: new THREE.MeshPhysicalMaterial({
      color: p.visor,
      roughness: 0.16,
      metalness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    joint: new THREE.MeshStandardMaterial({
      color: p.joint,
      roughness: 0.55,
      metalness: 0.35,
    }),
    /* Metal trim. There is no environment map in the stage, so the trim keeps
       a small self-lit floor under its metalness — gold stays gold instead of
       collapsing to black away from a specular highlight. */
    metal: new THREE.MeshStandardMaterial({
      color: p.metal,
      emissive: p.metal,
      emissiveIntensity: 0.1,
      roughness: 0.28,
      metalness: 0.75,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: GLOW_BASE,
      emissive: p.eye,
      emissiveIntensity: p.emissive * 1.35,
      roughness: 0.3,
      metalness: 0.1,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: GLOW_BASE,
      emissive: p.accent,
      emissiveIntensity: p.emissive,
      roughness: 0.35,
      metalness: 0.15,
    }),
    blush: new THREE.MeshStandardMaterial({
      color: p.blush,
      emissive: p.blush,
      emissiveIntensity: 0.4,
      roughness: 0.7,
      metalness: 0.05,
    }),
    accessory: new THREE.MeshStandardMaterial({
      color: p.accessoryColor,
      emissive: p.accessoryColor,
      emissiveIntensity: p.accessoryEmissive,
      roughness: 0.3,
      metalness: 0.25,
    }),
    glint: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.92 }),
  };
}

export type RobotAssets = {
  geo: RobotGeometry;
  mat: RobotMaterial;
};

function createAssets(styleId: BirthdayStyleId): RobotAssets {
  return { geo: createGeometry(), mat: createMaterials(styleId) };
}

function disposeAssets(assets: RobotAssets) {
  for (const geometry of Object.values(assets.geo)) geometry.dispose();
  for (const material of Object.values(assets.mat)) material.dispose();
}

/**
 * Build the shared geometry + material set for a style, and dispose it when the
 * robot unmounts or the style changes.
 *
 * The hook also owns the emissive "life" of the glow and eye materials: they are
 * created here, so they are also the ones animated here — the component tree
 * stays purely declarative and never mutates an asset after render.
 */
export function useRobotAssets(styleId: BirthdayStyleId, motionEnabled: boolean): RobotAssets {
  const assets = useMemo(() => createAssets(styleId), [styleId]);
  const motion = useMotionRef(motionEnabled);
  const baseEmissive = robotProfile(styleId).emissive;
  /* The materials come out of a hook, and React's immutability rules forbid the
     render loop writing to a hook result directly. Holding them in a ref makes
     the pulse a normal imperative write against mutable state. */
  const mats = useRef(assets.mat);

  useEffect(() => {
    mats.current = assets.mat;
  }, [assets]);

  useEffect(() => () => disposeAssets(assets), [assets]);

  useFrame((state) => {
    if (!motion.current) return;
    const t = state.clock.elapsedTime;
    /* Two shared materials, so one pulse keeps the chest core, antenna tip and
       smile in step. Kept shallow: this is a resting character, not a show. */
    mats.current.glow.emissiveIntensity = baseEmissive * (0.92 + 0.16 * (0.5 + 0.5 * Math.sin(t * 1.9)));
    mats.current.eye.emissiveIntensity = baseEmissive * 1.35 * (0.97 + 0.06 * Math.sin(t * 1.3));
  });

  return assets;
}
