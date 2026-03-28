-- Indexes to speed storefront filters (trending / featured / category + stock).
CREATE INDEX IF NOT EXISTS bh_products_trending_true_idx
  ON public.bh_products (trending)
  WHERE trending = true;

CREATE INDEX IF NOT EXISTS bh_products_featured_true_idx
  ON public.bh_products (featured)
  WHERE featured = true;

CREATE INDEX IF NOT EXISTS bh_products_category_in_stock_idx
  ON public.bh_products (category, in_stock);

CREATE INDEX IF NOT EXISTS bh_products_created_at_idx
  ON public.bh_products (created_at DESC);
