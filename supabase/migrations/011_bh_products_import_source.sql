-- Optional fields for THS / external catalog importers (source URL dedup, rich metadata).
ALTER TABLE public.bh_products ADD COLUMN IF NOT EXISTS source_product_url text;
ALTER TABLE public.bh_products ADD COLUMN IF NOT EXISTS import_meta jsonb;

COMMENT ON COLUMN public.bh_products.source_product_url IS 'Canonical source product or variation page URL (e.g. WooCommerce permalink) for importer dedup';
COMMENT ON COLUMN public.bh_products.import_meta IS 'Importer JSON: gallery URLs, Woo attributes, wp ids, short description, etc.';

CREATE INDEX IF NOT EXISTS bh_products_source_product_url_idx
  ON public.bh_products (source_product_url)
  WHERE source_product_url IS NOT NULL;
