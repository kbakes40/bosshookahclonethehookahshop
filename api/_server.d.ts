declare module "./_server.mjs" {
  import type { AnyRouter } from "@trpc/server";
  import type { Express } from "express";
  import type Stripe from "stripe";

  export const appRouter: AnyRouter;
  export function createContext(opts: {
    req: unknown;
    res: unknown;
  }): Promise<unknown>;
  export const stripe: Stripe;
  export function handleWebhookEvent(
    event: Stripe.Event
  ): Promise<unknown>;
  export const ENV: Record<string, string | boolean>;
  export function registerPayPalRoutes(app: Express): void;
  export function handleAdminAnalyticsOverview(
    req: unknown,
    res: unknown
  ): Promise<void>;
  export function handleAdminAnalyticsTest(
    req: unknown,
    res: unknown
  ): Promise<void>;
  export function registerProductsLookupRoutes(app: Express): void;
  export function publicRequestOrigin(req: unknown): string;
  export function buildOpenGraphProductMeta(
    productId: string,
    requestOrigin: string,
    variantId?: string | null
  ): Promise<{
    title: string;
    description: string;
    image: string;
    url: string;
  } | null>;
}
