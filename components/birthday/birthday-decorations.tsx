import type { DecorationKind } from "./style-theme";

type Drift = "float" | "sway" | "pop";

type Glyph = {
  glyph: string;
  left: string;
  top: string;
  size: number;
  drift: Drift;
  delay: string;
  opacity: number;
};

type DecorationSet = {
  layers: "spotlight" | "vignette" | "none";
  glyphs: Glyph[];
};

const SETS: Record<DecorationKind, DecorationSet> = {
  hearts: {
    layers: "none",
    glyphs: [
      { glyph: "♥", left: "8%", top: "12%", size: 18, drift: "float", delay: "0s", opacity: 0.3 },
      { glyph: "♥", left: "84%", top: "18%", size: 13, drift: "sway", delay: "1.2s", opacity: 0.26 },
      { glyph: "♡", left: "16%", top: "72%", size: 15, drift: "sway", delay: "2.1s", opacity: 0.2 },
      { glyph: "♥", left: "74%", top: "64%", size: 20, drift: "float", delay: "0.6s", opacity: 0.18 },
      { glyph: "♡", left: "46%", top: "6%", size: 12, drift: "float", delay: "1.8s", opacity: 0.22 },
      { glyph: "♥", left: "90%", top: "46%", size: 11, drift: "sway", delay: "2.6s", opacity: 0.2 },
    ],
  },
  balloons: {
    layers: "none",
    glyphs: [
      { glyph: "🎈", left: "6%", top: "8%", size: 20, drift: "float", delay: "0s", opacity: 0.42 },
      { glyph: "🎀", left: "80%", top: "12%", size: 18, drift: "sway", delay: "0.9s", opacity: 0.42 },
      { glyph: "🎈", left: "12%", top: "64%", size: 15, drift: "sway", delay: "1.7s", opacity: 0.34 },
      { glyph: "🍭", left: "78%", top: "58%", size: 16, drift: "float", delay: "2.4s", opacity: 0.32 },
      { glyph: "✨", left: "40%", top: "4%", size: 13, drift: "pop", delay: "0.4s", opacity: 0.34 },
      { glyph: "🎀", left: "60%", top: "86%", size: 14, drift: "sway", delay: "2.9s", opacity: 0.28 },
    ],
  },
  minimal: {
    layers: "none",
    glyphs: [
      { glyph: "✦", left: "12%", top: "14%", size: 12, drift: "sway", delay: "0s", opacity: 0.3 },
      { glyph: "✧", left: "86%", top: "20%", size: 11, drift: "sway", delay: "1.5s", opacity: 0.26 },
      { glyph: "—", left: "20%", top: "84%", size: 14, drift: "float", delay: "0.8s", opacity: 0.24 },
      { glyph: "—", left: "68%", top: "80%", size: 14, drift: "float", delay: "2s", opacity: 0.24 },
      { glyph: "✦", left: "50%", top: "92%", size: 10, drift: "sway", delay: "2.6s", opacity: 0.22 },
    ],
  },
  confetti: {
    layers: "none",
    glyphs: [
      { glyph: "●", left: "6%", top: "10%", size: 12, drift: "pop", delay: "0s", opacity: 0.5 },
      { glyph: "▲", left: "22%", top: "6%", size: 11, drift: "pop", delay: "0.3s", opacity: 0.45 },
      { glyph: "★", left: "82%", top: "14%", size: 14, drift: "sway", delay: "0.6s", opacity: 0.45 },
      { glyph: "■", left: "64%", top: "5%", size: 10, drift: "pop", delay: "0.9s", opacity: 0.4 },
      { glyph: "●", left: "88%", top: "52%", size: 11, drift: "pop", delay: "1.4s", opacity: 0.42 },
      { glyph: "▲", left: "10%", top: "62%", size: 12, drift: "pop", delay: "1.8s", opacity: 0.4 },
      { glyph: "■", left: "30%", top: "88%", size: 10, drift: "pop", delay: "2.2s", opacity: 0.36 },
      { glyph: "★", left: "70%", top: "80%", size: 13, drift: "sway", delay: "2.7s", opacity: 0.4 },
    ],
  },
  spotlight: {
    layers: "spotlight",
    glyphs: [],
  },
};

const DRIFT_CLASS: Record<Drift, string> = {
  float: "bp-float",
  sway: "bp-sway",
  pop: "bp-pop",
};

export default function BirthdayDecorations({ kind }: { kind: DecorationKind }) {
  const { layers, glyphs } = SETS[kind];

  return (
    <div className="bp-decor" aria-hidden="true">
      {layers === "spotlight" ? <span className="bp-spotlight bp-drift" /> : null}

      {glyphs.map((piece, index) => (
        <span
          key={`${kind}-${index}`}
          className={DRIFT_CLASS[piece.drift]}
          style={{
            left: piece.left,
            top: piece.top,
            fontSize: `${piece.size}px`,
            opacity: piece.opacity,
            animationDelay: piece.delay,
          }}
        >
          {piece.glyph}
        </span>
      ))}
    </div>
  );
}
