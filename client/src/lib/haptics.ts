/**
 * Subtle Vibration API feedback for commerce actions (user-gesture handlers only).
 *
 * - **iOS Safari / WebKit**: `navigator.vibrate` is not supported — there is no web haptic API;
 *   this helper no-ops. Use a physical Android device or Android Chrome to verify buzz.
 * - **Desktop**: usually no motor; `vibrate` may exist but does nothing — safe no-op.
 * - **Android Chrome** (!(typical)): works via `navigator.vibrate` on HTTPS (or localhost).
 */

export type HapticKind = "light" | "confirm" | "error";

/** Durations in ms; many motors ignore very short pulses, so keep these slightly longer for reliability. */
const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 20,
  confirm: [20, 45, 20],
  error: 25,
};

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function vibrateSafe(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    const ok = navigator.vibrate(pattern);
    if (ok === false && Array.isArray(pattern)) {
      navigator.vibrate(25);
    }
  } catch {
    try {
      const fallback = typeof pattern === "number" ? pattern : 25;
      navigator.vibrate(Math.min(50, Math.max(15, fallback)));
    } catch {
      /* silent */
    }
  }
}

/** No-op when `vibrate` missing, reduced-motion, or platform cannot buzz (e.g. iOS Safari). */
export function triggerHaptic(kind: HapticKind): void {
  if (reducedMotion()) return;
  vibrateSafe(PATTERNS[kind]);
}
