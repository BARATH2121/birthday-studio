import { Color } from "three";
import type { BirthdayStyleId } from "@/lib/birthday";

/*
 * Phase 4A — theme bridge between the existing CSS design tokens and the real
 * three.js world.
 *
 * The stage owns a single source of truth for each style's palette: the CSS
 * custom properties declared on `.bp-stage` (--bp-orb-a, --bp-orb-b,
 * --bp-dust, --bp-floor-pool). The 3D scene reads those resolved values from
 * the mounted stage element so the WebGL world and the CSS fallback can never
 * drift apart. The fallback palettes below are only used if the browser
 * returns an unparseable value (they match the CSS defaults).
 */

export type WorldTheme = {
  styleId: BirthdayStyleId;
  /** Primary glow / key light (--bp-orb-a). */
  key: Color;
  /** Secondary glow / rim light (--bp-orb-b). */
  accent: Color;
  /** Floating dust / particle colour (--bp-dust). */
  particle: Color;
  /** Soft pool under the subject (--bp-floor-pool). */
  floorPool: Color;
  /** Environment tint used to shade surfaces and shadows. */
  tint: Color;
};

type Palette = {
  key: string;
  accent: string;
  particle: string;
  floorPool: string;
  tint: string;
};

const DEFAULT_PALETTES: Record<BirthdayStyleId, Palette> = {
  romantic: {
    key: "#ff4d97",
    accent: "#a855f7",
    particle: "#ff9abe",
    floorPool: "#ff7ab0",
    tint: "#231130",
  },
  "cute-colorful": {
    key: "#ffb347",
    accent: "#6ba3ff",
    particle: "#ffd27a",
    floorPool: "#ff7ab0",
    tint: "#1f2440",
  },
  elegant: {
    key: "#d6b27a",
    accent: "#9a9abe",
    particle: "#e8cf9a",
    floorPool: "#d6b27a",
    tint: "#191a24",
  },
  "fun-crazy": {
    key: "#ff2d95",
    accent: "#22d3ee",
    particle: "#ffd23f",
    floorPool: "#ffd23f",
    tint: "#1d1a2e",
  },
  cinematic: {
    key: "#3b7bff",
    accent: "#8b5cf6",
    particle: "#93b4ff",
    floorPool: "#3b7bff",
    tint: "#11152b",
  },
};

/**
 * Parse a CSS colour value as authored in the stylesheet. Handles `#hex` and
 * the `rgb(r g b / a)` space-separated syntax used by the design tokens.
 */
export function colorFromCss(input: string | null, fallback: string): Color {
  const text = (input ?? "").trim();
  if (text.startsWith("#")) {
    try {
      return new Color(text);
    } catch {
      return new Color(fallback);
    }
  }
  const numbers = text.match(/(-?\d+(?:\.\d+)?)/g);
  if (!numbers || numbers.length < 3) return new Color(fallback);
  const r = Number.parseFloat(numbers[0]);
  const g = Number.parseFloat(numbers[1]);
  const b = Number.parseFloat(numbers[2]);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return new Color(fallback);
  }
  const scale = Math.max(r, g, b) > 1 ? 255 : 1;
  return new Color(r / scale, g / scale, b / scale);
}

/**
 * Resolve the theme for a mounted `.bp-stage` element. Must run on the client
 * after the stage is attached to the DOM.
 */
export function readWorldTheme(el: HTMLElement, styleId: BirthdayStyleId): WorldTheme {
  const cs = window.getComputedStyle(el);
  const palette = DEFAULT_PALETTES[styleId];
  const read = (prop: string, fallback: string) => colorFromCss(cs.getPropertyValue(prop), fallback);
  return {
    styleId,
    key: read("--bp-orb-a", palette.key),
    accent: read("--bp-orb-b", palette.accent),
    particle: read("--bp-dust", palette.particle),
    floorPool: read("--bp-floor-pool", palette.floorPool),
    tint: new Color(palette.tint),
  };
}

export function toHex(color: Color): string {
  return `#${color.getHexString()}`;
}