/** Normalize Supabase snake_case rows for tRPC / admin UI (camelCase). */

/** `bh_products.cost` — non-negative finite USD, or null if unset / invalid. */
export function parseBhProductCost(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function mapOrderRow(o: Record<string, unknown>) {
  return {
    id: String(o.id ?? ""),
    customerName: (o.customer_name as string) ?? null,
    customerEmail: (o.customer_email as string) ?? null,
    customerPhone: (o.customer_phone as string) ?? null,
    status: String(o.status ?? ""),
    fulfillmentStatus: String(o.fulfillment_status ?? "pending"),
    paymentMethod: String(o.payment_method ?? "stripe"),
    deliveryMethod: String(o.delivery_method ?? "shipping"),
    totalAmount: Number(o.total_amount) || 0,
    createdAt: String(o.created_at ?? new Date().toISOString()),
    updatedAt: String(o.updated_at ?? o.created_at ?? new Date().toISOString()),
    items: o.items,
    stripeSessionId: (o.stripe_session_id as string) ?? null,
    paymentMetadata: (o.payment_metadata as Record<string, unknown> | null | undefined) ?? null,
    shippingAddress: o.shipping_address ?? null,
  };
}

/** Admin list row for `profiles` (every user who has signed in). */
export function mapProfileAdminRow(o: Record<string, unknown>) {
  return {
    id: String(o.id ?? ""),
    email: (o.email as string | null | undefined) ?? null,
    name: (o.name as string | null | undefined) ?? null,
    role: String(o.role ?? "user"),
    loginMethod: (o.login_method as string | null | undefined) ?? null,
    lastSignedIn: String(
      o.last_signed_in ?? o.updated_at ?? o.created_at ?? new Date().toISOString()
    ),
    createdAt: o.created_at != null ? String(o.created_at) : null,
  };
}

export function mapCustomerRow(o: Record<string, unknown>) {
  const created = String(o.created_at ?? o.updated_at ?? new Date().toISOString());
  const updated = String(o.updated_at ?? o.created_at ?? created);
  return {
    id: String(o.id ?? ""),
    name: (o.name as string) ?? null,
    email: (o.email as string) ?? null,
    phone: (o.phone as string) ?? null,
    role: "customer" as const,
    totalSpent: Number(o.total_spent) || 0,
    orderCount: Number(o.order_count) || 0,
    createdAt: created,
    lastSignedIn: updated,
  };
}

export function mapProductInventoryRow(o: Record<string, unknown>) {
  return {
    id: String(o.id ?? ""),
    /** Alias for admin UI tables that expect `name` */
    name: String(o.name ?? ""),
    productName: String(o.name ?? ""),
    brand: String(o.brand ?? ""),
    category: String(o.category ?? ""),
    sku: (o.sku as string) ?? null,
    stockQuantity: Number(o.stock) || 0,
    lowStockThreshold: Number(o.low_stock_threshold) || 10,
    /** Stored as decimal USD in `bh_products` */
    price: Number(o.price) || 0,
    imageUrl: (o.image_url as string) ?? null,
    salePrice: o.sale_price != null ? Number(o.sale_price) : null,
    inStock: o.in_stock !== false,
    badge: (o.badge as string) ?? null,
    /** Unit cost USD for margin reporting; null if not set */
    cost: parseBhProductCost(o.cost),
    costSourceUrl: (o.cost_source_url as string | null | undefined) ?? null,
    costSourceName: (o.cost_source_name as string | null | undefined) ?? null,
    costMatchConfidence:
      o.cost_match_confidence != null && String(o.cost_match_confidence).trim() !== ""
        ? String(o.cost_match_confidence)
        : null,
    costLastCheckedAt:
      o.cost_last_checked_at != null ? String(o.cost_last_checked_at) : null,
    costIsAutoFilled: o.cost_is_auto_filled === true,
    costNeedsReview: o.cost_needs_review === true,
    costSuggestedUsd: parseBhProductCost(o.cost_suggested_usd),
  };
}

export function mapStoreSettingsRow(data: Record<string, unknown> | null) {
  if (!data) return null;
  return {
    id: data.id,
    storeName: (data.store_name as string) ?? "",
    address: (data.address as string) ?? "",
    city: (data.city as string) ?? "",
    state: (data.state as string) ?? "",
    zipCode: (data.zip_code as string) ?? "",
    phone: (data.phone as string) ?? "",
    email: (data.email as string) ?? "",
    hours: (data.hours as string) ?? "",
    pickupInstructions: (data.pickup_instructions as string) ?? "",
    zelleEmail: (data.zelle_email as string) ?? "",
    zellePhone: (data.zelle_phone as string) ?? "",
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function storeSettingsToSnake(
  input: Record<string, string | undefined>,
  updatedAt: string
) {
  return {
    store_name: input.storeName ?? "",
    address: input.address ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zipCode ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    hours: input.hours ?? null,
    pickup_instructions: input.pickupInstructions ?? null,
    zelle_email: input.zelleEmail ?? null,
    zelle_phone: input.zellePhone ?? null,
    updated_at: updatedAt,
  };
}
