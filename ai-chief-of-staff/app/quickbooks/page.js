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

const fetchQuickBooksOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/quickbooks/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load QuickBooks overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Cash", money(summary.cashBalance), "Bank account balance across active accounts."],
  ["A/R", money(summary.arBalance), "Accounts receivable exposure."],
  ["A/P", money(summary.apBalance), "Accounts payable obligations."],
  ["Net Income", money(summary.netIncome), "Latest net income from QBO reports or account rollup."],
  ["Assets", money(summary.assetBalance), "Current active asset account balance."],
  ["Liabilities", money(summary.liabilityBalance), "Current active liability account balance."],
];

export default function QuickBooksPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchQuickBooksOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load QuickBooks overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const accountTypes = useMemo(() => (summary.accountTypeBreakdown || []).slice(0, 10), [summary.accountTypeBreakdown]);
  const balanceData = useMemo(() => summary.balanceBreakdown || [], [summary.balanceBreakdown]);
  const topAccounts = summary.topAccounts || [];
  const topRisks = summary.topRisks || [];

  const syncQuickBooks = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchQuickBooksOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync QuickBooks.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-lime-300 to-cyan-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              QuickBooks accounting, chart of accounts, and finance report intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO QuickBooks Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync QuickBooks Online accounts and finance reports to inspect cash, A/R, A/P, income, expenses, balance sheet posture, and accounting risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure QuickBooks
            </Link>
            <button type="button" onClick={syncQuickBooks} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing QuickBooks..." : "Sync QuickBooks"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add QuickBooks env vars in Vercel or connect QuickBooks from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading QuickBooks overview...
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Account Type Mix</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accountTypes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Balance Sheet Mix</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={balanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} formatter={(value) => money(value)} />
                    <Bar dataKey="count" name="Balance" fill="#a3e635" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Largest Active Accounts</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Account</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Classification</th>
                      <th className="py-2 pr-4 font-medium">Balance</th>
                      <th className="py-2 font-medium">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topAccounts.map((account) => (
                      <tr key={account.id}>
                        <td className="py-3 pr-4 font-medium text-white">{account.fullyQualifiedName}</td>
                        <td className="py-3 pr-4 text-zinc-400">{account.accountType}</td>
                        <td className="py-3 pr-4 text-zinc-400">{account.classification}</td>
                        <td className="py-3 pr-4 text-emerald-200">{money(account.currentBalanceWithSubAccounts)}</td>
                        <td className="py-3">{account.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!topAccounts.length && <div className="p-8 text-center text-sm text-zinc-500">No QuickBooks accounts synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO QuickBooks Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-[#15151a] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">{item.riskType}</span>
                      <span className="text-[10px] text-zinc-500">{money(item.value)}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.title}</div>
                  </div>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No QuickBooks risks yet. Connect QuickBooks and click Sync QuickBooks.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
