import type { Product } from "../client/src/lib/products";

export type StorefrontSort = "best-selling" | "price-low" | "price-high" | "newest";

/** Case-insensitive match so URL `/vapes` works even if a row has `Vapes`. */
export function categoryMatches(productCategory: string, filterCategory: string): boolean {
  const f = filterCategory.trim().toLowerCase();
  if (f === "" || f === "all") return true;
  return productCategory.trim().toLowerCase() === f;
}

export function filterProductsForGrid(
  products: Product[],
  opts: {
    category: string;
    brand?: string;
    priceMin: number;
    priceMax: number;
    showInStock: boolean;
    showOutOfStock: boolean;
  }
): Product[] {
  let list =
    opts.category === "all" || opts.category.trim() === ""
      ? [...products]
      : products.filter(p => categoryMatches(p.category, opts.category));

  if (opts.brand?.trim()) {
    const b = opts.brand.trim().toLowerCase();
    list = list.filter(p => p.brand.toLowerCase() === b);
  }

  list = list.filter(p => {
    const price = p.salePrice ?? p.price;
    return price >= opts.priceMin && price <= opts.priceMax;
  });

  if (opts.showInStock || opts.showOutOfStock) {
    list = list.filter(
      p =>
        (opts.showInStock && p.inStock) ||
        (opts.showOutOfStock && !p.inStock)
    );
  }

  return list;
}

export function sortStorefrontProducts(list: Product[], sortBy: StorefrontSort): Product[] {
  const copy = [...list];
  switch (sortBy) {
    case "price-low":
      copy.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
      break;
    case "price-high":
      copy.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
      break;
    case "newest":
      copy.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      break;
    default:
      copy.sort((a, b) => {
        const score = (p: Product) =>
          (p.trending ? 4 : 0) + (p.featured ? 2 : 0) + (p.inStock ? 1 : 0);
        const d = score(b) - score(a);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }
  return copy;
}

export function searchProductsByQuery(products: Product[], q: string): Product[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return products.filter(product => {
    return (
      product.name.toLowerCase().includes(term) ||
      product.brand.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      (product.variants?.some(v => v.name.toLowerCase().includes(term)) ?? false) ||
      (product.description?.toLowerCase().includes(term) ?? false)
    );
  });
}
