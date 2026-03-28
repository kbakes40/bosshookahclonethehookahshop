import type { ProductVariant } from "./products";

export type ShishaVariantGroup = {
  /** Grams for sort order; null only for "Other" bucket */
  grams: number | null;
  heading: string;
  variants: ProductVariant[];
};

/**
 * Parse pack weight from storefront variant labels (THS imports, etc.).
 * Examples: "Apple, Pack Size: 1000G", "1000G, Flavors: Blue Mist", "250G"
 */
export function parsePackSizeGrams(variantLabel: string): number | null {
  const n = variantLabel.trim();
  if (!n) return null;

  const pack = /pack\s*size:\s*(\d+(?:\.\d+)?)\s*(g|kg)\b/i.exec(n);
  if (pack) {
    const v = parseFloat(pack[1]!);
    if (!Number.isFinite(v)) return null;
    return /kg/i.test(pack[2]!) ? Math.round(v * 1000) : Math.round(v);
  }

  const lead = /^(\d+(?:\.\d+)?)\s*(g|kg)\s*,/i.exec(n);
  if (lead) {
    const v = parseFloat(lead[1]!);
    if (!Number.isFinite(v)) return null;
    return /kg/i.test(lead[2]!) ? Math.round(v * 1000) : Math.round(v);
  }

  const onlySize = /^(\d+(?:\.\d+)?)\s*(g|kg)\s*$/i.exec(n);
  if (onlySize) {
    const v = parseFloat(onlySize[1]!);
    if (!Number.isFinite(v)) return null;
    return /kg/i.test(onlySize[2]!) ? Math.round(v * 1000) : Math.round(v);
  }

  const tail = /\b(\d+)\s*g\s*$/i.exec(n);
  if (tail) return parseInt(tail[1]!, 10);

  return null;
}

export function formatPackSizeHeading(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000}kg`;
  return `${grams}g`;
}

/**
 * Returns grouped variants for shisha PDP, or null if every variant lacks a parseable size
 * (caller should render a flat list).
 */
export function groupShishaVariantsByPackSize(variants: ProductVariant[]): ShishaVariantGroup[] | null {
  if (!variants.length) return null;

  const parsed = variants.map(v => ({ v, grams: parsePackSizeGrams(v.name) }));
  if (parsed.every(p => p.grams == null)) return null;

  const byGram = new Map<number, ProductVariant[]>();
  const other: ProductVariant[] = [];

  for (const { v, grams } of parsed) {
    if (grams == null) other.push(v);
    else {
      const list = byGram.get(grams) ?? [];
      list.push(v);
      byGram.set(grams, list);
    }
  }

  const sortName = (a: ProductVariant, b: ProductVariant) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  const sortedGrams = Array.from(byGram.keys()).sort((a, b) => a - b);
  const out: ShishaVariantGroup[] = sortedGrams.map(g => ({
    grams: g,
    heading: formatPackSizeHeading(g),
    variants: (byGram.get(g) ?? []).sort(sortName),
  }));

  if (other.length > 0) {
    out.push({
      grams: null,
      heading: "More options",
      variants: other.sort(sortName),
    });
  }

  return out;
}

/** Visual order for default selection (smallest pack first, then name). */
export function orderedShishaVariants(variants: ProductVariant[]): ProductVariant[] {
  const groups = groupShishaVariantsByPackSize(variants);
  if (groups) return groups.flatMap(g => g.variants);
  return variants;
}
