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

const money = (value, currency = "USD") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatDate = (value) => {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
};

const fetchXeroOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/xero/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Xero overview.");
  }

  return data;
};

const metricCards = (summary = {}, currencyCode = "USD") => [
  ["A/R", money(summary.accountsReceivable, currencyCode), "Open receivables from synced Xero invoices."],
  ["A/P", money(summary.accountsPayable, currencyCode), "Open payables from synced Xero bills."],
  ["Overdue", summary.overdueInvoices ?? 0, "Invoices or bills past due with an amount remaining."],
  ["Contacts", summary.totalContacts ?? 0, "Synced Xero customers, suppliers, and other contacts."],
  ["Bank Volume", money(summary.bankTransactionVolume, currencyCode), "Recent bank transaction volume visible to the token."],
  ["Bank Accounts", summary.bankAccounts ?? 0, "Active bank accounts in the chart of accounts."],
];

export default function XeroPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchXeroOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Xero overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const currencyCode = store?.organisation?.BaseCurrency || "USD";
  const invoiceStatusData = useMemo(() => summary.invoiceStatusBreakdown || [], [summary.invoiceStatusBreakdown]);
  const accountTypeData = useMemo(() => (summary.accountTypeBreakdown || []).slice(0, 10), [summary.accountTypeBreakdown]);
  const topInvoices = summary.topInvoices || [];
  const topRisks = summary.topRisks || [];

  const syncXero = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchXeroOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Xero.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
              Xero accounting, invoices, contacts, and bank transaction intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Xero Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Xero Accounting data to inspect receivables, payables, overdue invoices, customers, suppliers, bank transaction volume, account mix, and finance risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Xero
            </Link>
            <button type="button" onClick={syncXero} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Xero..." : "Sync Xero"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Xero env vars in Vercel or connect Xero from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Xero overview...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricCards(summary, currencyCode).map(([label, value, description]) => (
              <div key={label} className="rounded-lg border border-zinc-800 bg-[#101013] p-4">
                <div className="text-xs font-medium text-zinc-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{description}</p>
              </div>
            ))}
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Invoice Status Mix</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={invoiceStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Account Type Mix</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accountTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Largest Open Invoices</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Invoice</th>
                      <th className="py-2 pr-4 font-medium">Contact</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Due</th>
                      <th className="py-2 pr-4 font-medium">Amount Due</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="py-3 pr-4 font-medium text-white">{invoice.number}</td>
                        <td className="py-3 pr-4">{invoice.contactName}</td>
                        <td className="py-3 pr-4 text-zinc-400">{invoice.type}</td>
                        <td className="py-3 pr-4 text-zinc-400">{formatDate(invoice.dueDate)}</td>
                        <td className="py-3 pr-4 text-sky-200">{money(invoice.amountDue, invoice.currency || currencyCode)}</td>
                        <td className="py-3">
                          <span className={`rounded-full border px-2 py-1 text-[10px] ${
                            invoice.isOverdue
                              ? "border-red-400/30 bg-red-500/10 text-red-200"
                              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                          }`}>
                            {invoice.isOverdue ? "Overdue" : invoice.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!topInvoices.length && <div className="p-8 text-center text-sm text-zinc-500">No open Xero invoices synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Xero Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-[#15151a] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-200">{item.riskType}</span>
                      <span className="text-[10px] text-zinc-500">{money(item.value, currencyCode)}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.title}</div>
                  </div>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No Xero risks yet. Connect Xero and click Sync Xero.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
