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

const fetchLinearTickets = async ({ sync = false } = {}) => {
  const response = await fetch("/api/linear/tickets", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Linear tickets.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Open Tickets", summary.openIssues ?? 0, "Active Linear issues not completed or canceled."],
  ["Urgent", summary.urgentIssues ?? 0, "Open P0/P1 urgent issues requiring executive attention."],
  ["Overdue", summary.overdueIssues ?? 0, "Open issues with due dates in the past."],
  ["Stale", summary.staleIssues ?? 0, "Open issues with no meaningful update in 14+ days."],
  ["Done Last 30d", summary.completedLast30Days ?? 0, "Completed delivery throughput over the last 30 days."],
  ["Avg Open Age", `${summary.avgOpenAgeDays ?? 0}d`, "Average age of unresolved issues."],
];

export default function TicketsPage() {
  const [ticketStore, setTicketStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchLinearTickets()
        .then((store) => {
          setTicketStore(store);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Linear tickets.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = ticketStore?.summary || {};
  const teamData = useMemo(() => (summary.teamBreakdown || []).slice(0, 10), [summary.teamBreakdown]);
  const priorityData = useMemo(() => (summary.priorityBreakdown || []).slice(0, 8), [summary.priorityBreakdown]);
  const topRisks = summary.topRisks || [];

  const syncTickets = async () => {
    setSyncing(true);
    setError("");
    try {
      const store = await fetchLinearTickets({ sync: true });
      setTicketStore(store);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Linear tickets.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
              Linear SDK ticket intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Ticket Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Track engineering and product execution from Linear: open load, urgent issues, overdue work, stale tickets, completion throughput, team pressure, and project risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/integrations"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]"
            >
              Configure Linear
            </Link>
            <button
              type="button"
              onClick={syncTickets}
              disabled={syncing}
              className="inline-flex h-10 items-center justify-center rounded-md bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? "Syncing Tickets..." : "Sync Linear Tickets"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add `LINEAR_API_KEY` in Vercel or connect Linear from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Linear tickets...
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Open Tickets by Team</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Open Tickets" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Open Tickets by Priority</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Open Tickets" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Risk Queue</h2>
                <p className="mt-1 text-xs text-zinc-500">Open Linear issues ranked by overdue status, staleness, priority, and age.</p>
              </div>
              <div className="text-xs text-zinc-500">
                Last synced: {formatDateTime(ticketStore?.syncedAt)}
              </div>
            </div>

            {topRisks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Ticket</th>
                      <th className="py-2 pr-4 font-medium">Priority</th>
                      <th className="py-2 pr-4 font-medium">State</th>
                      <th className="py-2 pr-4 font-medium">Team</th>
                      <th className="py-2 pr-4 font-medium">Assignee</th>
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 font-medium">Age</th>
                      <th className="py-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topRisks.map((issue) => (
                      <tr key={issue.id}>
                        <td className="py-3 pr-4">
                          <a href={issue.url} target="_blank" className="font-medium text-white hover:text-violet-200">
                            {issue.identifier}: {issue.title}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-violet-200">{issue.priorityLabel}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.state}</td>
                        <td className="py-3 pr-4">{issue.team}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.assignee}</td>
                        <td className="py-3 pr-4 text-zinc-400">{issue.project}</td>
                        <td className="py-3 pr-4">{issue.ageDays ?? 0}d</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {issue.isOverdue && (
                              <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-200">
                                Overdue
                              </span>
                            )}
                            {issue.isStale && (
                              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                                Stale
                              </span>
                            )}
                            {!issue.isOverdue && !issue.isStale && (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
                No Linear tickets synced yet. Connect Linear and click Sync Linear Tickets.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
