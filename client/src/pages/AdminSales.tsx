import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  adminFilterControlClass,
  adminDashboardGridGapClass,
  adminFilterLabelClass,
  adminPageStackClass,
  adminPanelClass,
  adminPanelHeaderClass,
  adminRadiusPanelClass,
} from "@/components/admin/adminFilterBarStyles";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Download, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "today" | "7" | "30" | "month" | "custom";

/** Sales page only — dark glass hover (avoids shadcn accent / input hovers flashing bright). */
const salesHoverTransition =
  "transition-[background-color,border-color,box-shadow,color] duration-[180ms] ease-in-out";

const salesGlassHoverInteractive =
  `${salesHoverTransition} hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.10)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]`;

const salesTableRowHover =
  `${salesHoverTransition} hover:bg-[rgba(255,255,255,0.04)]`;

const salesSelectTriggerClass = cn(
  adminFilterControlClass,
  salesHoverTransition,
  "border-zinc-700 shadow-none dark:hover:!bg-[rgba(255,255,255,0.04)] hover:!border-[rgba(255,255,255,0.10)] hover:!shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus-visible:!ring-zinc-600/35"
);

const salesSelectContentClass =
  "bg-[#121214] border-zinc-800/90 text-zinc-200 shadow-lg [&_[data-slot=select-scroll-up-button]]:text-zinc-400 [&_[data-slot=select-scroll-down-button]]:text-zinc-400";

const salesSelectItemClass = cn(
  salesHoverTransition,
  "text-zinc-300 cursor-pointer rounded-sm outline-none",
  "data-[highlighted]:bg-[rgba(255,255,255,0.05)] data-[highlighted]:text-zinc-100",
  "focus:bg-[rgba(255,255,255,0.05)] focus:text-zinc-100"
);

const salesDateInputClass = cn(
  adminFilterControlClass,
  salesGlassHoverInteractive,
  "shadow-none focus-visible:!ring-zinc-600/35"
);

const salesSortBtnClass = cn(
  salesHoverTransition,
  "rounded-sm -mx-1 px-1 hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] hover:text-zinc-200"
);

/** Revenue & gross profit chart only — Recharts defaults tooltip cursor to `#ccc` (harsh on dark UI). */
const salesRevenueBarChartRootClass = cn(
  "[&_path.recharts-tooltip-cursor]:!fill-[rgba(255,255,255,0.06)] [&_path.recharts-tooltip-cursor]:!stroke-[rgba(255,255,255,0.1)]",
  "[&_.recharts-default-legend_.recharts-legend-item]:rounded-md [&_.recharts-default-legend_.recharts-legend-item]:transition-[background-color] [&_.recharts-default-legend_.recharts-legend-item]:duration-[180ms] [&_.recharts-default-legend_.recharts-legend-item]:ease-in-out",
  "[&_.recharts-default-legend_.recharts-legend-item:hover]:bg-[rgba(255,255,255,0.04)]"
);

const salesRevenueBarTooltipCursor = {
  fill: "rgba(255, 255, 255, 0.06)",
  stroke: "rgba(255, 255, 255, 0.10)",
  strokeWidth: 1,
} as const;

function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addCalendarDays(ymd: string, delta: number): string {
  const [y, mo, dd] = ymd.split("-").map(Number);
  const d = new Date(y, mo - 1, dd);
  d.setDate(d.getDate() + delta);
  return localYmd(d);
}

function firstOfMonthYmd(ref: Date) {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtMoney(n: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const body = rows.map(r => r.map(c => esc(c)).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Donut palette: blue accent family + neutral zinc (on-brand, not rainbow). */
const BRAND_SLICE_COLORS = [
  "rgba(96, 165, 250, 0.92)",
  "rgba(59, 130, 246, 0.88)",
  "rgba(37, 99, 235, 0.85)",
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#93C5FA",
] as const;

type SortKey = "profit" | "revenue" | "units" | "margin" | "cost";
type SortDir = "asc" | "desc";

function chartYAxisMoney(v: number) {
  const sign = v < 0 ? "-" : "";
  const n = Math.abs(v);
  if (n >= 1000) return `${sign}$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${sign}$${n}`;
}

export default function AdminSales() {
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState(() => localYmd(new Date()));
  const [customTo, setCustomTo] = useState(() => localYmd(new Date()));
  const [deliveryMethod, setDeliveryMethod] = useState<"all" | "shipping" | "pickup">("all");
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { dateFrom, dateTo, datesWereSwapped } = useMemo(() => {
    const today = localYmd(new Date());
    let from: string;
    let to: string;
    if (preset === "custom") {
      from = customFrom;
      to = customTo;
    } else if (preset === "today") {
      from = today;
      to = today;
    } else if (preset === "7") {
      from = addCalendarDays(today, -6);
      to = today;
    } else if (preset === "30") {
      from = addCalendarDays(today, -29);
      to = today;
    } else {
      from = firstOfMonthYmd(new Date());
      to = today;
    }
    if (from > to) {
      return { dateFrom: to, dateTo: from, datesWereSwapped: true };
    }
    return { dateFrom: from, dateTo: to, datesWereSwapped: false };
  }, [preset, customFrom, customTo]);

  const reportQuery = trpc.admin.getSalesReport.useQuery({
    dateFrom,
    dateTo,
    deliveryMethod,
  });

  const report = reportQuery.data;

  const chartData = useMemo(() => {
    if (!report?.series?.length) return [];
    return report.series.map(s => ({
      ...s,
      label: s.date.slice(5),
    }));
  }, [report]);

  const brandDonutSlices = useMemo(() => {
    const rows = report?.salesByBrand ?? [];
    if (rows.length === 0) return [];
    if (rows.length <= 6) return rows.map(r => ({ name: r.name, value: r.revenue }));
    const top = rows.slice(0, 5);
    const restSum = rows.slice(5).reduce((s, r) => s + r.revenue, 0);
    return [
      ...top.map(r => ({ name: r.name, value: r.revenue })),
      { name: "Other categories", value: restSum },
    ];
  }, [report]);

  const brandTotal = useMemo(
    () => brandDonutSlices.reduce((s, d) => s + d.value, 0),
    [brandDonutSlices]
  );

  const deliverySliceTotal =
    report != null ? report.revenueByDelivery.shipping + report.revenueByDelivery.pickup : 0;

  const sortedProfitability = useMemo(() => {
    const rows = report?.productProfitability ?? [];
    const dir = sortDir === "desc" ? -1 : 1;
    const copy = [...rows];
    copy.sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === "profit") {
        av = a.profit;
        bv = b.profit;
      } else if (sortKey === "revenue") {
        av = a.revenue;
        bv = b.revenue;
      } else if (sortKey === "units") {
        av = a.unitsSold;
        bv = b.unitsSold;
      } else if (sortKey === "cost") {
        av = a.cost;
        bv = b.cost;
      } else {
        av = a.marginPct ?? -Infinity;
        bv = b.marginPct ?? -Infinity;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [report, sortKey, sortDir]);

  const exportCsv = () => {
    if (!report) return;
    const rows: string[][] = [
      ["The Hookah Shop Sales Report"],
      ["Date from", report.dateFrom],
      ["Date to", report.dateTo],
      ["Delivery filter", report.deliveryMethod],
      [],
      ["Gross sales", String(report.grossSales)],
      ["Refunds", String(report.refundedTotal)],
      ["Net sales", String(report.netSales)],
      ["Total cost (matched lines)", String(report.totalCost)],
      ["Gross profit", String(report.grossProfit)],
      [
        "Profit margin (on gross)",
        report.profitMargin != null && Number.isFinite(report.profitMargin)
          ? String(report.profitMargin)
          : "",
      ],
      ["Net profit after refunds", String(report.netProfitAfterRefunds)],
      ["Avg order value (paid)", String(report.averageOrderValue ?? "")],
      ["Orders in range", String(report.orderCount)],
      ["Paid orders", String(report.paidOrderCount)],
      ["Pending orders", String(report.pendingOrderCount)],
      ["Shipping / pickup (paid)", `${report.shippingOrders} / ${report.pickupOrders}`],
      ["Unknown cost line items", String(report.unknownCostLineCount)],
      [],
      ["Lines missing COGS (order line, reason, inventory hint)"],
      ...report.unknownCostLines.map(row => [
        row.lineName,
        row.reason,
        row.matchedInventoryLabel ?? "",
      ]),
      [],
      ["Top products (name, units, revenue, cost, profit)"],
    ];
    for (const p of report.topProducts.slice(0, 20)) {
      rows.push([p.name, String(p.units), String(p.revenue), String(p.cost), String(p.profit)]);
    }
    downloadCsv(`boss-hookah-sales-${report.dateFrom}_${report.dateTo}.csv`, rows);
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const salesFiltersBar = (
    <div className="flex w-full min-w-0 flex-row flex-wrap items-end justify-end gap-x-3 gap-y-2 sm:gap-x-4 lg:flex-nowrap">
      <div className="flex min-w-0 flex-col gap-1 shrink-0">
        <label className={adminFilterLabelClass}>Date range</label>
        <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
          {(
            [
              ["today", "Today"],
              ["7", "7d"],
              ["30", "30d"],
              ["month", "Month"],
              ["custom", "Custom"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              className={cn(
                "h-8 shrink-0 rounded-md px-2.5 text-[11px] font-medium",
                preset === k
                  ? "bg-[#172554] text-[#93C5FA] border border-[#1E40AF]/40 hover:bg-[#1E3A8A]"
                  : `text-zinc-400 border border-transparent ${salesGlassHoverInteractive}`
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {preset === "custom" && (
        <div className="flex min-w-0 shrink-0 flex-col gap-1">
          <label className={adminFilterLabelClass}>Dates</label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className={cn(salesDateInputClass, "w-36 shrink-0")}
            />
            <span className="text-zinc-600 text-xs">–</span>
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className={cn(salesDateInputClass, "w-36 shrink-0")}
            />
          </div>
        </div>
      )}
      <div className="flex w-full min-w-[9.5rem] shrink-0 flex-col gap-1 sm:w-44">
        <label className={adminFilterLabelClass}>Delivery</label>
        <Select value={deliveryMethod} onValueChange={(v: "all" | "shipping" | "pickup") => setDeliveryMethod(v)}>
          <SelectTrigger className={salesSelectTriggerClass}>
            <SelectValue placeholder="Delivery" />
          </SelectTrigger>
          <SelectContent className={salesSelectContentClass}>
            <SelectItem className={salesSelectItemClass} value="all">
              All delivery
            </SelectItem>
            <SelectItem className={salesSelectItemClass} value="shipping">
              Shipping
            </SelectItem>
            <SelectItem className={salesSelectItemClass} value="pickup">
              Pickup
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <span className={`${adminFilterLabelClass} select-none text-transparent`} aria-hidden>
          &nbsp;
        </span>
        <Button
          type="button"
          size="sm"
          className="h-9 min-h-9 bg-[#1E40AF] text-[#DBEAFE] border border-[#2563EB]/50 text-xs px-3 transition-[background-color,box-shadow,color] duration-[180ms] ease-in-out hover:!bg-[#1D4ED8] hover:!shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:!ring-2 focus-visible:!ring-[#2563EB]/40"
          disabled={!report || reportQuery.isFetching}
          onClick={exportCsv}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>
    </div>
  );

  return (
    <AdminShell
      title="Sales"
      subtitle="Revenue, cost, and profit (paid orders in range)"
      headerTrailing={salesFiltersBar}
    >
      <div className={adminPageStackClass}>
        {reportQuery.isError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 text-red-200 text-sm px-4 py-3">
            {reportQuery.error.message}
          </div>
        )}

        {report?.hasUnknownCost && (
          <div className="flex gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 text-amber-100/90 text-xs px-4 py-3">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="min-w-0 space-y-2">
              <p>
                Some paid order lines have no COGS ({report.unknownCostLineCount} line
                {report.unknownCostLineCount === 1 ? "" : "s"}). Fix in{" "}
                <Link
                  href="/admin/inventory"
                  className="text-amber-200 underline underline-offset-2 transition-colors duration-[180ms] ease-in-out hover:text-amber-100"
                >
                  Inventory
                </Link>{" "}
                so revenue and profit match.
              </p>
              {report.unknownCostLines.length > 0 && (
                <ul className="list-disc pl-4 space-y-1 text-amber-100/85">
                  {report.unknownCostLines.map(row => (
                    <li key={row.lineName} className="break-words">
                      <span className="font-medium text-amber-50">{row.lineName}</span>
                      {row.reason === "cost_not_set" && row.matchedInventoryLabel ? (
                        <span>
                          {" "}
                          — set <strong>unit cost</strong> on: {row.matchedInventoryLabel}
                        </span>
                      ) : row.reason === "cost_not_set" ? (
                        <span> — set <strong>unit cost</strong> on the matched inventory row</span>
                      ) : (
                        <span>
                          {" "}
                          — no product <em>with unit cost</em> matches this line text; add or rename an inventory
                          product (e.g. match checkout: Brand — Name)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {datesWereSwapped && (
          <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 text-amber-100/90 text-xs px-4 py-2">
            Start date was after end date — range was swapped for this report.
          </div>
        )}

        {!report && reportQuery.isFetching && (
          <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">Loading report…</div>
        )}

        {report && (
          <>
            <div className={`grid grid-cols-2 lg:grid-cols-4 ${adminDashboardGridGapClass}`}>
              <Kpi label="Total orders" value={String(report.orderCount)} hint="All statuses in range" />
              <Kpi label="Total revenue" value={fmtMoney(report.grossSales)} hint="Paid orders" accent />
              <Kpi label="Paid orders" value={String(report.paidOrderCount)} />
              <Kpi
                label="Avg order value"
                value={report.averageOrderValue != null ? fmtMoney(report.averageOrderValue) : "—"}
                hint="Paid orders"
              />
            </div>

            <div className={`${adminPanelClass} p-4 md:p-5`}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Revenue & gross profit</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Daily totals · paid orders in range</p>
                </div>
              </div>
              {chartData.length === 0 ? (
                <EmptyChart msg="No paid sales in this range for the chart." />
              ) : (
                <div className={salesRevenueBarChartRootClass}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                      barCategoryGap="14%"
                      barGap={6}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="label" stroke="#71717a" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={{ stroke: "#3f3f46" }} />
                      <YAxis
                        stroke="#71717a"
                        tick={{ fill: "#71717a", fontSize: 11 }}
                        tickFormatter={(v: number) => chartYAxisMoney(Number(v))}
                        axisLine={{ stroke: "#3f3f46" }}
                        width={52}
                      />
                      <Tooltip
                        cursor={salesRevenueBarTooltipCursor}
                        contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(v: unknown, name: string) => [fmtMoney(Number(v)), name]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        inactiveColor="#52525b"
                        wrapperStyle={{ fontSize: 12, color: "#a1a1aa", paddingBottom: 8 }}
                      />
                      <Bar dataKey="revenue" name="Revenue" fill="#52525b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar
                        dataKey="profit"
                        name="Gross profit"
                        fill="rgba(163, 230, 53, 0.88)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-2 ${adminDashboardGridGapClass} lg:items-stretch`}>
              <div className={`${adminPanelClass} flex flex-col min-h-[20rem] overflow-hidden`}>
                <div className={adminPanelHeaderClass}>
                  <p className="text-sm font-medium text-zinc-200">Sales by product category</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    By brand on matched catalog products · line revenue
                  </p>
                </div>
                <div className="p-4 flex-1 flex flex-col sm:flex-row gap-4 items-stretch min-h-[15rem]">
                  {brandTotal <= 0 || brandDonutSlices.length === 0 ? (
                    <p className="text-zinc-500 text-sm m-auto text-center px-4">
                      No category data — add brands to products in Inventory or widen the date range.
                    </p>
                  ) : (
                    <>
                      <ul className="w-full sm:w-[42%] shrink-0 space-y-2 flex flex-col justify-center">
                        {brandDonutSlices.map((row, i) => {
                          const pct = brandTotal > 0 ? (row.value / brandTotal) * 100 : 0;
                          return (
                            <li key={row.name} className="flex items-center gap-2 text-xs">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: BRAND_SLICE_COLORS[i % BRAND_SLICE_COLORS.length] }}
                                aria-hidden
                              />
                              <span className="text-zinc-300 truncate flex-1 min-w-0" title={row.name}>
                                {row.name}
                              </span>
                              <span className="text-zinc-500 tabular-nums shrink-0">{pct.toFixed(0)}%</span>
                              <span className="text-zinc-200 tabular-nums shrink-0 w-[4.5rem] text-right">
                                {fmtMoney(row.value)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex-1 w-full h-[220px] min-h-[220px]">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={brandDonutSlices}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius="58%"
                              outerRadius="82%"
                              paddingAngle={2}
                              stroke="#18181b"
                              strokeWidth={1}
                            >
                              {brandDonutSlices.map((_, i) => (
                                <Cell key={i} fill={BRAND_SLICE_COLORS[i % BRAND_SLICE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                              formatter={(v: unknown) => fmtMoney(Number(v))}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={`${adminPanelClass} flex flex-col min-h-[20rem] overflow-hidden`}>
                <div className={adminPanelHeaderClass}>
                  <p className="text-sm font-medium text-zinc-200">Sales by delivery</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Paid order totals · shipping vs pickup</p>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-center gap-5 min-h-[15rem]">
                  {deliverySliceTotal <= 0 ? (
                    <p className="text-zinc-500 text-sm text-center">No paid delivery revenue in this range.</p>
                  ) : (
                    <>
                      {(
                        [
                          { key: "ship", label: "Shipping", value: report.revenueByDelivery.shipping, fill: "#52525b" },
                          { key: "pick", label: "Pickup", value: report.revenueByDelivery.pickup, fill: "rgba(163, 230, 53, 0.9)" },
                        ] as const
                      ).map(row => {
                        const pct = deliverySliceTotal > 0 ? (row.value / deliverySliceTotal) * 100 : 0;
                        return (
                          <div key={row.key}>
                            <div className="flex items-center justify-between text-xs gap-3 mb-1.5">
                              <span className="flex items-center gap-2 text-zinc-300">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.fill }} />
                                {row.label}
                              </span>
                              <span className="text-zinc-200 tabular-nums font-medium">{fmtMoney(row.value)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-800/90 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-[width]"
                                style={{ width: `${Math.max(4, pct)}%`, backgroundColor: row.fill }}
                              />
                            </div>
                            <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">{pct.toFixed(1)}% of paid revenue</p>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className={`${adminPanelClass} overflow-hidden`}>
              <div className={adminPanelHeaderClass}>
                <p className="text-sm font-medium text-zinc-200">Top products</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">By revenue in range (paid lines)</p>
              </div>
              {report.topProducts.length === 0 ? (
                <p className="py-10 text-center text-zinc-500 text-sm">No product lines in paid orders for this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0c0c0e] border-b border-zinc-800/90">
                        <th className="text-left px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium">Product</th>
                        <th className="text-right px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium">Units</th>
                        <th className="text-right px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium">Revenue</th>
                        <th className="text-right px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium">Cost</th>
                        <th className="text-right px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {report.topProducts.slice(0, 12).map(p => (
                        <tr key={p.name} className={salesTableRowHover}>
                          <td className="px-4 py-2.5 text-zinc-200 max-w-[220px] truncate">{p.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{p.units}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{fmtMoney(p.revenue)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{fmtMoney(p.cost)}</td>
                          <td
                            className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                              p.profit >= 0 ? "text-[#93C5FA]" : "text-red-300"
                            }`}
                          >
                            {fmtMoney(p.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={`${adminPanelClass} w-full overflow-hidden`}>
              <div className={`${adminPanelHeaderClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Product profitability</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Paid order lines · click column to sort</p>
                </div>
              </div>
              {sortedProfitability.length === 0 ? (
                <p className="py-10 text-center text-zinc-500 text-sm">No data for this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[720px]">
                    <thead>
                      <tr className="bg-[#0c0c0e] border-b border-zinc-800/90">
                        <th className="text-left px-4 py-2.5 text-zinc-500 font-medium">Product</th>
                        <SortTh label="Units" k="units" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                        <SortTh label="Revenue" k="revenue" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                        <SortTh label="Cost" k="cost" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                        <SortTh label="Profit" k="profit" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                        <SortTh label="Margin" k="margin" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {sortedProfitability.slice(0, 40).map(row => (
                        <tr key={row.name} className={salesTableRowHover}>
                          <td className="px-4 py-2.5 text-zinc-200 max-w-[200px] truncate">{row.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{row.unitsSold}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">{fmtMoney(row.revenue)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{fmtMoney(row.cost)}</td>
                          <td
                            className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                              row.profit >= 0 ? "text-[#93C5FA]" : "text-red-300"
                            }`}
                          >
                            {fmtMoney(row.profit)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                            {row.marginPct != null && Number.isFinite(row.marginPct)
                              ? `${row.marginPct.toFixed(1)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {report && report.grossSales === 0 && report.paidOrderCount === 0 && (
          <p className="text-center text-zinc-500 text-sm py-6">
            No paid sales in this range. Try a wider date range or another delivery filter.
          </p>
        )}
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div
      className={`${adminRadiusPanelClass} border px-4 py-3.5 bg-[#121214] shadow-sm min-h-[5.75rem] flex flex-col justify-center ${
        accent ? "border-[#1E40AF]/40 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.14)]" : "border-zinc-800/90"
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className={`text-lg font-semibold mt-1 tabular-nums ${accent ? "text-[#93C5FA]" : "text-zinc-50"}`}>{value}</p>
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

function EmptyChart({ msg = "No series data for this range." }: { msg?: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm px-4 text-center">{msg}</div>
  );
}

function SortTh({
  label,
  k,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align: "left" | "right";
}) {
  return (
    <th className={`px-4 py-2.5 text-[10px] uppercase text-zinc-500 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          salesSortBtnClass,
          active === k ? "text-[#60A5FA] hover:text-[#93C5FA]" : "text-zinc-500"
        )}
      >
        {label}
        {active === k ? (dir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}
