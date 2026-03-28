import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// Bundled from `server/_vercel_exports.ts` → `api/_server.mjs` (see `api/_server.d.ts`).
import {
  appRouter,
  createContext,
  stripe,
  handleWebhookEvent,
  ENV,
  registerPayPalRoutes,
  handleAdminAnalyticsOverview,
  handleAdminAnalyticsTest,
  registerProductsLookupRoutes,
  buildOpenGraphProductMeta,
  publicRequestOrigin,
} from "./_server.mjs";

const app = express();
/** So `req.secure` / forwarded headers match the visitor’s URL on Vercel & other proxies. */
app.set("trust proxy", 1);

// Stripe webhook MUST be registered BEFORE express.json() to preserve raw body
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("No signature");
      return;
    }
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        ENV.stripeWebhookSecret
      );
      const result = await handleWebhookEvent(event);
      res.json(result);
    } catch (err) {
      console.error("[Stripe Webhook] Error:", err);
      res.status(400).send(`Webhook Error: ${err}`);
    }
  }
);

// Configure body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerPayPalRoutes(app);
registerProductsLookupRoutes(app);

/** JSON for Edge middleware — product Open Graph (link previews / iMessage). */
app.get("/api/og-meta", async (req, res) => {
  try {
    const id = String(req.query.id ?? "").trim();
    if (!id) {
      res.status(400).json({ error: "missing id" });
      return;
    }
    const origin = publicRequestOrigin(req);
    const variant = String(req.query.variant ?? "").trim() || undefined;
    const meta = await buildOpenGraphProductMeta(id, origin, variant);
    if (!meta) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(meta);
  } catch (e) {
    console.error("[api/og-meta]", e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/api/admin/analytics/overview", (req, res) => {
  void handleAdminAnalyticsOverview(req, res);
});

app.get("/api/admin/analytics/test", (req, res) => {
  void handleAdminAnalyticsTest(req, res);
});

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
