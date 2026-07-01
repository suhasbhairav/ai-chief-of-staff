"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";

const money = (value) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value || 0) >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const fetchHubSpotDeals = async ({ sync = false } = {}) => {
  const response = await fetch("/api/hubspot/deals", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load HubSpot deals.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Open Pipeline", money(summary.openPipelineAmount), "Raw amount across open HubSpot deals."],
  ["Weighted Pipeline", money(summary.weightedPipelineAmount), "Stage-probability adjusted open pipeline."],
  ["Next 90d Forecast", money(summary.forecastNext90Days), "Weighted open deals closing in the next 90 days."],
  ["Stale Deals", summary.staleDeals ?? 0, "Open deals with no update in 30+ days."],
  ["Open Deals", summary.openDeals ?? 0, "Active deal count."],
  ["Avg Deal Size", money(summary.avgDealSize), "Average open opportunity value."],
];

export default function PipelinePage() {
  const [pipelineStore, setPipelineStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchHubSpotDeals()
        .then((store) => {
          setPipelineStore(store);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load HubSpot pipeline.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = pipelineStore?.summary || {};
  const stageData = useMemo(
    () => (summary.stageBreakdown || []).slice(0, 10),
    [summary.stageBreakdown]
  );
  const pipelineData = useMemo(
    () => (summary.pipelineBreakdown || []).slice(0, 8),
    [summary.pipelineBreakdown]
  );
  const topDeals = summary.topOpenDeals || [];

  const syncDeals = async () => {
    setSyncing(true);
    setError("");
    try {
      const store = await fetchHubSpotDeals({ sync: true });
      setPipelineStore(store);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync HubSpot deals.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
              HubSpot CRM pipeline intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Deal Pipeline
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Track the entire HubSpot deal pipeline from a CEO lens: open pipeline, weighted forecast, stage concentration, stale opportunities, owner accountability, and top revenue moves.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/integrations"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]"
            >
              Configure HubSpot
            </Link>
            <button
              type="button"
              onClick={syncDeals}
              disabled={syncing}
              className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-4 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? "Syncing Deals..." : "Sync HubSpot Deals"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add `HUBSPOT_ACCESS_TOKEN` in Vercel or connect HubSpot from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading HubSpot pipeline...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricCards(summary).map(([label, value, description]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-[#101013] p-4">
                <div className="text-xs font-medium text-zinc-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
              </div>
            ))}
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pipeline by Stage</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickFormatter={money} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      formatter={(value) => money(value)}
                    />
                    <Bar dataKey="amount" name="Open Amount" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="weightedAmount" name="Weighted" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pipeline by HubSpot Pipeline</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickFormatter={money} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      formatter={(value) => money(value)}
                    />
                    <Bar dataKey="amount" name="Open Amount" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top Open Deals</h2>
                <p className="mt-1 text-xs text-zinc-500">Largest open opportunities ranked by amount.</p>
              </div>
              <div className="text-xs text-zinc-500">
                Last synced: {formatDateTime(pipelineStore?.syncedAt)}
              </div>
            </div>

            {topDeals.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Deal</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">Weighted</th>
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-4 font-medium">Pipeline</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Close Date</th>
                      <th className="py-2 font-medium">Stale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topDeals.map((deal) => (
                      <tr key={deal.id}>
                        <td className="py-3 pr-4 font-medium text-white">{deal.name}</td>
                        <td className="py-3 pr-4 text-orange-200">{money(deal.amount)}</td>
                        <td className="py-3 pr-4 text-emerald-200">{money(deal.weightedAmount)}</td>
                        <td className="py-3 pr-4 text-zinc-400">{deal.stage}</td>
                        <td className="py-3 pr-4 text-zinc-400">{deal.pipeline}</td>
                        <td className="py-3 pr-4">{deal.owner}</td>
                        <td className="py-3 pr-4 text-zinc-400">{deal.closeDate || "n/a"}</td>
                        <td className="py-3">
                          {deal.isStale ? (
                            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
                              {deal.lastActivityDays}d
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                              Fresh
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                No HubSpot deals synced yet. Connect HubSpot and click Sync HubSpot Deals.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
