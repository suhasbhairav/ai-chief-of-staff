"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const money = (value) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const fetchSalesforceOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/salesforce/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Salesforce overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Open Pipeline", money(summary.openPipelineAmount), "Active opportunity amount in Salesforce."],
  ["Weighted Pipeline", money(summary.weightedPipelineAmount), "Probability-adjusted opportunity amount."],
  ["Q Forecast", money(summary.forecastThisQuarter), "Weighted open pipeline closing this quarter."],
  ["Closed Won", money(summary.closedWonAmount), "Recently synced closed-won opportunity amount."],
  ["Open Opps", summary.openOpportunities ?? 0, "Open Salesforce opportunities."],
  ["Open Leads", summary.openLeads ?? 0, "Unconverted Salesforce leads."],
];

export default function SalesforcePage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchSalesforceOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Salesforce overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const stageData = useMemo(() => (summary.stageBreakdown || []).slice(0, 10), [summary.stageBreakdown]);
  const ownerData = useMemo(() => (summary.ownerBreakdown || []).slice(0, 10), [summary.ownerBreakdown]);
  const leadSourceData = useMemo(() => (summary.leadSourceBreakdown || []).slice(0, 10), [summary.leadSourceBreakdown]);
  const topOpenOpportunities = summary.topOpenOpportunities || [];
  const topRisks = summary.topRisks || [];

  const syncSalesforce = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchSalesforceOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Salesforce.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
              Salesforce CRM, pipeline, lead, account, and forecast intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Salesforce Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Salesforce accounts, opportunities, and leads to inspect pipeline quality, forecast coverage, stale deals, overdue close dates, owner load, and lead source health.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Salesforce
            </Link>
            <button type="button" onClick={syncSalesforce} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Salesforce..." : "Sync Salesforce"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Salesforce env vars in Vercel or connect Salesforce from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Salesforce overview...
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

          <section className="grid gap-5 xl:grid-cols-3">
            {[
              ["Open Opps by Stage", stageData, "#38bdf8"],
              ["Open Opps by Owner", ownerData, "#818cf8"],
              ["Open Leads by Source", leadSourceData, "#22d3ee"],
            ].map(([title, data, color]) => (
              <div key={title} className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                      <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                      <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top Open Opportunities</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Opportunity</th>
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Close</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 font-medium">Prob.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topOpenOpportunities.map((opp) => (
                      <tr key={opp.id}>
                        <td className="py-3 pr-4 font-medium text-white">{opp.name}</td>
                        <td className="py-3 pr-4 text-zinc-400">{opp.stage}</td>
                        <td className="py-3 pr-4">{opp.owner}</td>
                        <td className="py-3 pr-4 text-zinc-400">{opp.closeDate || "n/a"}</td>
                        <td className="py-3 pr-4 text-sky-200">{money(opp.amount)}</td>
                        <td className="py-3">{opp.probability}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!topOpenOpportunities.length && <div className="p-8 text-center text-sm text-zinc-500">No Salesforce opportunities synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Salesforce Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((item) => (
                  <div key={`${item.id}-${item.riskType}`} className="rounded-lg border border-zinc-800 bg-[#15151a] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-200">{item.riskType}</span>
                      <span className="text-[10px] text-zinc-500">{money(item.amount || 0)}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.name}</div>
                    <div className="mt-2 text-xs text-zinc-500">{item.owner || item.company || "Unassigned"}</div>
                  </div>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No Salesforce risks yet. Connect Salesforce and click Sync Salesforce.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
