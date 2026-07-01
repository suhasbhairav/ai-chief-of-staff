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

const fetchStripeOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/stripe/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Stripe overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Payment Volume", money(summary.totalPaymentVolume), "Succeeded payment volume in the latest Stripe sync."],
  ["Available Balance", money(summary.availableBalance), "Funds currently available in Stripe balance."],
  ["Pending Balance", money(summary.pendingBalance), "Funds pending availability."],
  ["MRR", money(summary.mrr), "Estimated monthly recurring revenue from active and trialing subscriptions."],
  ["Customers", summary.totalCustomers ?? 0, "Stripe customers monitored for retention and risk."],
  ["Open Invoices", summary.openInvoices ?? 0, "Invoices still open with customers."],
  ["Overdue Invoices", summary.overdueInvoices ?? 0, "Open invoices past due date."],
  ["Failed Payments", summary.failedPayments ?? 0, "Payment intents requiring action, payment method, or canceled."],
];

export default function StripePage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchStripeOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Stripe overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const paymentStatusData = useMemo(() => summary.paymentStatusBreakdown || [], [summary.paymentStatusBreakdown]);
  const subscriptionStatusData = useMemo(() => summary.subscriptionStatusBreakdown || [], [summary.subscriptionStatusBreakdown]);
  const invoiceStatusData = useMemo(() => summary.invoiceStatusBreakdown || [], [summary.invoiceStatusBreakdown]);
  const revenueByCurrency = useMemo(() => summary.revenueByCurrency || [], [summary.revenueByCurrency]);
  const topInvoices = summary.topInvoices || [];
  const topRisks = summary.topRisks || [];

  const syncStripe = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchStripeOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Stripe.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-violet-400 via-fuchsia-500 to-rose-500" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
              Stripe payments, customers, subscriptions, invoices, and balance intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Stripe Payments Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Stripe to inspect payment conversion, MRR, cash available, overdue invoices, churn signals, failed payment patterns, and customer revenue risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Stripe
            </Link>
            <button type="button" onClick={syncStripe} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-fuchsia-600 px-4 text-xs font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Stripe..." : "Sync Stripe"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add STRIPE_SECRET_KEY in Vercel or connect Stripe from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Stripe overview...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              ["Payment Status", paymentStatusData, "#d946ef", "count"],
              ["Subscription Status", subscriptionStatusData, "#a78bfa", "count"],
              ["Invoice Status", invoiceStatusData, "#fb7185", "count"],
              ["Revenue by Currency", revenueByCurrency, "#22d3ee", "amount"],
            ].map(([title, data, color, dataKey]) => (
              <div key={title} className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                      <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                      <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Largest Invoices</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Invoice</th>
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Due</th>
                      <th className="py-2 pr-4 font-medium">Remaining</th>
                      <th className="py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {topInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="py-3 pr-4 font-medium text-white">{invoice.number}</td>
                        <td className="py-3 pr-4 text-zinc-400">{invoice.customerName}</td>
                        <td className="py-3 pr-4">{invoice.status}</td>
                        <td className="py-3 pr-4 text-zinc-400">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "n/a"}</td>
                        <td className="py-3 pr-4 text-rose-200">{money(invoice.amountRemaining, invoice.currency)}</td>
                        <td className="py-3 text-fuchsia-100">{money(invoice.total, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!topInvoices.length && <div className="p-8 text-center text-sm text-zinc-500">No Stripe invoices synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Stripe Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((item) => (
                  <div key={`${item.id}-${item.riskType}`} className="rounded-lg border border-zinc-800 bg-[#15151a] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-[10px] font-semibold text-fuchsia-100">{item.riskType}</span>
                      <span className="text-[10px] text-zinc-500">{money(item.value || 0)}</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.title}</div>
                    <div className="mt-2 text-xs text-zinc-500">{item.detail}</div>
                  </div>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No Stripe risks yet. Connect Stripe and click Sync Stripe.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
