import { memo, useMemo } from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlights query tokens inside text (Amazon-style). */
function SearchHighlightInner({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ str: text, hl: false }];
    const tokens = Array.from(
      new Set(
        q
          .toLowerCase()
          .split(/\s+/)
          .map(t => t.replace(/[^a-z0-9]/gi, ""))
          .filter(t => t.length > 1)
      )
    );
    if (!tokens.length) return [{ str: text, hl: false }];
    const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
    const out: { str: string; hl: boolean }[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const copy = new RegExp(re.source, re.flags);
    while ((m = copy.exec(text)) !== null) {
      if (m.index > last) out.push({ str: text.slice(last, m.index), hl: false });
      out.push({ str: m[0], hl: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ str: text.slice(last), hl: false });
    return out.length ? out : [{ str: text, hl: false }];
  }, [text, query]);

  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <mark
            key={i}
            className="bg-primary/25 text-foreground font-semibold px-0.5 rounded-sm not-italic"
          >
            {p.str}
          </mark>
        ) : (
          <span key={i}>{p.str}</span>
        )
      )}
    </>
  );
}

export const SearchHighlight = memo(SearchHighlightInner);
