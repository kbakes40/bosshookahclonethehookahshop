import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { keepPreviousData } from "@tanstack/react-query";

export default function SearchResults() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchQuery(params.get("q") || "");
  }, [location]);

  const q = searchQuery.trim();
  const [visibleLimit, setVisibleLimit] = useState(24);

  useEffect(() => {
    setVisibleLimit(24);
  }, [q]);

  const searchQueryTrpc = trpc.store.searchProducts.useQuery(
    {
      q,
      limit: visibleLimit,
      cursor: 0,
    },
    {
      enabled: q.length > 0,
      staleTime: 30_000,
      placeholderData: keepPreviousData,
    }
  );

  const searchResults = searchQueryTrpc.data?.products ?? [];
  const total = searchQueryTrpc.data?.total ?? searchResults.length;
  const hasNextPage = searchQueryTrpc.data?.nextCursor != null;

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
                ) : searchQueryTrpc.isPending ? (
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

          {searchQueryTrpc.isError && (
            <p className="text-sm text-destructive mb-4">
              Search could not complete. Please try again.
            </p>
          )}

          {searchResults.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {searchResults.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {hasNextPage && (
                <div className="flex justify-center mt-10">
                  <Button
                    type="button"
                    variant="outline"
                    className="brutalist-border font-bold"
                    onClick={() => setVisibleLimit(l => l + 24)}
                    disabled={searchQueryTrpc.isFetching}
                  >
                    {searchQueryTrpc.isFetching ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}

          {searchQuery &&
            !searchQueryTrpc.isPending &&
            searchResults.length === 0 &&
            !searchQueryTrpc.error && (
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
