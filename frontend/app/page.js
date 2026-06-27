"use client";
import React from "react";
import Link from "next/link";

const DEPARTMENTS = [
  { id: "executive", name: "Executive", focus: "OKRs, board directives, company health", signal: "94%" },
  { id: "finance", name: "Finance", focus: "Burn, runway, cash controls", signal: "26 mo" },
  { id: "hr", name: "Human Resources", focus: "Headcount, retention, performance", signal: "96.2%" },
  { id: "legal", name: "Legal", focus: "Contracts, compliance, exposure", signal: "2 flags" },
  { id: "it", name: "IT", focus: "Uptime, access, security posture", signal: "99.98%" },
  { id: "operations", name: "Operations", focus: "Throughput, defects, fulfillment", signal: "98.4%" },
  { id: "sales", name: "Sales", focus: "Pipeline, ARR, quota attainment", signal: "$14.2M" },
  { id: "marketing", name: "Marketing", focus: "CAC, conversion, channel spend", signal: "4.8x" },
  { id: "product", name: "Product", focus: "Velocity, bugs, retention", signal: "92%" },
  { id: "rd", name: "R&D", focus: "Patents, experiments, milestones", signal: "14" },
  { id: "customer-service", name: "Customer Support", focus: "SLA, CSAT, backlog pressure", signal: "4.91" },
  { id: "risk", name: "Risk", focus: "Audit, controls, threat mitigation", signal: "98/100" },
  { id: "strategy", name: "Strategy", focus: "M&A, partnerships, market moves", signal: "3 targets" },
];

const EXECUTIVE_QUEUE = [
  "Review finance runway and sales pipeline variance before the next operating meeting.",
  "Compare customer support SLA against product defect velocity for churn risk.",
  "Refresh departmental CSV templates where leaders need updated weekly metrics.",
];

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6 pb-6 text-zinc-200">
      <section className="rounded-lg border border-[#27272a] bg-[#101013] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              AI Chief of Staff online
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Company command center for CEO-grade operating intelligence.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Ingest department metrics, generate concise OpenAI-backed analysis, and turn operational signals into action for the CEO and every function leader.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#27272a] bg-[#0c0c0e] p-2 text-center sm:min-w-80">
            <div className="rounded-md bg-[#151518] px-3 py-3">
              <div className="text-lg font-semibold text-white">13</div>
              <div className="mt-1 text-[10px] uppercase text-zinc-500">Departments</div>
            </div>
            <div className="rounded-md bg-[#151518] px-3 py-3">
              <div className="text-lg font-semibold text-white">CSV</div>
              <div className="mt-1 text-[10px] uppercase text-zinc-500">Ingestion</div>
            </div>
            <div className="rounded-md bg-[#151518] px-3 py-3">
              <div className="text-lg font-semibold text-white">AI</div>
              <div className="mt-1 text-[10px] uppercase text-zinc-500">Synthesis</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/departments/executive"
            className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            Open Executive Workspace
          </Link>
          <Link
            href="/departments/finance"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[#27272a] bg-[#18181b] px-4 text-xs font-medium text-zinc-200 transition-colors hover:bg-[#222226]"
          >
            Review Finance Signals
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-lg border border-[#27272a] bg-[#101013] p-5 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Department Workspaces</h2>
              <p className="mt-1 text-xs text-zinc-500">Open a function to upload metrics, inspect charts, and generate AI recommendations.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DEPARTMENTS.map((dept) => (
              <Link
                key={dept.id}
                href={`/departments/${dept.id}`}
                className="group flex min-h-28 flex-col justify-between rounded-lg border border-[#27272a] bg-[#141416] p-4 transition-colors hover:border-zinc-600 hover:bg-[#18181b]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white">{dept.name}</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{dept.focus}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-[#27272a] bg-[#0c0c0e] px-2 py-1 text-[11px] font-medium text-zinc-300">
                    {dept.signal}
                  </span>
                </div>
                <div className="mt-4 text-[11px] font-medium text-indigo-300">Open workspace</div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-[#27272a] bg-[#101013] p-5">
            <h2 className="text-sm font-semibold text-white">CEO Brief Queue</h2>
            <div className="mt-4 space-y-3">
              {EXECUTIVE_QUEUE.map((item, index) => (
                <div key={item} className="rounded-md border border-[#27272a] bg-[#141416] p-3">
                  <div className="text-[10px] font-semibold uppercase text-zinc-500">Priority {index + 1}</div>
                  <p className="mt-1 text-xs leading-5 text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-indigo-500/30 bg-[#11111a] p-5">
            <h2 className="text-sm font-semibold text-indigo-200">Operating Loop</h2>
            <div className="mt-4 space-y-3 text-xs text-zinc-400">
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-[10px] text-indigo-200">1</span>
                <p>Download each department CSV template and collect leader-owned metrics.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-[10px] text-indigo-200">2</span>
                <p>Upload the file into the department workspace to validate the operating data.</p>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-[10px] text-indigo-200">3</span>
                <p>Use Chief of Staff synthesis to brief the CEO and route actions to teams.</p>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
