// Brand Collection Page - Shows products filtered by category and brand
import { useMemo } from "react";
import { useLocation } from "wouter";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

export default function BrandCollection() {
  const [location] = useLocation();

  const pathParts = location.split("/").filter(Boolean);
  const category = pathParts[0];
  const brandSlug = pathParts[1];

  const brandName = brandSlug
    ?.split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const catalogPage = trpc.store.listProductsPage.useInfiniteQuery(
    {
      category: category || "all",
      brand: brandName,
      priceMin: 0,
      priceMax: 999_999,
      showInStock: false,
      showOutOfStock: false,
      sortBy: "best-selling",
      limit: 24,
    },
    {
      initialPageParam: 0,
      getNextPageParam: last => last.nextCursor ?? undefined,
      enabled: Boolean(category && brandName),
      staleTime: 60_000,
    }
  );

  const products = useMemo(
    () => catalogPage.data?.pages.flatMap(p => p.products) ?? [],
    [catalogPage.data?.pages]
  );

  const categoryTitles: Record<string, string> = {
    shisha: "Shisha",
    vapes: "Vapes",
    charcoal: "Charcoal",
    hookahs: "Hookahs",
    accessories: "Accessories",
    bowls: "Hookah Bowls",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16">
        <div className="container">
          <div className="mb-12">
            <h1 className="text-5xl font-display font-black mb-4">
              {brandName} {categoryTitles[category]}
            </h1>
            <p className="text-lg text-muted-foreground">
              Browse our selection of {brandName} products
            </p>
          </div>

          {products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {catalogPage.hasNextPage && (
                <div className="flex justify-center mt-10">
                  <Button
                    type="button"
                    variant="outline"
                    className="brutalist-border font-bold"
                    onClick={() => catalogPage.fetchNextPage()}
                    disabled={catalogPage.isFetchingNextPage}
                  >
                    {catalogPage.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          ) : catalogPage.isPending ? (
            <p className="text-muted-foreground">Loading products…</p>
          ) : (
            <div className="text-center py-16">
              <p className="text-2xl font-bold mb-2">No products found</p>
              <p className="text-muted-foreground">
                We couldn&apos;t find any {brandName} products in this category.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
