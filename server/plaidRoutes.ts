import type { Express, Request, Response } from "express";

/**
 * Transfer webhooks are often configured in the Plaid Dashboard.
 * This route accepts events so you can extend order updates (verify JWT in production).
 */
export function registerPlaidRoutes(app: Express): void {
  app.post("/api/plaid/webhook", (req: Request, res: Response) => {
    try {
      const body = req.body as { webhook_type?: string; webhook_code?: string };
      console.log("[Plaid webhook]", body?.webhook_type, body?.webhook_code);
      // TODO: verify Plaid webhook JWT, match transfer_id to bh_orders.payment_metadata
    } catch (e) {
      console.error("[Plaid webhook]", e);
    }
    res.status(200).json({ received: true });
  });
}
