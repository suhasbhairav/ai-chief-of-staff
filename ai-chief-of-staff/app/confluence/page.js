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

const formatDateTime = (value) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const fetchConfluenceOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/confluence/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Confluence overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Pages", summary.totalPages ?? 0, "Synced Confluence pages included in CEO knowledge review."],
  ["Spaces", summary.totalSpaces ?? 0, "Confluence spaces represented in the sync."],
  ["Updated 30D", summary.recentlyUpdated ?? 0, "Pages updated in the last 30 days."],
  ["Stale Pages", summary.stalePages ?? 0, "Pages not updated in 120+ days."],
  ["Roadmaps", summary.roadmapPages ?? 0, "Roadmap, strategy, OKR, launch, release, and planning pages."],
  ["Policies", summary.policyPages ?? 0, "Policy, process, runbook, security, compliance, and playbook pages."],
];

export default function ConfluencePage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchConfluenceOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Confluence overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const spaceData = useMemo(() => (summary.spaceBreakdown || []).slice(0, 10), [summary.spaceBreakdown]);
  const ownerData = useMemo(() => (summary.ownerBreakdown || []).slice(0, 10), [summary.ownerBreakdown]);
  const typeData = useMemo(() => (summary.typeBreakdown || []).slice(0, 10), [summary.typeBreakdown]);
  const topPages = summary.topPages || [];

  const syncConfluence = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchConfluenceOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Confluence.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              Confluence knowledge, roadmap, and policy intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Confluence Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Confluence spaces and pages to track operating knowledge freshness, owner coverage, roadmap documentation, policies, runbooks, and executive source-of-truth health.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Confluence
            </Link>
            <button type="button" onClick={syncConfluence} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-600 px-4 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Confluence..." : "Sync Confluence"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Atlassian env vars in Vercel or connect Confluence from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Confluence overview...
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
              ["Pages by Space", spaceData, "#22d3ee"],
              ["Pages by Owner", ownerData, "#38bdf8"],
              ["Content by Type", typeData, "#a78bfa"],
            ].map(([title, data, color]) => (
              <div key={title} className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                      <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                      <Bar dataKey="count" name="Pages" fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Executive Knowledge Queue</h2>
                <p className="mt-1 text-xs text-zinc-500">Roadmap, policy, and recently maintained Confluence pages surfaced for CEO review.</p>
              </div>
              <div className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</div>
            </div>

            {topPages.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Page</th>
                      <th className="py-2 pr-4 font-medium">Space</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Updated</th>
                      <th className="py-2 font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topPages.map((page) => (
                      <tr key={page.id}>
                        <td className="py-3 pr-4">
                          <a href={page.url || "#"} target="_blank" className="font-medium text-white hover:text-cyan-200">
                            {page.title}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{page.spaceKey || page.spaceName || "Unknown"}</td>
                        <td className="py-3 pr-4">{page.owner}</td>
                        <td className="py-3 pr-4 text-zinc-400">{page.updatedAt ? formatDateTime(page.updatedAt) : "n/a"}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {page.isRoadmap && <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">Roadmap</span>}
                            {page.isPolicy && <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">Policy</span>}
                            {page.isStale && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Stale</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                No Confluence pages synced yet. Connect Confluence and click Sync Confluence.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
