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

const fetchAsanaOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/asana/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Asana overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Projects", summary.totalProjects ?? 0, "Asana projects included in CEO execution rollup."],
  ["Open Tasks", summary.openTasks ?? 0, "Incomplete tasks across synced projects."],
  ["Overdue", summary.overdueTasks ?? 0, "Open work past due date."],
  ["Due Soon", summary.dueSoonTasks ?? 0, "Open work due in the next seven days."],
  ["Stale", summary.staleTasks ?? 0, "Open work with no update in 14+ days."],
  ["Unassigned", summary.unassignedTasks ?? 0, "Open work without a clear owner."],
];

export default function AsanaPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchAsanaOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Asana overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const statusData = useMemo(() => summary.statusBreakdown || [], [summary.statusBreakdown]);
  const projectData = useMemo(() => (summary.projectBreakdown || []).slice(0, 10), [summary.projectBreakdown]);
  const ownerData = useMemo(() => (summary.ownerBreakdown || []).slice(0, 10), [summary.ownerBreakdown]);
  const topRisks = summary.topRisks || [];
  const dueSoon = (store?.tasks || []).filter((task) => task.isOpen && (task.isDueSoon || task.isOverdue)).slice(0, 20);

  const syncAsana = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchAsanaOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Asana.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 via-orange-400 to-fuchsia-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200">
              Asana work, roadmap, and owner accountability intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Asana Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Asana projects and tasks to inspect overdue work, due-soon execution, stale work, ownership gaps, project concentration, and CEO-level delivery risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Asana
            </Link>
            <button type="button" onClick={syncAsana} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Asana..." : "Sync Asana"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Asana env vars in Vercel or connect Asana from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Asana overview...
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
              ["Task Status Mix", statusData, "#fb7185"],
              ["Open Tasks by Project", projectData, "#f97316"],
              ["Open Tasks by Owner", ownerData, "#e879f9"],
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
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Due / Overdue Work</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Task</th>
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Due</th>
                      <th className="py-2 font-medium">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {dueSoon.map((task) => (
                      <tr key={task.gid}>
                        <td className="py-3 pr-4">
                          <a href={task.url || "#"} target="_blank" className="font-medium text-white hover:text-rose-200">
                            {task.name}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{task.projectName}</td>
                        <td className="py-3 pr-4">{task.assignee}</td>
                        <td className="py-3 pr-4 text-zinc-400">{task.dueDate || "n/a"}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {task.isOverdue && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">Overdue</span>}
                            {task.isDueSoon && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Due soon</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!dueSoon.length && <div className="p-8 text-center text-sm text-zinc-500">No due-soon or overdue tasks synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Asana Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((task) => (
                  <a key={task.gid} href={task.url || "#"} target="_blank" className="block rounded-lg border border-zinc-800 bg-[#15151a] p-4 transition hover:border-rose-500/40">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold leading-5 text-white">{task.name}</span>
                      <span className="text-[10px] text-zinc-500">{task.ageDays}d old</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">{task.projectName} · {task.assignee}</div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {task.isOverdue && <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">Overdue</span>}
                      {task.isStale && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">Stale</span>}
                      {task.isUnassigned && <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-2 py-1 text-[10px] text-zinc-300">Unassigned</span>}
                    </div>
                  </a>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No Asana risk queue yet. Connect Asana and click Sync Asana.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
