// Order History Page — orders for signed-in user email (Supabase bh_orders)
import { useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { User, Package, MapPin, CreditCard, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type LineItem = { name?: string; priceInCents?: number; quantity?: number };

function displayOrderStatus(status: string, fulfillmentStatus: string): string {
  if (status === "pending") return "Awaiting Payment";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Refunded";
  if (fulfillmentStatus === "delivered") return "Delivered";
  if (fulfillmentStatus === "shipped") return "In Transit";
  if (fulfillmentStatus === "ready_to_ship") return "Processing";
  return "Processing";
}

export default function OrderHistory() {
  const [, setLocation] = useLocation();
  const { user, loading, signOut, isAuthenticated } = useAuth();

  const ordersQuery = trpc.orders.listMine.useQuery(undefined, {
    enabled: Boolean(isAuthenticated && user),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/sign-in");
    }
  }, [loading, isAuthenticated, setLocation]);

  const handleLogout = async () => {
    await signOut();
    setLocation("/");
  };

  const getStatusColor = (label: string) => {
    switch (label) {
      case "Delivered":
        return "bg-blue-600 text-white";
      case "In Transit":
        return "bg-blue-500 text-white";
      case "Processing":
        return "bg-yellow-500 text-foreground";
      case "Awaiting Payment":
        return "bg-amber-600 text-white";
      case "Failed":
        return "bg-red-500 text-white";
      case "Refunded":
        return "bg-zinc-500 text-white";
      case "Cancelled":
        return "bg-red-500 text-white";
      default:
        return "bg-secondary";
    }
  };

  const myOrders = ordersQuery.data ?? [];

  const pageLoading = loading || (Boolean(isAuthenticated && user) && ordersQuery.isLoading);

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16">
        <div className="container max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-display font-black">ORDER HISTORY</h1>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="brutalist-border gap-2"
            >
              <LogOut className="h-4 w-4" />
              LOGOUT
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sidebar Navigation */}
            <div className="space-y-3">
              <Link href="/account" className="block">
                <div className="brutalist-border p-4 hover:bg-secondary hover:translate-x-1 transition-all">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5" />
                    <span className="font-bold">Profile</span>
                  </div>
                </div>
              </Link>

              <Link href="/orders" className="block">
                <div className="brutalist-border p-4 bg-primary text-primary-foreground hover:translate-x-1 transition-transform">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5" />
                    <span className="font-bold">Order History</span>
                  </div>
                </div>
              </Link>

              <div className="brutalist-border p-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5" />
                  <span className="font-bold">Addresses</span>
                </div>
              </div>

              <div className="brutalist-border p-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <span className="font-bold">Payment Methods</span>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="md:col-span-2 space-y-6">
              {myOrders.length === 0 ? (
                <div className="brutalist-border bg-background p-16 text-center">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h2 className="text-2xl font-display font-black mb-2">NO ORDERS YET</h2>
                  <p className="text-muted-foreground mb-6">
                    Start shopping to see your orders here
                  </p>
                  <Link href="/">
                    <Button className="brutalist-border brutalist-shadow bg-primary text-primary-foreground">
                      START SHOPPING
                    </Button>
                  </Link>
                </div>
              ) : (
                myOrders.map((order) => {
                  const label = displayOrderStatus(order.status, order.fulfillmentStatus);
                  const rawItems = order.items;
                  const lines = Array.isArray(rawItems) ? (rawItems as LineItem[]) : [];

                  return (
                    <div key={order.id} className="brutalist-border bg-background p-6">
                      <div className="flex items-start justify-between mb-4 pb-4 border-b-3 border-border">
                        <div>
                          <h3 className="text-xl font-display font-black mb-1">
                            #{order.id.slice(0, 8)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Placed on{" "}
                            {new Date(order.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <div
                          className={`px-3 py-1 brutalist-border text-sm font-bold ${getStatusColor(label)}`}
                        >
                          {label.toUpperCase()}
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        {lines.map((item, index) => {
                          const unit =
                            item.priceInCents != null ? item.priceInCents / 100 : 0;
                          const qty = item.quantity ?? 0;
                          return (
                            <div key={index} className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{item.name ?? "Item"}</p>
                                <p className="text-sm text-muted-foreground">Qty: {qty}</p>
                              </div>
                              <p className="price-tag font-bold">
                                ${(unit * qty).toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t-3 border-border">
                        <span className="font-display font-black text-lg">TOTAL</span>
                        <span className="price-tag font-black text-xl">
                          ${((order.totalAmount || 0) / 100).toFixed(2)} USD
                        </span>
                      </div>

                      <div className="flex gap-3 mt-4">
                        <Button
                          variant="outline"
                          className="flex-1 brutalist-border gap-2"
                          onClick={() => alert(`Order ${order.id}`)}
                        >
                          VIEW DETAILS
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        {label === "Delivered" && (
                          <Button
                            variant="outline"
                            className="flex-1 brutalist-border"
                            onClick={() => alert(`Reorder ${order.id}`)}
                          >
                            REORDER
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
