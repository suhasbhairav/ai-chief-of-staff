"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

const formatNumber = (value) => new Intl.NumberFormat("en").format(value || 0);

const fetchMailchimpOverview = async ({ sync = false } = {}) => {
  const response = await fetch("/api/mailchimp/overview", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Mailchimp overview.");
  }

  return data;
};

const metricCards = (summary = {}) => [
  ["Contacts", formatNumber(summary.totalContacts), "Total subscribed contacts across synced audiences."],
  ["Avg Open Rate", `${summary.avgOpenRate ?? 0}%`, "Average open rate across recent sent campaign reports."],
  ["Avg Click Rate", `${summary.avgClickRate ?? 0}%`, "Average click rate across recent sent campaign reports."],
  ["Campaigns", summary.totalCampaigns ?? 0, "Recent campaigns visible from the Marketing API."],
  ["Unsubscribes", formatNumber(summary.totalUnsubscribes), "Recent report-level unsubscribe volume."],
  ["Bounces", formatNumber(summary.totalBounces), "Hard, soft, and syntax bounces across recent reports."],
];

export default function MailchimpPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      fetchMailchimpOverview()
        .then((nextStore) => {
          setStore(nextStore);
          setError("");
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Unable to load Mailchimp overview.");
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const summary = store?.summary || {};
  const audienceData = useMemo(() => (summary.audienceBreakdown || []).slice(0, 10), [summary.audienceBreakdown]);
  const statusData = useMemo(() => summary.campaignStatusBreakdown || [], [summary.campaignStatusBreakdown]);
  const performanceData = useMemo(() => (summary.campaignPerformance || []).slice(0, 8), [summary.campaignPerformance]);
  const topRisks = summary.topRisks || [];
  const reports = (store?.reports || []).slice(0, 20);

  const syncMailchimp = async () => {
    setSyncing(true);
    setError("");
    try {
      const nextStore = await fetchMailchimpOverview({ sync: true });
      setStore(nextStore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sync Mailchimp.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-yellow-300 via-amber-500 to-cyan-400" />
        <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-xs font-semibold text-yellow-100">
              Mailchimp audience, campaign, and email performance intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Mailchimp Overview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Sync Mailchimp audiences, campaigns, and reports to track owned-audience scale, campaign throughput, open and click performance, unsubscribes, bounces, and marketing risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/integrations" className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]">
              Configure Mailchimp
            </Link>
            <button type="button" onClick={syncMailchimp} disabled={syncing} className="inline-flex h-10 items-center justify-center rounded-md bg-yellow-500 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? "Syncing Mailchimp..." : "Sync Mailchimp"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {error} Add Mailchimp env vars in Vercel or connect Mailchimp from Integrations.
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#101013] p-10 text-center text-sm text-zinc-500">
          Loading Mailchimp overview...
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
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Contacts by Audience</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={audienceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#facc15" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Campaign Status Mix</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Campaign Engagement</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="openRate" name="Open %" fill="#facc15" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="clickRate" name="Click %" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Recent Campaign Reports</h2>
                <span className="text-xs text-zinc-500">Last synced: {formatDateTime(store?.syncedAt)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Campaign</th>
                      <th className="py-2 pr-4 font-medium">Audience</th>
                      <th className="py-2 pr-4 font-medium">Sent</th>
                      <th className="py-2 pr-4 font-medium">Open</th>
                      <th className="py-2 pr-4 font-medium">Click</th>
                      <th className="py-2 font-medium">Unsubs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td className="py-3 pr-4 font-medium text-white">{report.title}</td>
                        <td className="py-3 pr-4 text-zinc-400">{report.audienceName}</td>
                        <td className="py-3 pr-4 text-zinc-400">{formatNumber(report.emailsSent)}</td>
                        <td className="py-3 pr-4 text-yellow-100">{report.openRate}%</td>
                        <td className="py-3 pr-4 text-cyan-200">{report.clickRate}%</td>
                        <td className="py-3">{formatNumber(report.unsubscribed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!reports.length && <div className="p-8 text-center text-sm text-zinc-500">No Mailchimp campaign reports synced yet.</div>}
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">CEO Mailchimp Risk Queue</h2>
              <div className="mt-4 space-y-3">
                {topRisks.map((item) => (
                  <div key={item.id} className="rounded-lg border border-zinc-800 bg-[#15151a] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2 py-1 text-[10px] font-semibold text-yellow-100">{item.riskType}</span>
                      <span className="text-[10px] text-zinc-500">{item.openRate}% open · {item.clickRate}% click</span>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-5 text-white">{item.title}</div>
                    <div className="mt-2 text-xs text-zinc-500">{item.audienceName} · {formatNumber(item.emailsSent)} sent</div>
                  </div>
                ))}
              </div>
              {!topRisks.length && <div className="p-8 text-center text-sm text-zinc-500">No Mailchimp risks yet. Connect Mailchimp and click Sync Mailchimp.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
