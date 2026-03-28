// Admin Orders Page - View and manage customer orders
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminFilterBarRowClass,
  adminFilterControlClass,
  adminFilterFieldSmClass,
  adminFilterLabelClass,
  adminPageStackClass,
} from "@/components/admin/adminFilterBarStyles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";

function payBadge(status: string) {
  const st = (status || "").toLowerCase();
  if (st === "paid") return "bg-[#172554] text-[#93C5FA] border border-[#1E40AF]/45";
  if (st === "pending") return "bg-amber-950/55 text-amber-200 border border-amber-900/45";
  if (st === "failed") return "bg-red-950/50 text-red-200 border border-red-900/50";
  if (st === "refunded") return "bg-zinc-800 text-zinc-300 border border-zinc-700";
  return "bg-zinc-800 text-zinc-400 border border-zinc-700";
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "failed" | "refunded">("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<
    "all" | "pending" | "ready_to_ship" | "shipped" | "delivered"
  >("all");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "shipping" | "pickup">("all");
  const [search, setSearch] = useState("");

  const { data: ordersData, isLoading, refetch } = trpc.admin.getOrders.useQuery({
    page: 1,
    pageSize: 50,
    status: statusFilter,
    fulfillmentStatus: fulfillmentFilter,
    deliveryMethod: deliveryFilter,
  });

  const updateStatus = trpc.admin.updateOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated");
      refetch();
    },
    onError: () => toast.error("Failed to update order status"),
  });

  const deleteOrder = trpc.admin.deleteOrder.useMutation({
    onSuccess: () => {
      toast.success("Order deleted successfully");
      refetch();
    },
    onError: () => toast.error("Failed to delete order"),
  });

  const confirmZellePayment = trpc.admin.confirmZellePayment.useMutation({
    onSuccess: () => {
      toast.success("Payment confirmed successfully");
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to confirm payment");
    },
  });

  const ordersRaw = ordersData?.orders ?? [];
  const q = search.trim().toLowerCase();
  const orders = q
    ? ordersRaw.filter(o => {
        const id = String(o.id).toLowerCase();
        const name = (o.customerName || "").toLowerCase();
        const email = (o.customerEmail || "").toLowerCase();
        const phone = (o.customerPhone || "").toLowerCase();
        return id.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q);
      })
    : ordersRaw;

  const orderFiltersBar = (
    <div className={adminFilterBarRowClass}>
      <div className={adminFilterFieldSmClass}>
        <label className={adminFilterLabelClass}>Payment</label>
        <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
          <SelectTrigger className={adminFilterControlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={adminFilterFieldSmClass}>
        <label className={adminFilterLabelClass}>Fulfillment</label>
        <Select value={fulfillmentFilter} onValueChange={(v: typeof fulfillmentFilter) => setFulfillmentFilter(v)}>
          <SelectTrigger className={adminFilterControlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="ready_to_ship">Ready to ship</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className={adminFilterFieldSmClass}>
        <label className={adminFilterLabelClass}>Delivery</label>
        <Select value={deliveryFilter} onValueChange={(v: typeof deliveryFilter) => setDeliveryFilter(v)}>
          <SelectTrigger className={adminFilterControlClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="shipping">Shipping</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 w-full min-w-[12rem] sm:w-44 md:w-48 sm:min-w-[11rem]">
        <label className={adminFilterLabelClass}>Search order</label>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Order id, customer…"
            className={`${adminFilterControlClass} pl-8`}
          />
        </div>
      </div>
    </div>
  );

  return (
    <AdminShell title="Orders" subtitle="Payment, fulfillment, and delivery" headerTrailing={orderFiltersBar}>
      <div className={adminPageStackClass}>
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-zinc-500 text-sm">Loading orders…</div>
        ) : (
          <div className="rounded-xl border border-zinc-800/90 bg-[#121214] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[960px]">
                <thead>
                  <tr className="bg-[#0c0c0e] border-b border-zinc-800/90">
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Order
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Customer
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Date
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Amount
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Payment
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Method
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Fulfillment
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Delivery
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wide text-zinc-500 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {orders.length > 0 ? (
                    orders.map(order => (
                      <tr key={order.id} className="hover:bg-zinc-900/35 transition-colors">
                        <td className="px-4 py-3 font-mono text-zinc-300">#{order.id}</td>
                        <td className="px-4 py-3 text-zinc-200">
                          <div className="font-medium">{order.customerName || "Guest"}</div>
                          {order.customerPhone && (
                            <div className="text-zinc-500 text-[11px]">{order.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 tabular-nums">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-100 tabular-nums font-medium">
                          ${(order.totalAmount / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${payBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              order.paymentMethod === "zelle"
                                ? "bg-indigo-950/50 text-indigo-200 border-indigo-900/50"
                                : "bg-zinc-800 text-zinc-300 border-zinc-700"
                            }`}
                          >
                            {order.paymentMethod === "zelle" ? "Zelle" : "Card"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={order.fulfillmentStatus}
                            onValueChange={(value: string) => {
                              updateStatus.mutate({
                                orderId: order.id,
                                fulfillmentStatus: value,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 w-[9.5rem] text-[11px] bg-zinc-900 border-zinc-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="ready_to_ship">Ready to ship</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              order.deliveryMethod === "pickup"
                                ? "bg-violet-950/45 text-violet-200 border-violet-900/45"
                                : "bg-zinc-800/90 text-zinc-300 border-zinc-700"
                            }`}
                          >
                            {order.deliveryMethod === "pickup" ? "Pickup" : "Shipping"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {order.paymentMethod === "zelle" && order.status === "pending" && (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-[11px] bg-[#1E40AF] hover:bg-[#1D4ED8] text-[#DBEAFE]"
                                onClick={() => {
                                  if (confirm(`Confirm Zelle payment received for order #${order.id}?`)) {
                                    confirmZellePayment.mutate({ orderId: order.id });
                                  }
                                }}
                              >
                                Confirm
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-zinc-400 hover:text-red-300"
                              onClick={() => {
                                if (confirm(`Delete order #${order.id}?`)) {
                                  deleteOrder.mutate({ orderId: order.id });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-zinc-500">
                        No orders match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
