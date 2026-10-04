export type NavItem = {
  label: string;
  href: string;
};

export type Step = {
  number: string;
  title: string;
  description: string;
  vibes?: readonly string[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Preview", href: "/#preview" },
  { label: "How it works", href: "/#how-it-works" },
];

export const HERO_HIGHLIGHTS: readonly string[] = [
  "Built around their name",
  "Looks great on any phone",
  "Shared with one link",
];

export const STEPS: readonly Step[] = [
  {
    number: "01",
    title: "Tell us about them",
    description:
      "Add the birthday person's name, relationship, message and memories — everything that makes them, them.",
  },
  {
    number: "02",
    title: "Choose the vibe",
    description:
      "Pick the mood that fits your relationship. Every vibe reshapes colors, motion and type across the page.",
    vibes: ["Romantic", "Cute & Colorful", "Elegant", "Fun & Crazy", "Cinematic"],
  },
  {
    number: "03",
    title: "Share the surprise",
    description:
      "Preview the experience exactly as they will see it, then share a personal birthday page they can open anywhere.",
  },
];
