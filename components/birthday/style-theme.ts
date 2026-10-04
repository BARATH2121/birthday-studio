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

export type StyleTheme = {
  id: BirthdayStyleId;
  name: string;
  emoji: string;
  decorations: DecorationKind;
  motion: MotionKind;
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
  };
}
