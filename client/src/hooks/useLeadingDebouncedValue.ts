import { useEffect, useState } from "react";

/**
 * Debounce with leading edge after empty: first non-empty query updates immediately,
 * further typing waits `delayMs`. Clearing the query resets instantly.
 */
export function useLeadingDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;

    if (value.trim() === "") {
      setDebounced("");
      return;
    }

    if (debounced.trim() === "") {
      setDebounced(value);
      return;
    }

    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, debounced, delayMs]);

  return debounced;
}
