const KEY = "ths-store-recent-searches";
const MAX = 8;

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string): void {
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const prev = loadRecentSearches().filter(s => s.toLowerCase() !== t.toLowerCase());
    const next = [t, ...prev].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
