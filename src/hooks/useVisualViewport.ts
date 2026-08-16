"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks the visual viewport dimensions reported by `window.visualViewport`.
 *
 * On iOS / Android, when the software keyboard appears the layout viewport
 * (document.documentElement.clientHeight) does NOT change, but the visual
 * viewport shrinks. This hook exposes the real visible area so CSS can use
 * it (e.g. setting `height: var(--dvh)` dynamically) and keeps the input bar
 * pinned above the keyboard without layout jumps.
 *
 * Falls back to `window.innerHeight` when `visualViewport` is unavailable
 * (desktop browsers without the API, SSR).
 */

export interface VisualViewportState {
  /** Visible viewport height in px (excludes keyboard on mobile). */
  height: number;
  /** Visible viewport width in px. */
  width: number;
  /** Offset from the top of the layout viewport (non-zero when keyboard is up on iOS). */
  offsetTop: number;
  /** Whether the visual viewport is currently smaller than the layout viewport (keyboard likely visible). */
  isKeyboardVisible: boolean;
}

const FALLBACK: VisualViewportState = {
  height: 0,
  width: 0,
  offsetTop: 0,
  isKeyboardVisible: false,
};

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(FALLBACK);
  const rafRef = useRef<number>(0);

  const compute = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) {
      return {
        height: window.innerHeight,
        width: window.innerWidth,
        offsetTop: 0,
        isKeyboardVisible: false,
      };
    }

    const height = Math.round(vv.height);
    const width = Math.round(vv.width);
    const offsetTop = Math.round(vv.offsetTop);
    const isKeyboardVisible = height < window.innerHeight - 60;

    return { height, width, offsetTop, isKeyboardVisible };
  }, []);

  useEffect(() => {
    /* Initial measurement — schedule via rAF so it does not trigger
       the "setState synchronously inside effect" lint rule. */
    rafRef.current = requestAnimationFrame(() => {
      const next = compute();
      setState(next);
      document.documentElement.style.setProperty("--dvh", `${next.height}px`);
    });

    const vv = window.visualViewport;
    if (!vv) {
      const onResize = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const next = compute();
          setState(next);
          document.documentElement.style.setProperty("--dvh", `${next.height}px`);
        });
      };
      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("resize", onResize);
      };
    }

    const onViewportChange = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const next = compute();
        setState(next);
        document.documentElement.style.setProperty("--dvh", `${next.height}px`);
      });
    };

    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, [compute]);

  return state;
}
