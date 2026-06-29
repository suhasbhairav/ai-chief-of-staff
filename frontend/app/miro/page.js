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

const fetchMiroOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/miro/boards", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Miro boards.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Boards", summary.totalBoards ?? 0, "Synced Miro boards visible to the connected token."],
  ["Recently Updated", summary.recentlyUpdated ?? 0, "Boards modified in the last 14 days."],
  ["Stale Boards", summary.staleBoards ?? 0, "Boards with no detected update in 60+ days."],
  ["Owners", summary.owners ?? 0, "Distinct board owners or creators."],
  ["Public / Team", summary.publicBoards ?? 0, "Boards with broad sharing signals."],
  ["Private", summary.privateBoards ?? 0, "Boards without broad sharing signals."],
];

export default function MiroPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchMiroOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Miro boards.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const ownerData = useMemo(() => (summary.ownerBreakdown || []).slice(0, 10), [summary.ownerBreakdown]);
  const permissionData = useMemo(() => (summary.permissionBreakdown || []).slice(0, 8), [summary.permissionBreakdown]);
  const recentBoards = summary.recentBoards || [];
  const staleBoards = summary.staleBoardQueue || [];

  const syncMiro = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchMiroOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Miro boards.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-yellow-300 via-pink-400 to-blue-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-xs font-semibold text-yellow-100">
              Miro board workspace intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Miro Boards
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Miro boards to inspect collaboration surface area, board freshness, ownership concentration, broad-sharing exposure, stale strategy artifacts, and recently active workspaces.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Miro
            </Link>
            <button type="button" onClick={syncMiro} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-yellow-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Miro..." : "Sync Miro Boards"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add MIRO_ACCESS_TOKEN in Vercel or connect Miro from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Miro boards...
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Boards by Owner</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#facc15" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sharing Signals</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={permissionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            {[
              ["Recently Active Boards", recentBoards, "No recently active Miro boards synced yet."],
              ["Stale Strategy Boards", staleBoards, "No stale boards detected."],
            ].map(([title, boards, empty]) => (
              <div key={title} className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
                  <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
                </div>
                {boards.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="border-b border-zinc-800 text-zinc-500">
                        <tr>
                          <th className="py-2 pr-4 font-medium">Board</th>
                          <th className="py-2 pr-4 font-medium">Owner</th>
                          <th className="py-2 pr-4 font-medium">Modified</th>
                          <th className="py-2 font-medium">Sharing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#202024] text-zinc-300">
                        {boards.map((board) => (
                          <tr key={board.id}>
                            <td className="py-3 pr-4">
                              <a href={board.viewLink || "#"} target="_blank" className="font-medium text-white hover:text-yellow-100">
                                {board.name}
                              </a>
                            </td>
                            <td className="py-3 pr-4">{board.ownerName}</td>
                            <td className="py-3 pr-4 text-zinc-400">
                              {board.modifiedDaysAgo === null ? "Unknown" : `${board.modifiedDaysAgo}d ago`}
                            </td>
                            <td className="py-3">
                              <span className="rounded-full border border-zinc-600 bg-zinc-800/60 px-2 py-1 text-[10px] text-zinc-300">
                                {board.sharingPolicy}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                    {empty}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
