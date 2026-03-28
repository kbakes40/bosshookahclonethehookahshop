import { describe, expect, it } from "vitest";
import { categoryMatches, filterProductsForGrid } from "./storeCatalogQuery";
import type { Product } from "../client/src/lib/products";

const vapeProduct = (price: number, sale?: number): Product => ({
  id: "1",
  name: "Test Vape",
  brand: "X",
  price,
  salePrice: sale,
  category: "vape",
  image: "",
  inStock: true,
});

describe("categoryMatches", () => {
  it("matches vape DB rows when URL filter is vapes", () => {
    expect(categoryMatches("vape", "vapes")).toBe(true);
    expect(categoryMatches("Vapes", "vape")).toBe(true);
  });

  it("still matches exact category", () => {
    expect(categoryMatches("vapes", "vapes")).toBe(true);
  });
});

describe("filterProductsForGrid price cap", () => {
  it("includes products above $999 when priceMax is high (client/server aligned)", () => {
    const list = [vapeProduct(1500)];
    const filtered = filterProductsForGrid(list, {
      category: "vapes",
      priceMin: 0,
      priceMax: 999_999,
      showInStock: false,
      showOutOfStock: false,
    });
    expect(filtered).toHaveLength(1);
  });

  it("excludes products above 999 when priceMax is 999 (legacy client bug)", () => {
    const list = [vapeProduct(1500), vapeProduct(100)];
    const filtered = filterProductsForGrid(list, {
      category: "vapes",
      priceMin: 0,
      priceMax: 999,
      showInStock: false,
      showOutOfStock: false,
    });
    expect(filtered.map(p => p.price)).toEqual([100]);
  });
});
