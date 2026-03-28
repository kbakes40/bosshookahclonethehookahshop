import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function SearchResults() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchQuery(params.get("q") || "");
  }, [location]);

  const q = searchQuery.trim();

  const searchPage = trpc.store.searchProducts.useInfiniteQuery(
    { q, limit: 24 },
    {
      enabled: q.length > 0,
      initialPageParam: 0,
      getNextPageParam: last => last.nextCursor ?? undefined,
      staleTime: 30_000,
    }
  );

  const searchResults = useMemo(
    () => searchPage.data?.pages.flatMap(p => p.products) ?? [],
    [searchPage.data?.pages]
  );

  const total = searchPage.data?.pages[0]?.total ?? searchResults.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16">
        <div className="container">
          <div className="mb-12">
            <h1 className="text-4xl font-display font-black mb-4">SEARCH RESULTS</h1>
            {searchQuery && (
              <p className="text-lg">
                {searchResults.length > 0 ? (
                  <>
                    Found <span className="font-bold">{total}</span>{" "}
                    {total === 1 ? "result" : "results"} for{" "}
                    <span className="font-bold">&quot;{searchQuery}&quot;</span>
                  </>
                ) : searchPage.isPending ? (
                  <>Searching…</>
                ) : (
                  <>
                    No results found for{" "}
                    <span className="font-bold">&quot;{searchQuery}&quot;</span>
                  </>
                )}
              </p>
            )}
            {!searchQuery && (
              <p className="text-lg text-muted-foreground">Enter a search term to find products</p>
            )}
          </div>

          {searchResults.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {searchResults.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {searchPage.hasNextPage && (
                <div className="flex justify-center mt-10">
                  <Button
                    type="button"
                    variant="outline"
                    className="brutalist-border font-bold"
                    onClick={() => searchPage.fetchNextPage()}
                    disabled={searchPage.isFetchingNextPage}
                  >
                    {searchPage.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}

          {searchQuery && !searchPage.isPending && searchResults.length === 0 && (
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <h2 className="text-2xl font-display font-black mb-4">NO PRODUCTS FOUND</h2>
                <p className="text-muted-foreground mb-8">
                  Try searching with different keywords or browse our collections
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="/collections/hookahs"
                    className="brutalist-border bg-background hover:bg-secondary px-6 py-3 font-bold transition-colors"
                  >
                    BROWSE HOOKAHS
                  </a>
                  <a
                    href="/collections/vapes"
                    className="brutalist-border bg-background hover:bg-secondary px-6 py-3 font-bold transition-colors"
                  >
                    BROWSE VAPES
                  </a>
                  <a
                    href="/collections/charcoal"
                    className="brutalist-border bg-background hover:bg-secondary px-6 py-3 font-bold transition-colors"
                  >
                    BROWSE CHARCOAL
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
