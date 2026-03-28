/**
 * Subtle Vibration API feedback for touch-first commerce actions.
 * No-ops when unsupported, reduced-motion is on, or device is not touch-oriented.
 */

export type HapticKind = "light" | "confirm" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  /** Add to cart and similar single taps */
  light: 10,
  /** Payment method change, checkout handoff */
  confirm: [10, 30, 10],
  /** Brief pulse after an error is already surfaced in the UI */
  error: 12,
};

function mayUseVibrate(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false;
  }
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  } catch {
    /* ignore */
  }
  try {
    return (
      "ontouchstart" in window || window.matchMedia?.("(pointer: coarse)").matches === true
    );
  } catch {
    return false;
  }
}

/** Safe no-op on desktop, unsupported browsers, or reduced-motion. */
export function triggerHaptic(kind: HapticKind): void {
  if (!mayUseVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* Some browsers expose vibrate but reject certain patterns */
  }
}
