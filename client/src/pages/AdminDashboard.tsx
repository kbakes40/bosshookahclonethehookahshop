import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminPageStackClass,
  adminPanelClass,
  adminPanelHeaderClass,
} from "@/components/admin/adminFilterBarStyles";
import { ArrowRight, AlertTriangle } from "lucide-react";

function deliveryLabel(dm: string) {
  const k = (dm || "").toLowerCase();
  if (k === "pickup") return "Pickup";
  return "Shipping";
}

function DeliveryBadge({ method }: { method: string }) {
  const k = (method || "").toLowerCase();
  const cls =
    k === "pickup"
      ? "bg-violet-950/80 text-violet-300/95 border border-violet-800/60"
      : "bg-zinc-800/90 text-zinc-400 border border-zinc-700/80";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${cls}`}>{deliveryLabel(method)}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const st = (status || "").toLowerCase();
  const paidLike = ["paid", "completed", "delivered"].includes(st);
  const cls = paidLike
    ? "bg-[#172554] text-[#93C5FA] border border-[#1E40AF]/50"
    : st === "pending"
      ? "bg-amber-950/60 text-amber-200/95 border border-amber-900/50"
      : "bg-zinc-800 text-zinc-400 border border-zinc-700/80";
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${cls}`}>
      {(status || "—").replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={`${adminPanelClass} p-4`}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-50 mt-1 tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[11px] mt-1 text-zinc-500">{sub}</p>}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-medium bg-[#0c0c0e] border-b border-zinc-800/90">
      {children}
    </th>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`${adminPanelClass} overflow-hidden`}>
      <div className={`${adminPanelHeaderClass} flex items-center justify-between gap-2`}>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const subtitle = `Overview · ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}`;

  const statsQuery = trpc.admin.getStats.useQuery(undefined);
  const recentOrdersQuery = trpc.admin.getOrders.useQuery({
    page: 1,
    pageSize: 8,
    status: "all",
    fulfillmentStatus: "all",
    deliveryMethod: "all",
  });
  const lowStockQuery = trpc.admin.getInventory.useQuery({
    page: 1,
    pageSize: 6,
    lowStockOnly: true,
  });
  const recentProfilesQuery = trpc.admin.getProfiles.useQuery({
    page: 1,
    pageSize: 6,
  });

  const stats = statsQuery.data;
  const overviewOrders = recentOrdersQuery.data?.orders ?? [];
  const lowStockItems = lowStockQuery.data?.items ?? [];
  const recentProfiles = recentProfilesQuery.data?.profiles ?? [];

  const totalRevenue = stats?.totalRevenue ?? 0;
  const pendingOrders = stats?.pendingOrders ?? 0;
  const lowStockCount = stats?.lowStockProducts ?? 0;

  const loading =
    statsQuery.isLoading || recentOrdersQuery.isLoading || lowStockQuery.isLoading || recentProfilesQuery.isLoading;

  return (
    <AdminShell title="Home" subtitle={subtitle}>
      <div className={adminPageStackClass}>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">Loading overview…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Products" value={stats?.totalProducts ?? 0} sub="In catalog" />
              <StatCard label="Orders" value={stats?.totalOrders ?? 0} sub={`${pendingOrders} pending payment`} />
              <StatCardAccent
                label="Revenue"
                value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                sub="Paid orders (all time)"
              />
              <StatCard label="Customers" value={stats?.totalCustomers ?? 0} sub="Profiles / sign-ins" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <SectionCard
                  title="Recent orders"
                  action={
                    <Link href="/admin/orders">
                      <a className="text-xs font-medium text-[#60A5FA] hover:text-[#93C5FA] inline-flex items-center gap-1">
                        View all <ArrowRight className="h-3 w-3" />
                      </a>
                    </Link>
                  }
                >
                  {overviewOrders.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-sm">No orders yet.</div>
                  ) : (
                    <div /* table */ className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <Th>Customer</Th>
                            <Th>Total</Th>
                            <Th>Status</Th>
                            <Th>Delivery</Th>
                            <Th>Date</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                          {overviewOrders.map(o => (
                            <tr key={o.id} className="hover:bg-zinc-900/40 transition-colors">
                              <td className="px-3 py-2.5 text-zinc-200">{o.customerName || "—"}</td>
                              <td className="px-3 py-2.5 text-zinc-200 tabular-nums">
                                ${((o.totalAmount || 0) / 100).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5">
                                <StatusBadge status={o.status} />
                              </td>
                              <td className="px-3 py-2.5">
                                <DeliveryBadge method={o.deliveryMethod} />
                              </td>
                              <td className="px-3 py-2.5 text-zinc-500 tabular-nums">
                                {new Date(o.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-4">
                <SectionCard
                  title="Low stock"
                  action={
                    <Link href="/admin/inventory">
                      <a className="text-xs font-medium text-zinc-400 hover:text-zinc-200">Inventory</a>
                    </Link>
                  }
                >
                  {lowStockCount === 0 ? (
                    <p className="py-8 px-4 text-center text-zinc-500 text-sm">All SKUs above alert threshold.</p>
                  ) : lowStockItems.length === 0 ? (
                    <p className="py-8 px-4 text-center text-zinc-500 text-sm">
                      {lowStockCount} SKU{lowStockCount === 1 ? "" : "s"} below threshold — open inventory to review.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-800/70">
                      {lowStockItems.map(p => (
                        <li key={p.id} className="px-4 py-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500/90 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-200 truncate">{p.name}</p>
                            <p className="text-[11px] text-zinc-500">
                              Stock {p.stockQuantity}
                              {p.sku ? ` · ${p.sku}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>

                <SectionCard
                  title="Recent customers"
                  action={
                    <Link href="/admin/customers">
                      <a className="text-xs font-medium text-zinc-400 hover:text-zinc-200">All</a>
                    </Link>
                  }
                >
                  {recentProfiles.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm">No sign-ins yet.</div>
                  ) : (
                    <ul className="divide-y divide-zinc-800/70">
                      {recentProfiles.map(p => (
                        <li key={p.id} className="px-4 py-2.5">
                          <p className="text-sm text-zinc-200 truncate">{p.name || "—"}</p>
                          <p className="text-[11px] text-zinc-500 truncate">{p.email}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 mb-2">Quick actions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { href: "/admin/orders", t: "Manage orders", d: "Payment & fulfillment" },
                  { href: "/admin/customers", t: "View customers", d: "Wholesale accounts" },
                  { href: "/admin/inventory", t: "Manage inventory", d: "Stock & unit cost" },
                  { href: "/admin/inventory", t: "Edit products", d: "Pricing, SKU, categories" },
                  { href: "/admin/content", t: "Site content", d: "Pages & policies (coming soon)" },
                  { href: "/admin/sales", t: "Sales reports", d: "Revenue, cost, profit" },
                ].map(x => (
                  <Link key={x.href + x.t} href={x.href}>
                    <a
                      className={`block ${adminPanelClass} p-4 hover:border-zinc-600/80 hover:bg-[#161618] transition-colors group`}
                    >
                      <p className="text-sm font-medium text-zinc-100 group-hover:text-white">{x.t}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{x.d}</p>
                    </a>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="text-center text-[10px] text-zinc-600 pt-4">
          The Hookah Shop Admin · {now.getFullYear()}
        </p>
      </div>
    </AdminShell>
  );
}

/** Subtle blue emphasis only on primary revenue metric */
function StatCardAccent({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={`${adminPanelClass} p-4 relative overflow-hidden`}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#3B82F6]/80" aria-hidden />
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 pl-1">{label}</p>
      <p className="text-2xl font-semibold text-[#93C5FA] mt-1 tabular-nums tracking-tight pl-1">{value}</p>
      {sub && <p className="text-[11px] mt-1 text-zinc-500 pl-1">{sub}</p>}
    </div>
  );
}
