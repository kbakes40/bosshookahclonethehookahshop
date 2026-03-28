// ProductCard Component - Neo-Brutalism meets Luxury Retail
// Features: Product image, price display

import { memo, useMemo } from "react";
import { Product } from "@/lib/products";
import { Link } from "wouter";
import { useShopCurrency } from "@/contexts/CurrencyContext";
import { cardImageSrc } from "@/lib/cardImageUrl";

export interface ProductCardProps {
  product: Product;
  /** First visible carousel tile only — improves LCP without loading every image eagerly. */
  imageFetchPriority?: "high";
}

function ProductCardInner({ product, imageFetchPriority }: ProductCardProps) {
  const { formatUsd } = useShopCurrency();
  const src = useMemo(() => cardImageSrc(product.image), [product.image]);
  const eager = imageFetchPriority === "high";

  return (
    <div className="group relative">
      <Link href={`/product/${product.id}`} className="block">
        {/* Product Image Container */}
        <div className="relative bg-secondary brutalist-border overflow-hidden aspect-square mb-4 flex items-center justify-center">
          <img
            src={src}
            alt={product.name}
            width={480}
            height={480}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            {...(eager ? { fetchPriority: "high" as const } : {})}
            className="max-h-full max-w-full w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-300"
          />

          {/* Out of Stock Overlay */}
          {!product.inStock && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="bg-foreground text-background px-4 py-2 font-bold text-sm">
                SOLD OUT
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{product.brand}</p>
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{product.name}</h3>

          {/* Price */}
          <div className="flex items-center gap-2">
            {product.salePrice ? (
              <>
                <span className="price-tag text-muted-foreground line-through text-sm">
                  {formatUsd(product.price)}
                </span>
                <span className="price-tag text-primary font-bold">
                  {formatUsd(product.salePrice)}
                </span>
              </>
            ) : (
              <span className="price-tag font-bold">{formatUsd(product.price)}</span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default memo(
  ProductCardInner,
  (prev, next) =>
    prev.product.id === next.product.id &&
    prev.product.name === next.product.name &&
    prev.product.brand === next.product.brand &&
    prev.product.price === next.product.price &&
    prev.product.salePrice === next.product.salePrice &&
    prev.product.inStock === next.product.inStock &&
    prev.product.image === next.product.image &&
    prev.imageFetchPriority === next.imageFetchPriority
);
