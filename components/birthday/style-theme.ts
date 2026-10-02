import { BIRTHDAY_STYLES, type BirthdayStyleId } from "@/lib/birthday";

export type DecorationKind =
  | "hearts"
  | "balloons"
  | "minimal"
  | "confetti"
  | "spotlight";

export type MotionKind =
  | "gentle"
  | "bouncy"
  | "smooth"
  | "energetic"
  | "cinematic";

/**
 * Which live 3D scene a style gets. Each scene is a small procedural sketch
 * that fills the birthday card and reacts to the cursor, so five styles read
 * as five different rooms rather than one background recoloured five times.
 */
export type SceneKind =
  | "petals"
  | "balloons"
  | "orbits"
  | "confetti"
  | "beam";

/** How many particles a scene uses. Keep the top end sensible for phones. */
export type SceneDensity = "low" | "medium" | "high";

export type SceneConfig = {
  kind: SceneKind;
  /** Colour seeds for the scene's particles and forms. */
  colors: readonly string[];
  /** Converts a capsule of the product's "mood" without changing its identity. */
  density: SceneDensity;
};

export type StyleTheme = {
  id: BirthdayStyleId;
  name: string;
  emoji: string;
  decorations: DecorationKind;
  motion: MotionKind;
  scene: SceneConfig;
};

const SCENES: Record<BirthdayStyleId, SceneConfig> = {
  romantic: {
    kind: "petals",
    colors: ["#ff7ab0", "#ff4d97", "#ffa3c9", "#fff1f7"],
    density: "medium",
  },
  "cute-colorful": {
    kind: "balloons",
    colors: ["#ff8fc0", "#6ba3ff", "#c084fc", "#ffd23f", "#7ce0b8"],
    density: "medium",
  },
  elegant: {
    kind: "orbits",
    colors: ["#f6ecd0", "#e8cf9a", "#c9a96a", "#ffffff"],
    density: "low",
  },
  "fun-crazy": {
    kind: "confetti",
    colors: ["#ff4d97", "#3b7bff", "#ffd23f", "#a855f7", "#ff7a3d", "#3ddc97"],
    density: "high",
  },
  cinematic: {
    kind: "beam",
    colors: ["#93b4ff", "#e2e8f0", "#5f7bd6", "#c8d6ff"],
    density: "medium",
  },
};

const DECORATIONS: Record<BirthdayStyleId, DecorationKind> = {
  romantic: "hearts",
  "cute-colorful": "balloons",
  elegant: "minimal",
  "fun-crazy": "confetti",
  cinematic: "spotlight",
};

const MOTIONS: Record<BirthdayStyleId, MotionKind> = {
  romantic: "gentle",
  "cute-colorful": "bouncy",
  elegant: "smooth",
  "fun-crazy": "energetic",
  cinematic: "cinematic",
};

/**
 * Step 4 is only reachable once a style is chosen, so this only guards
 * against an empty draft during the very first render.
 */
export function themeFor(style: BirthdayStyleId | "" | null | undefined): StyleTheme {
  const base = BIRTHDAY_STYLES.find((item) => item.id === style) ?? BIRTHDAY_STYLES[0];
  return {
    id: base.id,
    name: base.name,
    emoji: base.emoji,
    decorations: DECORATIONS[base.id],
    motion: MOTIONS[base.id],
    scene: SCENES[base.id],
  };
}
