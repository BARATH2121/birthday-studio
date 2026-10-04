"use client";

import { useEffect, useRef } from "react";

/**
 * Read the current motion flag from inside animation callbacks without
 * re-subscribing on every change: the ref is updated in an effect, and the
 * render loop keeps reading the latest value.
 */
export function useMotionRef(enabled: boolean) {
  const ref = useRef(enabled);
  useEffect(() => {
    ref.current = enabled;
  }, [enabled]);
  return ref;
}
