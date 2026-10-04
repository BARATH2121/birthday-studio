import type { BirthdayStyleId } from "@/lib/birthday";

/*
 * Phase 4B — the robot's style-aware visual identity.
 *
 * The robot is a single reusable character; the five birthday styles only
 * change how it *looks*: shell colours, face colours, material response and
 * one small accessory. This module is pure data (no three.js, no React) so the
 * palette can be reasoned about (and reviewed) on its own, and so the later
 * per-style worlds in Phase 4C can extend it without touching the character.
 *
 * `WorldTheme` (world-theme.ts) still owns the *lighting* palette read from
 * the CSS tokens; these profiles own the *character* palette.
 */

export type RobotAccessoryKind = "heart" | "party-hat" | "circlet" | "halo" | "explorer-dish";

export type RobotProfile = {
  id: BirthdayStyleId;
  /** Main shell: head, torso, limbs. */
  shell: string;
  /** Secondary shell: chest plate, ear pods, hat brim, halo band. */
  panel: string;
  /** Face plate. */
  visor: string;
  /** Emissive eye colour. */
  eye: string;
  /** Emissive accent: chest core, antenna tip, mouth. */
  accent: string;
  /** Soft emissive cheeks. */
  blush: string;
  /** Joints and seams: elbows, knees, neck. */
  joint: string;
  /** Metal trim: collar ring, ear studs, circlet. */
  metal: string;
  accessory: RobotAccessoryKind;
  accessoryColor: string;
  /** Emissive strength of the accessory (0 = plain painted plastic). */
  accessoryEmissive: number;
  roughness: number;
  metalness: number;
  /** Physical clearcoat on the shell — the "soft premium" read. */
  clearcoat: number;
  /** Base emissive strength for eyes / core / tip. */
  emissive: number;
};

const PROFILES: Record<BirthdayStyleId, RobotProfile> = {
  /* Pink, blush, magenta, soft purple — softer materials, glowing heart. */
  romantic: {
    id: "romantic",
    shell: "#ffd9ec",
    panel: "#ff9ecb",
    visor: "#2b1033",
    eye: "#ff5fa8",
    accent: "#ff4d97",
    blush: "#ff8fb8",
    joint: "#f7b9d8",
    metal: "#ffd6ea",
    accessory: "heart",
    accessoryColor: "#ff4d97",
    accessoryEmissive: 1.5,
    roughness: 0.42,
    metalness: 0.12,
    clearcoat: 0.7,
    emissive: 1.15,
  },

  /* Cyan, blue, pink, purple, yellow — bright and playful, party hat. */
  "cute-colorful": {
    id: "cute-colorful",
    shell: "#8fe9ff",
    panel: "#ffd23f",
    visor: "#12204a",
    eye: "#66e0ff",
    accent: "#ffb347",
    blush: "#ff7ab0",
    joint: "#bff0ff",
    metal: "#ffe9a8",
    accessory: "party-hat",
    accessoryColor: "#ff7ab0",
    accessoryEmissive: 0.5,
    roughness: 0.36,
    metalness: 0.18,
    clearcoat: 0.6,
    emissive: 1.2,
  },

  /* Black, charcoal, gold, champagne — noticeably metallic, gold circlet. */
  elegant: {
    id: "elegant",
    shell: "#2a2c3a",
    panel: "#1b1d26",
    visor: "#0b0c12",
    eye: "#f0dcae",
    accent: "#d6b27a",
    blush: "#7a5f6b",
    joint: "#141620",
    metal: "#e8cf9a",
    accessory: "circlet",
    accessoryColor: "#e8cf9a",
    accessoryEmissive: 0.35,
    roughness: 0.26,
    metalness: 0.62,
    clearcoat: 0.35,
    emissive: 0.9,
  },

  /* Neon blue, cyan, pink, purple — strongest emissive accents, neon halo. */
  "fun-crazy": {
    id: "fun-crazy",
    shell: "#3a2f8f",
    panel: "#22d3ee",
    visor: "#120a2e",
    eye: "#22d3ee",
    accent: "#ff2d95",
    blush: "#ff2d95",
    joint: "#5b4bd0",
    metal: "#9ad9ff",
    accessory: "halo",
    accessoryColor: "#22d3ee",
    accessoryEmissive: 2.2,
    roughness: 0.3,
    metalness: 0.35,
    clearcoat: 0.5,
    emissive: 1.9,
  },

  /* Midnight blue, steel blue, purple, white — restrained, explorer dish. */
  cinematic: {
    id: "cinematic",
    shell: "#4d6296",
    panel: "#2b3a63",
    visor: "#0c1226",
    eye: "#a8c4ff",
    accent: "#8b5cf6",
    blush: "#55688f",
    joint: "#1e2740",
    metal: "#dfe6ff",
    accessory: "explorer-dish",
    accessoryColor: "#c9d6ff",
    accessoryEmissive: 0.5,
    roughness: 0.34,
    metalness: 0.5,
    clearcoat: 0.45,
    emissive: 0.95,
  },
};

export function robotProfile(id: BirthdayStyleId): RobotProfile {
  return PROFILES[id] ?? PROFILES.romantic;
}
