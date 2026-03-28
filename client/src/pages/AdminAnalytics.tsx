import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import {
  adminFilterBarRowClass,
  adminFilterLabelClass,
  adminDashboardGridGapClass,
  adminPageStackClass,
  adminPanelClass,
  adminPanelHeaderClass,
} from "@/components/admin/adminFilterBarStyles";
import { supabase } from "@/lib/supabase";
import type { Ga4OverviewResponse, Ga4OverviewSuccess } from "@shared/ga4Overview";
import { RefreshCw, BarChart3, AlertCircle } from "lucide-react";

const ANALYTICS_FETCH_MS = 45_000;

async function fetchGa4Overview(): Promise<Ga4OverviewResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ANALYTICS_FETCH_MS);
  try {
    const r = await fetch("/api/admin/analytics/overview", {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      credentials: "include",
      signal: ac.signal,
    });
    const text = await r.text();
    if (r.status === 403) {
      throw new Error("You do not have access to analytics.");
    }
    if (!r.ok) {
      throw new Error(text?.trim()?.slice(0, 800) || `Request failed (${r.status})`);
    }
    const looksHtml = /^\s*</.test(text);
    if (looksHtml) {
      throw new Error(
        "Analytics returned HTML instead of JSON — the /api route may not be running. Use the full app server (e.g. pnpm dev), not the Vite-only dev server."
      );
    }
    try {
      return JSON.parse(text) as Ga4OverviewResponse;
    } catch {
      throw new Error("Invalid JSON from analytics API. Check deployment logs for /api/admin/analytics/overview.");
    }
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    if (aborted) {
      throw new Error("Analytics request timed out — GA4 or the server took too long. Try Refresh or check Vercel function logs.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function SkeletonCard() {
  return (
    <div className={`${adminPanelClass} p-4 animate-pulse`}>
      <div className="h-3 w-24 bg-zinc-800 rounded mb-3" />
      <div className="h-8 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

export default function AdminAnalytics() {
  const q = useQuery({
    queryKey: ["admin", "ga4-overview"],
    queryFn: fetchGa4Overview,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const analyticsHeaderActions = (
    <div className={adminFilterBarRowClass}>
      <div className="flex flex-col gap-1 shrink-0">
        <span className={`${adminFilterLabelClass} select-none text-transparent`} aria-hidden>
          &nbsp;
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 text-xs px-3"
          disabled={q.isFetching}
          onClick={() => void q.refetch()}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell
      title="Analytics"
      subtitle="Live traffic from Google Analytics 4 · Revenue stays in Sales"
      headerTrailing={analyticsHeaderActions}
    >
      <div className={adminPageStackClass}>
        {q.isPending && !q.data && (
          <div className={`grid grid-cols-2 lg:grid-cols-4 ${adminDashboardGridGapClass}`}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {q.isError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/25 text-red-200 text-sm px-4 py-3 flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{q.error instanceof Error ? q.error.message : "Failed to load analytics"}</p>
          </div>
        )}

        {q.data?.ok === true && q.data.configured === false && (
          <div className="rounded-xl border border-zinc-800/90 bg-[#121214] p-6 max-w-lg">
            <div className="flex gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Google Analytics not connected</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Server-side GA4 only — credentials never ship to the browser</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Add <code className="text-zinc-300">GA4_PROPERTY_ID</code> (numeric),{" "}
              <code className="text-zinc-300">GA4_CLIENT_EMAIL</code>, and{" "}
              <code className="text-zinc-300">GA4_PRIVATE_KEY</code> to the server environment on Vercel (Production). Use a
              Google Cloud service account with <strong className="text-zinc-300">Viewer</strong> on the GA4 property. For
              the key, use a single-line value with <code className="text-zinc-300">\n</code> for newlines, or Vercel’s
              multiline secret. Also set <code className="text-zinc-300">VITE_GA_MEASUREMENT_ID</code> to your{" "}
              <code className="text-zinc-300">G-…</code> and redeploy.
            </p>
          </div>
        )}

        {q.data?.ok === false && (
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/15 text-amber-100/90 text-sm px-4 py-3">
            <p className="font-medium text-amber-200">GA4 request failed</p>
            <p className="text-xs mt-1 text-amber-100/80">{q.data.error}</p>
            <p className="text-[11px] mt-2 text-zinc-500">Last attempt: {fmtTime(q.data.fetchedAt)}</p>
          </div>
        )}

        {q.data?.ok === true && q.data.configured === true && (
          <AnalyticsDashboard data={q.data} isFetching={q.isFetching} />
        )}
      </div>
    </AdminShell>
  );
}

function AnalyticsDashboard({ data, isFetching }: { data: Ga4OverviewSuccess; isFetching: boolean }) {
  const topPages = Array.isArray(data.topPages) ? data.topPages : [];
  const topSources = Array.isArray(data.topSources) ? data.topSources : [];
  const dailyTrend = Array.isArray(data.dailyTrend) ? data.dailyTrend : [];
  const deviceBreakdown = Array.isArray(data.deviceBreakdown) ? data.deviceBreakdown : [];
  const topPage = topPages[0];
  const topSource = topSources[0];
  const activeNow =
    data.activeUsersApprox5Minutes != null ? data.activeUsersApprox5Minutes : data.activeUsersRealtime;
  const looksEmpty =
    activeNow === 0 &&
    (dailyTrend.length === 0 || dailyTrend.every(d => d.users === 0 && d.sessions === 0));

  return (
    <>
      {looksEmpty && (
        <div className="rounded-xl border border-amber-900/35 bg-amber-950/20 text-amber-100/90 text-xs px-4 py-3">
          <p className="font-medium text-amber-200">API works, but GA reports no traffic in this range</p>
          <p className="mt-1 text-amber-100/75">
            Confirm <code className="text-zinc-300">VITE_GA_MEASUREMENT_ID</code> on Vercel matches your active{" "}
            <code className="text-zinc-300">G-…</code> stream under the same property as{" "}
            <code className="text-zinc-300">GA4_PROPERTY_ID</code>, then redeploy. New properties can take time to show
            historical rows; realtime should move after real visits.
          </p>
        </div>
      )}

      <p className="text-[11px] text-zinc-500">
        Last updated {fmtTime(data.fetchedAt)}
        {isFetching ? " · refreshing…" : ""}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active users now"
          value={activeNow}
          hint={
            data.activeUsersApprox5Minutes != null
              ? "~5 min buckets (approx.)"
              : "GA4 realtime (~30 min)"
          }
        />
        <StatCard label="Users (realtime window)" value={data.activeUsersRealtime} hint="GA4 last ~30 minutes" />
        <StatCard
          label="Top page (7d views)"
          value={topPage?.views ?? 0}
          subtitle={topPage ? truncatePath(topPage.pagePath, 28) : "—"}
          hint="views"
        />
        <StatCard
          label="Top channel (7d)"
          value={topSource?.sessions ?? 0}
          subtitle={topSource?.channel ?? "—"}
          hint="sessions"
        />
      </div>

      <div className={`${adminPanelClass} p-4`}>
        <p className="text-sm font-medium text-zinc-200 mb-3">Traffic over last 7 days</p>
        {dailyTrend.length === 0 ? (
          <p className="text-zinc-500 text-sm py-12 text-center">No daily data in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fill: "#71717a", fontSize: 10 }} />
              <YAxis stroke="#71717a" tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#a1a1aa" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
              <Line type="monotone" dataKey="users" name="Users" stroke="#60A5FA" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#71717a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${adminPanelClass} overflow-hidden`}>
          <div className={adminPanelHeaderClass}>
            <p className="text-sm font-medium text-zinc-200">Top pages</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Last 7 days · screen views</p>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0c0c0e] border-b border-zinc-800/90">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] uppercase text-zinc-500 font-medium">Page</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase text-zinc-500 font-medium">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {topPages.map(row => (
                  <tr key={row.pagePath} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-2 text-zinc-300">
                      <div className="font-mono text-[11px] truncate max-w-[220px]" title={row.pagePath}>
                        {row.pagePath || "/"}
                      </div>
                      {row.pageTitle && (
                        <div className="text-zinc-500 truncate max-w-[220px] text-[10px] mt-0.5">{row.pageTitle}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-200">{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${adminPanelClass} overflow-hidden`}>
          <div className={adminPanelHeaderClass}>
            <p className="text-sm font-medium text-zinc-200">Traffic sources</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Session default channel · 7 days</p>
          </div>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0c0c0e] border-b border-zinc-800/90">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] uppercase text-zinc-500 font-medium">Channel</th>
                  <th className="text-right px-4 py-2 text-[10px] uppercase text-zinc-500 font-medium">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {topSources.map(row => (
                  <tr key={row.channel} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-2 text-zinc-300">{row.channel}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-200">{row.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-200 mb-3">Device breakdown</p>
        <p className="text-[11px] text-zinc-500 mb-3">Active users · last 7 days</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {deviceBreakdown.length === 0 ? (
            <p className="text-zinc-500 text-sm col-span-full">No device data.</p>
          ) : (
            deviceBreakdown.map(d => (
              <div
                key={d.category}
                className={`${adminPanelClass} px-4 py-4 hover:border-zinc-600/70 transition-colors`}
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{d.category}</p>
                <p className="text-xl font-semibold text-zinc-100 mt-1 tabular-nums">{d.users}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">users</p>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed max-w-2xl">
        Revenue, orders, and margins are intentionally not sourced from GA4. Use{" "}
        <span className="text-zinc-400">Sales</span> in the sidebar for store-backed financials.
      </p>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
  subtitle,
}: {
  label: string;
  value: number;
  hint?: string;
  subtitle?: string;
}) {
  return (
    <div className={`${adminPanelClass} p-4 hover:border-zinc-700/90 transition-colors`}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-50 mt-1 tabular-nums tracking-tight">{value}</p>
      {subtitle != null && (
        <p className="text-[11px] text-[#60A5FA]/90 mt-1 truncate" title={subtitle}>
          {subtitle}
        </p>
      )}
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function truncatePath(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
