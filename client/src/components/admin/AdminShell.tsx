/**
 * The Hookah Shop admin layout — dark Shopify-inspired shell, restrained accent (blue for key actions).
 */
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Tag,
  TrendingUp,
  BarChart3,
  Megaphone,
  Settings,
  LogOut,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cap filter clusters on wide screens so they wrap before colliding with the title; keeps right edge inside content max width. */
const HEADER_TRAILING_MAX = "lg:max-w-[min(100%,48rem)]";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export const ADMIN_PRIMARY_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/inventory", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/discounts", label: "Discounts", icon: Tag },
  { href: "/admin/sales", label: "Sales", icon: TrendingUp },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/store-settings", label: "Settings", icon: Settings },
];

type AdminShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Renders in the header row to the right of the title (e.g. Orders filters). */
  headerTrailing?: ReactNode;
};

export function AdminShell({ title, subtitle, children, headerTrailing }: AdminShellProps) {
  const { user, loading, isAuthenticated, signOut } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      window.location.href = "/admin";
    } else if (user?.role !== "admin") {
      window.location.href = "/";
    }
  }, [loading, isAuthenticated, user]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-zinc-500 text-sm">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 flex text-sm">
      <aside className="w-56 shrink-0 border-r border-zinc-800/90 bg-[#0c0c0e] flex flex-col">
        <div className="p-4 border-b border-zinc-800/90">
          <Link href="/admin/dashboard">
            <a className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center">
                <Store className="h-4 w-4 text-[#60A5FA] group-hover:text-[#93C5FA] transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-zinc-100 truncate leading-tight">The Hookah Shop</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Wholesale admin</p>
              </div>
            </a>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {ADMIN_PRIMARY_NAV.map(item => {
            const active =
              location === item.href ||
              (item.href !== "/admin/dashboard" && location.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#1a1a1c] text-[#93C5FA] border border-zinc-700/60"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800/90 space-y-2">
          <div className="px-2 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60">
            <p className="text-xs font-medium text-zinc-300 truncate">{user.name}</p>
            <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white"
            onClick={() => {
              void signOut?.();
              window.location.href = "/";
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sign out
          </Button>
          <Link href="/">
            <a className="block text-center text-[11px] text-zinc-500 hover:text-zinc-300 py-1">
              View storefront
            </a>
          </Link>
        </div>
      </aside>

      {/* Main column: header border-b is full-bleed (meets sidebar edge); same max-w-7xl + px as main for flush title/content corners. */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 border-b border-zinc-800/90 bg-[#0f0f12]/95 backdrop-blur">
          <div
            className={`mx-auto w-full max-w-7xl min-w-0 px-4 md:px-6 py-4 flex flex-col gap-3 ${
              headerTrailing
                ? "lg:flex-row lg:items-start lg:justify-between lg:gap-6"
                : ""
            }`}
          >
            <div className="min-w-0 shrink-0 lg:pt-0">
              <h1 className="text-lg font-semibold text-zinc-50 tracking-tight truncate leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-zinc-500 mt-1 leading-snug">{subtitle}</p>}
            </div>
            {headerTrailing != null && (
              <div className={`min-w-0 w-full lg:w-auto lg:shrink ${HEADER_TRAILING_MAX}`}>{headerTrailing}</div>
            )}
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-auto overflow-x-hidden bg-[#09090b]">
          <div className="mx-auto w-full max-w-7xl min-w-0 px-4 md:px-6 py-4 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
