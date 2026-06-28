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

const fetchClickUpOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/clickup/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load ClickUp overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Goals", summary.totalGoals ?? 0, "ClickUp Goals tracked as OKRs."],
  ["Goal Progress", summary.avgGoalProgress === null ? "n/a" : `${summary.avgGoalProgress ?? 0}%`, "Average progress across ClickUp Goals."],
  ["Open Tasks", summary.openTasks ?? 0, "Active ClickUp tasks across the workspace."],
  ["Overdue", summary.overdueTasks ?? 0, "Open tasks past their due date."],
  ["Stale", summary.staleTasks ?? 0, "Open tasks with no update in 14+ days."],
  ["Roadmap Items", summary.roadmapItems ?? 0, "Tasks detected as roadmap, milestones, releases, epics, goals, or initiatives."],
];

export default function ClickUpPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchClickUpOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load ClickUp overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const statusData = useMemo(() => (summary.statusBreakdown || []).slice(0, 10), [summary.statusBreakdown]);
  const ownerData = useMemo(() => (summary.ownerBreakdown || []).slice(0, 10), [summary.ownerBreakdown]);
  const topRisks = summary.topRisks || [];
  const goals = store?.goals || [];
  const roadmaps = store?.roadmaps || [];

  const syncClickUp = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchClickUpOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync ClickUp.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              ClickUp OKRs, tasks, and roadmap intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO ClickUp Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              For teams running execution in ClickUp: sync Goals as OKRs, workspace tasks, roadmap-style initiatives, views, owners, overdue work, stale work, and CEO risk queue.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/integrations"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]"
            >
              Configure ClickUp
            </Link>
            <button
              type="button"
              onClick={syncClickUp}
              disabled={syncing}
              className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? "Syncing ClickUp..." : "Sync ClickUp"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add `CLICKUP_API_TOKEN` in Vercel, configure OAuth, or connect ClickUp from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading ClickUp overview...
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Open Tasks by Status</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Open Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Open Tasks by Owner</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Open Tasks" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">ClickUp Goals / OKRs</h2>
              <div className="mt-4 space-y-3">
                {goals.slice(0, 8).map((goal) => (
                  <div key={goal.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{goal.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">{goal.owners?.join(", ") || "No owner detected"}</div>
                      </div>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                        {goal.progress === null ? "n/a" : `${goal.progress}%`}
                      </span>
                    </div>
                  </div>
                ))}
                {!goals.length && <p className="text-sm text-zinc-500">No ClickUp Goals synced yet.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Roadmap Items</h2>
              <div className="mt-4 space-y-3">
                {roadmaps.slice(0, 8).map((task) => (
                  <div key={task.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="text-sm font-semibold text-white">{task.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>{task.status}</span>
                      <span>{task.list}</span>
                      <span>{task.assignees?.join(", ") || "Unassigned"}</span>
                    </div>
                  </div>
                ))}
                {!roadmaps.length && <p className="text-sm text-zinc-500">No roadmap-style tasks detected yet.</p>}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Risk Queue</h2>
                <p className="mt-1 text-xs text-zinc-500">Open ClickUp tasks ranked by overdue status, staleness, priority, and age.</p>
              </div>
              <div className="text-xs text-zinc-500">
                Last synced: {formatDateTime(store?.syncedAt)}
              </div>
            </div>

            {topRisks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Task</th>
                      <th className="py-2 pr-4 font-medium">Priority</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">List</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Due</th>
                      <th className="py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topRisks.map((task) => (
                      <tr key={task.id}>
                        <td className="py-3 pr-4">
                          <a href={task.url} target="_blank" className="font-medium text-white hover:text-emerald-200">
                            {task.name}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-emerald-200">{task.priority}</td>
                        <td className="py-3 pr-4 text-zinc-400">{task.status}</td>
                        <td className="py-3 pr-4">{task.list}</td>
                        <td className="py-3 pr-4 text-zinc-400">{task.assignees?.join(", ") || "Unassigned"}</td>
                        <td className="py-3 pr-4 text-zinc-400">{task.dueDate || "n/a"}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {task.isOverdue && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">Overdue</span>}
                            {task.isStale && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Stale</span>}
                            {!task.isOverdue && !task.isStale && <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">Active</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                No ClickUp tasks synced yet. Connect ClickUp and click Sync ClickUp.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
