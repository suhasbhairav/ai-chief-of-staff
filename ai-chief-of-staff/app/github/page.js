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

const fetchGitHubOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/github/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load GitHub overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Repositories", summary.totalRepositories ?? 0, "Authorized repos included in CEO engineering rollup."],
  ["Open PRs", summary.openPullRequests ?? 0, "Pull requests waiting on review, fixes, or merge."],
  ["Draft PRs", summary.draftPullRequests ?? 0, "Work visible but not yet review-ready."],
  ["Stale PRs", summary.stalePullRequests ?? 0, "Open PRs with no update in 7+ days."],
  ["Open Bugs", summary.openBugs ?? 0, "Open issues labeled as bugs, defects, regressions, incidents, or P0/P1."],
  ["Stale Issues", summary.staleIssues ?? 0, "Open issues with no update in 14+ days."],
];

export default function GitHubPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchGitHubOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load GitHub overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const prsByRepo = useMemo(() => (summary.prsByRepo || []).slice(0, 10), [summary.prsByRepo]);
  const issuesByRepo = useMemo(() => (summary.issuesByRepo || []).slice(0, 10), [summary.issuesByRepo]);
  const bugsByRepo = useMemo(() => (summary.bugsByRepo || []).slice(0, 10), [summary.bugsByRepo]);
  const languageBreakdown = useMemo(() => (summary.languageBreakdown || []).slice(0, 8), [summary.languageBreakdown]);
  const topRisks = summary.topRisks || [];
  const pullRequests = (store?.pullRequests || []).filter((pr) => pr.isOpen).slice(0, 20);
  const openBugs = (store?.issues || []).filter((issue) => issue.isOpen && issue.isBug).slice(0, 20);

  const syncGitHub = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchGitHubOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync GitHub.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-zinc-100 via-sky-400 to-emerald-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
              GitHub PR, bug, and repository execution intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO GitHub Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync GitHub repositories to track pull request flow, open bugs, stale engineering work, repo concentration, language footprint, and delivery risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure GitHub
            </Link>
            <button type="button" onClick={syncGitHub} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing GitHub..." : "Sync GitHub"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add GitHub env vars in Vercel or connect GitHub from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading GitHub overview...
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

          <section className="grid gap-5 xl:grid-cols-4">
            {[
              ["Open PRs by Repo", prsByRepo, "#38bdf8"],
              ["Open Issues by Repo", issuesByRepo, "#818cf8"],
              ["Open Bugs by Repo", bugsByRepo, "#fb7185"],
              ["Repository Languages", languageBreakdown, "#34d399"],
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
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">PR Review Queue</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Pull Request</th>
                      <th className="py-2 pr-4 font-medium">Repo</th>
                      <th className="py-2 pr-4 font-medium">Author</th>
                      <th className="py-2 pr-4 font-medium">Age</th>
                      <th className="py-2 font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {pullRequests.map((pr) => (
                      <tr key={pr.id}>
                        <td className="py-3 pr-4">
                          <a href={pr.htmlUrl || "#"} target="_blank" className="font-medium text-white hover:text-sky-200">
                            #{pr.number} {pr.title}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{pr.repo}</td>
                        <td className="py-3 pr-4">{pr.author}</td>
                        <td className="py-3 pr-4 text-zinc-400">{pr.ageDays}d</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {pr.draft && <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-1 text-[10px] text-zinc-300">Draft</span>}
                            {pr.isStale && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Stale</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!pullRequests.length && <div className="p-8 text-center text-sm text-zinc-500">No open PRs synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">Open Bug Queue</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Bug</th>
                      <th className="py-2 pr-4 font-medium">Repo</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Age</th>
                      <th className="py-2 font-medium">Labels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {openBugs.map((issue) => (
                      <tr key={issue.id}>
                        <td className="py-3 pr-4">
                          <a href={issue.htmlUrl || "#"} target="_blank" className="font-medium text-white hover:text-rose-200">
                            #{issue.number} {issue.title}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.repo}</td>
                        <td className="py-3 pr-4">{issue.assignees?.join(", ") || "Unassigned"}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.ageDays}d</td>
                        <td className="py-3 text-zinc-400">{(issue.labels || []).slice(0, 4).join(", ") || "bug"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!openBugs.length && <div className="p-8 text-center text-sm text-zinc-500">No open bug-labeled issues synced yet.</div>}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Engineering Risk Queue</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topRisks.map((item) => (
                <a key={`${item.id}-${item.riskType}`} href={item.htmlUrl || "#"} target="_blank" className="rounded-lg border border-zinc-800 bg-[#15151a] p-4 transition hover:border-sky-500/40">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-200">{item.riskType}</span>
                    <span className="text-[10px] text-zinc-500">{item.ageDays}d old</span>
                  </div>
                  <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.title}</div>
                  <div className="mt-2 text-xs text-zinc-500">{item.repo}</div>
                </a>
              ))}
            </div>
            {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No GitHub risk queue yet. Connect GitHub and click Sync GitHub.</div>}
          </section>
        </>
      )}
    </div>
  );
}
