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

const fetchJiraOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/jira/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Jira overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Open Issues", summary.openIssues ?? 0, "Active Jira work still moving through delivery."],
  ["High Priority", summary.highPriorityIssues ?? 0, "Open critical, blocker, urgent, high, or highest priority issues."],
  ["Overdue", summary.overdueIssues ?? 0, "Open Jira issues past due date."],
  ["Stale", summary.staleIssues ?? 0, "Open issues with no update in 14+ days."],
  ["Completed 30D", summary.completedLast30Days ?? 0, "Issues resolved in the last 30 days."],
  ["Roadmap Issues", summary.roadmapIssues ?? 0, "Epics, initiatives, releases, milestones, and roadmap-like work."],
];

export default function JiraPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchJiraOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Jira overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const statusData = useMemo(() => (summary.statusBreakdown || []).slice(0, 10), [summary.statusBreakdown]);
  const projectData = useMemo(() => (summary.projectBreakdown || []).slice(0, 10), [summary.projectBreakdown]);
  const assigneeData = useMemo(() => (summary.assigneeBreakdown || []).slice(0, 10), [summary.assigneeBreakdown]);
  const topRisks = summary.topRisks || [];

  const syncJira = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchJiraOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Jira.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
              Jira execution, project, and delivery risk intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Jira Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Jira issues and projects to track delivery load, stale execution, overdue work, priority pressure, roadmap items, and owner accountability.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Jira
            </Link>
            <button type="button" onClick={syncJira} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Jira..." : "Sync Jira"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Atlassian env vars in Vercel or connect Jira from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Jira overview...
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
              ["Open Issues by Status", statusData, "#3b82f6"],
              ["Open Issues by Project", projectData, "#22d3ee"],
              ["Open Issues by Assignee", assigneeData, "#818cf8"],
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
                      <Bar dataKey="count" name="Open Issues" fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Jira Risk Queue</h2>
                <p className="mt-1 text-xs text-zinc-500">Open issues ranked by overdue status, staleness, priority, and age.</p>
              </div>
              <div className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</div>
            </div>

            {topRisks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Issue</th>
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 font-medium">Priority</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Due</th>
                      <th className="py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topRisks.map((issue) => (
                      <tr key={issue.id}>
                        <td className="py-3 pr-4">
                          <a href={issue.url || "#"} target="_blank" className="font-medium text-white hover:text-blue-200">
                            {issue.key}: {issue.summary}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.projectKey}</td>
                        <td className="py-3 pr-4 text-blue-200">{issue.priority}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.status}</td>
                        <td className="py-3 pr-4">{issue.assignee}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.dueDate || "n/a"}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {issue.isOverdue && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">Overdue</span>}
                            {issue.isStale && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Stale</span>}
                            {issue.isHighPriority && <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-200">Priority</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                No Jira issues synced yet. Connect Jira and click Sync Jira.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
