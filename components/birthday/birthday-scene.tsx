"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { StyleTheme } from "./style-theme";
import BirthdayWorld from "@/components/birthday/three/birthday-world";
import { readWorldTheme, type WorldTheme } from "@/components/birthday/three/world-theme";

/*
 * The hero stage for the birthday experience.
 *
 * Phase 4A architecture: the stage is a smart host for a real three.js world.
 * On the server (and on any client without WebGL) it renders the designed CSS
 * atmosphere: layered light, a drifting particle field and a character mount.
 * On capable clients it mounts a real R3F `<Canvas>` into the same slot, with
 * the CSS tokens read at runtime (`readWorldTheme`) so the 3D world uses the
 * exact same per-style palette as the fallback.
 *
 * The whole stage is decorative, so it is hidden from assistive tech and never
 * receives interaction.
 */

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

const subscribeNoop = (): (() => void) => () => {};

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Particle = {
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
};

/* Deterministic dust fields, tuned per style so each world reads differently. */
const FIELDS: Record<StyleTheme["id"], readonly Particle[]> = {
  romantic: [
    { left: "6%", top: "58%", size: 5, delay: "0s", duration: "9s", opacity: 0.7 },
    { left: "14%", top: "34%", size: 3, delay: "1.2s", duration: "11s", opacity: 0.5 },
    { left: "26%", top: "70%", size: 6, delay: "0.6s", duration: "8s", opacity: 0.6 },
    { left: "38%", top: "28%", size: 4, delay: "2s", duration: "12s", opacity: 0.55 },
    { left: "55%", top: "62%", size: 5, delay: "0.3s", duration: "10s", opacity: 0.7 },
    { left: "68%", top: "38%", size: 3, delay: "1.6s", duration: "9s", opacity: 0.5 },
    { left: "80%", top: "66%", size: 6, delay: "0.9s", duration: "11s", opacity: 0.6 },
    { left: "90%", top: "40%", size: 4, delay: "2.4s", duration: "8s", opacity: 0.55 },
  ],
  "cute-colorful": [
    { left: "9%", top: "52%", size: 6, delay: "0s", duration: "8s", opacity: 0.8 },
    { left: "18%", top: "76%", size: 4, delay: "1s", duration: "9s", opacity: 0.6 },
    { left: "30%", top: "38%", size: 5, delay: "0.5s", duration: "10s", opacity: 0.7 },
    { left: "44%", top: "64%", size: 7, delay: "1.8s", duration: "7s", opacity: 0.8 },
    { left: "58%", top: "30%", size: 4, delay: "2.2s", duration: "11s", opacity: 0.6 },
    { left: "70%", top: "58%", size: 6, delay: "0.7s", duration: "9s", opacity: 0.75 },
    { left: "82%", top: "36%", size: 5, delay: "1.4s", duration: "8s", opacity: 0.65 },
    { left: "91%", top: "70%", size: 4, delay: "2.6s", duration: "10s", opacity: 0.55 },
  ],
  elegant: [
    { left: "8%", top: "60%", size: 4, delay: "0s", duration: "12s", opacity: 0.5 },
    { left: "20%", top: "40%", size: 3, delay: "1.5s", duration: "14s", opacity: 0.45 },
    { left: "34%", top: "66%", size: 5, delay: "0.8s", duration: "11s", opacity: 0.55 },
    { left: "48%", top: "34%", size: 3, delay: "2.2s", duration: "13s", opacity: 0.4 },
    { left: "62%", top: "58%", size: 4, delay: "0.4s", duration: "12s", opacity: 0.5 },
    { left: "76%", top: "42%", size: 3, delay: "1.9s", duration: "10s", opacity: 0.45 },
    { left: "87%", top: "64%", size: 5, delay: "1.1s", duration: "13s", opacity: 0.5 },
    { left: "94%", top: "38%", size: 3, delay: "2.7s", duration: "11s", opacity: 0.4 },
  ],
  "fun-crazy": [
    { left: "5%", top: "54%", size: 6, delay: "0s", duration: "7s", opacity: 0.85 },
    { left: "12%", top: "78%", size: 4, delay: "0.4s", duration: "8s", opacity: 0.7 },
    { left: "24%", top: "34%", size: 7, delay: "1.2s", duration: "6s", opacity: 0.8 },
    { left: "40%", top: "68%", size: 5, delay: "0.2s", duration: "9s", opacity: 0.85 },
    { left: "52%", top: "28%", size: 6, delay: "1.8s", duration: "7s", opacity: 0.75 },
    { left: "66%", top: "60%", size: 7, delay: "0.9s", duration: "6s", opacity: 0.85 },
    { left: "80%", top: "36%", size: 5, delay: "2.4s", duration: "8s", opacity: 0.7 },
    { left: "92%", top: "72%", size: 6, delay: "0.6s", duration: "7s", opacity: 0.8 },
  ],
  cinematic: [
    { left: "7%", top: "56%", size: 3, delay: "0s", duration: "11s", opacity: 0.55 },
    { left: "16%", top: "36%", size: 4, delay: "1.3s", duration: "13s", opacity: 0.5 },
    { left: "28%", top: "68%", size: 3, delay: "0.7s", duration: "12s", opacity: 0.6 },
    { left: "42%", top: "30%", size: 5, delay: "2s", duration: "10s", opacity: 0.5 },
    { left: "56%", top: "60%", size: 4, delay: "0.5s", duration: "13s", opacity: 0.55 },
    { left: "70%", top: "40%", size: 3, delay: "1.7s", duration: "11s", opacity: 0.5 },
    { left: "84%", top: "62%", size: 5, delay: "1s", duration: "12s", opacity: 0.6 },
    { left: "93%", top: "44%", size: 3, delay: "2.5s", duration: "10s", opacity: 0.45 },
  ],
};

function CssStage({ theme }: { theme: StyleTheme }) {
  const field = FIELDS[theme.id] ?? FIELDS.romantic;

  return (
    <>
      <span className="bp-stage-light bp-stage-light-a" />
      <span className="bp-stage-light bp-stage-light-b" />
      <span className="bp-stage-wash" />

      <div className="bp-stage-particles">
        {field.map((p, index) => (
          <span
            key={index}
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      <div className="bp-stage-mount" data-stage-mount>
        <span className="bp-stage-halo" />
        <span className="bp-stage-core">
          <span className="bp-stage-emoji">{theme.emoji}</span>
        </span>
      </div>

      <span className="bp-stage-floor" />
    </>
  );
}

export default function BirthdayScene({ theme }: { theme: StyleTheme }) {
  const stageRef = useRef<HTMLDivElement>(null);

  /* Client-only gating without effects: the first render matches the SSR
     fallback markup, then hydration flips these snapshots to true and the
     real Canvas mounts — never a hydration mismatch. */
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );

  const webgl = useMemo(() => (mounted ? canUseWebGL() : false), [mounted]);

  /* Computed styles can only be read after the stage mounts on the client. */
  const [worldTheme, setWorldTheme] = useState<WorldTheme | null>(null);
  useEffect(() => {
    if (!mounted || !stageRef.current) return;
    setWorldTheme(readWorldTheme(stageRef.current, theme.id));
  }, [mounted, theme.id]);

  const show3d = mounted && webgl && worldTheme !== null;

  return (
    <div
      ref={stageRef}
      className={show3d ? "bp-stage bp-stage--3d" : "bp-stage"}
      data-bstyle={theme.id}
      data-stage-mode={show3d ? "3d" : "css"}
      data-stage-state="ready"
      aria-hidden="true"
    >
      <CssStage theme={theme} />
      {show3d ? <BirthdayWorld key={theme.id} theme={worldTheme} motionEnabled={!reduceMotion} /> : null}
    </div>
  );
}