import { Link } from "wouter";
import { useEffect, useState } from "react";
import { ChevronRight, Flame, LayoutGrid, Sparkles, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLeadingDebouncedValue } from "@/hooks/useLeadingDebouncedValue";
import { useShopCurrency } from "@/contexts/CurrencyContext";
import { cardImageSrc } from "@/lib/cardImageUrl";
import { categories } from "@/lib/products";
import { loadRecentSearches, pushRecentSearch } from "@/lib/storeSearchStorage";
import { Button } from "@/components/ui/button";
import { SearchHighlight } from "./SearchHighlight";

export const QUICK_CHIPS = [
  { id: "vapes", label: "Vapes" },
  { id: "hookahs", label: "Hookah" },
  { id: "shisha", label: "Shisha" },
  { id: "charcoal", label: "Charcoal" },
  { id: "accessories", label: "Accessories" },
] as const;

function categoryDisplayName(cat: string): string {
  return categories.find(c => c.id === cat)?.name ?? cat;
}

export type PredictiveSearchPanelProps = {
  variant: "desktop" | "mobile";
  query: string;
  onQueryChange: (q: string) => void;
  categoryFilter: string | null;
  onCategoryFilter: (id: string | null) => void;
  /** Panel is mounted and should fetch (desktop: expanded; mobile: overlay open). */
  active: boolean;
  onViewAll: (q: string) => void;
  onNavigateProduct?: () => void;
};

export function PredictiveSearchPanel({
  variant,
  query,
  onQueryChange,
  categoryFilter,
  onCategoryFilter,
  active,
  onViewAll,
  onNavigateProduct,
}: PredictiveSearchPanelProps) {
  const debounced = useLeadingDebouncedValue(query.trim(), 260);
  const { formatUsd } = useShopCurrency();
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (active && typeof window !== "undefined") {
      setRecent(loadRecentSearches());
    }
  }, [active, query]);

  const preview = trpc.store.searchPreview.useQuery(
    {
      q: debounced,
      category: categoryFilter ?? undefined,
      previewLimit: 10,
    },
    {
      enabled: active,
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      placeholderData: p => p,
    }
  );

  const data = preview.data;
  const isIdle = data?.mode === "idle";
  const isResults = data?.mode === "results";
  const typing = query.trim().length > 0;
  const showLoading = typing && preview.isFetching && !preview.data;

  const chipRow = (
    <div className="flex flex-wrap gap-2 px-3 sm:px-4 pt-2 pb-2 border-b border-border/80 bg-muted/30">
      {QUICK_CHIPS.map(chip => {
        const on = categoryFilter === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => onCategoryFilter(on ? null : chip.id)}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-bold border-2 transition-colors shrink-0",
              on
                ? "bg-primary text-primary-foreground border-foreground"
                : "bg-background border-border hover:border-primary hover:text-primary",
            ].join(" ")}
          >
            {chip.label}
          </button>
        );
      })}
      {categoryFilter && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => onCategoryFilter(null)}
          className="text-xs font-semibold text-muted-foreground underline underline-offset-2 px-2 py-1.5"
        >
          Clear filter
        </button>
      )}
    </div>
  );

  const recordAndNavigate = () => {
    if (query.trim()) pushRecentSearch(query.trim());
    onNavigateProduct?.();
  };

  const shellClass =
    variant === "desktop"
      ? "rounded-md border-3 border-border brutalist-shadow bg-background overflow-hidden flex flex-col max-h-[min(72vh,28rem)]"
      : "flex flex-col flex-1 min-h-0 bg-background overflow-hidden";

  return (
    <div className={shellClass}>
      {chipRow}

      <div
        className={[
          "overflow-y-auto overscroll-contain flex-1 min-h-0",
          variant === "mobile" ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : "",
        ].join(" ")}
      >
        {showLoading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground font-medium">
            Searching…
          </div>
        )}

        {isIdle && data && (
          <div className="px-3 sm:px-4 py-3 space-y-5">
            {recent.length > 0 && (
              <section>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary mb-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recent
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map(term => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="px-3 py-1.5 text-xs font-semibold brutalist-border bg-secondary hover:bg-secondary/80"
                      onClick={() => {
                        onQueryChange(term);
                        onViewAll(term);
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary mb-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Trending searches
              </div>
              <div className="flex flex-wrap gap-2">
                {data.trendingSearches.map(term => (
                  <button
                    key={term}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    className="px-3 py-1.5 text-xs font-semibold brutalist-border bg-background hover:bg-secondary text-left"
                    onClick={() => {
                      onQueryChange(term);
                      onViewAll(term);
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary mb-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                Top categories
              </div>
              <div className="grid grid-cols-2 gap-2">
                {data.topCategories.map(c => (
                  <Link
                    key={c.id}
                    href={c.href}
                    onMouseDown={recordAndNavigate}
                    className="flex items-center justify-between px-3 py-2.5 brutalist-border bg-secondary hover:bg-primary/10 text-sm font-bold"
                  >
                    {c.label}
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary mb-2">
                <Flame className="h-3.5 w-3.5" />
                Popular picks
              </div>
              <div className="space-y-1">
                {data.popularProducts.slice(0, 6).map(p => (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                    onMouseDown={recordAndNavigate}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary border border-transparent hover:border-border transition-colors"
                  >
                    <img
                      src={cardImageSrc(p.image)}
                      alt=""
                      className="w-12 h-12 object-cover brutalist-border shrink-0"
                      width={48}
                      height={48}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">
                        {p.brand}
                      </p>
                      <p className="text-sm font-semibold line-clamp-2 leading-snug">{p.name}</p>
                      <p className="text-xs text-primary font-bold mt-0.5">
                        {p.salePrice ? (
                          <>
                            <span className="line-through text-muted-foreground mr-1">
                              {formatUsd(p.price)}
                            </span>
                            {formatUsd(p.salePrice)}
                          </>
                        ) : (
                          formatUsd(p.price)
                        )}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}

        {isResults && data && (
          <div className="pb-2">
            {data.categoryNav.length > 0 && (
              <section className="px-3 sm:px-4 pt-3 pb-2 border-b border-border/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Categories
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.categoryNav.map(c => (
                    <Link
                      key={c.id}
                      href={c.href}
                      onMouseDown={recordAndNavigate}
                      className="px-3 py-1.5 text-xs font-bold brutalist-border bg-secondary hover:bg-primary/15"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.brandHints.length > 0 && (
              <section className="px-3 sm:px-4 pt-3 pb-2 border-b border-border/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Brands
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.brandHints.map(b => (
                    <button
                      key={b.brand}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="px-3 py-1.5 text-xs font-semibold brutalist-border bg-background hover:bg-secondary text-left"
                      onClick={() => {
                        onQueryChange(b.brand);
                        onViewAll(b.brand);
                      }}
                    >
                      {b.brand}{" "}
                      <span className="text-muted-foreground font-normal">({b.count})</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.suggestions.length > 0 && (
              <section className="px-3 sm:px-4 pt-3 pb-2 border-b border-border/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Suggestions
                </p>
                <div className="flex flex-col gap-1">
                  {data.suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      className="text-left text-sm font-medium py-2 px-2 rounded hover:bg-secondary flex items-center gap-2"
                      onClick={() => {
                        onQueryChange(s);
                        onViewAll(s);
                      }}
                    >
                      <SearchHighlight text={s} query={debounced || query} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.products.length > 0 && (
              <section className="px-3 sm:px-4 pt-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Products
                </p>
                <div className="space-y-1">
                  {data.products.map(({ product: p }) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.id}`}
                      onMouseDown={recordAndNavigate}
                      className="flex items-center gap-3 p-2.5 min-h-[4.5rem] rounded-md hover:bg-secondary border border-transparent hover:border-border active:bg-secondary/80 transition-colors"
                    >
                      <img
                        src={cardImageSrc(p.image)}
                        alt=""
                        className="w-14 h-14 object-cover brutalist-border shrink-0"
                        width={56}
                        height={56}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold truncate">
                          {p.brand} · {categoryDisplayName(p.category)}
                        </p>
                        <p className="text-sm font-semibold line-clamp-2 leading-snug">
                          <SearchHighlight text={p.name} query={debounced || query} />
                        </p>
                        <p className="text-xs text-primary font-black mt-0.5">
                          {p.salePrice ? (
                            <>
                              <span className="line-through text-muted-foreground mr-1 font-normal">
                                {formatUsd(p.price)}
                              </span>
                              {formatUsd(p.salePrice)}
                            </>
                          ) : (
                            formatUsd(p.price)
                          )}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>

                {data.totalMatching > data.products.length && (
                  <div className="pt-4 pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full brutalist-border font-black text-sm py-6"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => onViewAll(query.trim() || debounced)}
                    >
                      View all {data.totalMatching} results
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </section>
            )}

            {data.products.length === 0 && !showLoading && (
              <div className="px-4 py-8 space-y-4">
                <p className="text-center font-display font-black text-lg">No exact matches</p>
                <p className="text-center text-sm text-muted-foreground">
                  Try a trending search or jump to a category.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {data.topCategories.slice(0, 4).map(c => (
                    <Link
                      key={c.id}
                      href={c.href}
                      onMouseDown={recordAndNavigate}
                      className="px-3 py-2 text-xs font-bold brutalist-border bg-secondary"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {data.suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="px-3 py-2 text-xs font-semibold brutalist-border"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        onQueryChange(s);
                        onViewAll(s);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!data && !showLoading && active && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
      </div>
    </div>
  );
}
