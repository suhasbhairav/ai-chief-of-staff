"use client";

import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currency = (value, compact = true) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: compact && Math.abs(value || 0) >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value || 0);

const number = (value, digits = 0) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value || 0);

const percent = (value, digits = 0) => `${number(value, digits)}%`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const DEFAULT_ASSUMPTIONS = {
  startingCash: 6400000,
  currentMrr: 820000,
  customers: 410,
  grossMargin: 78,
  baseMonthlyBurn: 420000,
  marketingSpend: 180000,
  baselineNewMrr: 95000,
  cac: 14500,
  winRate: 22,
  salesCycleMonths: 3,
  salesQuotaArr: 900000,
  salesRampMonths: 5,
  salespersonMonthlyCost: 18500,
  monthlyChurn: 1.6,
  supportTicketsPerCustomer: 1.7,
  supportCapacity: 980,
  engineeringCapacity: 384,
  roadmapDemand: 360,
  demandElasticity: 1.15,
  priceToMarginSensitivity: 0.35,
};

const DEFAULT_SCENARIO = {
  salesHires: 5,
  marketingChange: 20,
  priceChange: -10,
  supportHires: 0,
  engineerHires: 0,
};

const CASES = [
  { key: "best", label: "Best", demand: 1.22, churn: 0.78, sales: 1.16, cac: 0.9, color: "#22c55e" },
  { key: "expected", label: "Expected", demand: 1, churn: 1, sales: 1, cac: 1, color: "#38bdf8" },
  { key: "worst", label: "Worst", demand: 0.74, churn: 1.28, sales: 0.76, cac: 1.18, color: "#f97316" },
];

const assumptionSections = [
  {
    title: "Company Baseline",
    fields: [
      ["startingCash", "Starting cash", "currency"],
      ["currentMrr", "Current MRR", "currency"],
      ["customers", "Customers", "number"],
      ["grossMargin", "Gross margin", "percent"],
      ["baseMonthlyBurn", "Monthly operating burn", "currency"],
    ],
  },
  {
    title: "GTM Engine",
    fields: [
      ["marketingSpend", "Monthly marketing spend", "currency"],
      ["baselineNewMrr", "Baseline new MRR / month", "currency"],
      ["cac", "CAC per customer", "currency"],
      ["winRate", "Sales win rate", "percent"],
      ["salesCycleMonths", "Sales cycle months", "number"],
    ],
  },
  {
    title: "People and Capacity",
    fields: [
      ["salesQuotaArr", "Mature rep quota ARR", "currency"],
      ["salesRampMonths", "Sales ramp months", "number"],
      ["salespersonMonthlyCost", "Salesperson monthly cost", "currency"],
      ["supportTicketsPerCustomer", "Tickets per customer / month", "number"],
      ["supportCapacity", "Support ticket capacity", "number"],
      ["engineeringCapacity", "Engineering capacity points", "number"],
      ["roadmapDemand", "Roadmap demand points", "number"],
    ],
  },
  {
    title: "Model Sensitivities",
    fields: [
      ["monthlyChurn", "Monthly revenue churn", "percent"],
      ["demandElasticity", "Price demand elasticity", "number"],
      ["priceToMarginSensitivity", "Price to margin sensitivity", "number"],
    ],
  },
];

const scenarioFields = [
  ["salesHires", "Sales hires", "people", -10, 30],
  ["marketingChange", "Marketing spend change", "%", -60, 150],
  ["priceChange", "Price change", "%", -40, 40],
  ["supportHires", "Support hires", "people", -5, 25],
  ["engineerHires", "Engineer hires", "people", -5, 30],
];

const updateNumeric = (setter, key) => (event) => {
  const next = Number(event.target.value);
  setter((current) => ({ ...current, [key]: Number.isFinite(next) ? next : 0 }));
};

function simulateCase(assumptions, scenario, scenarioCase) {
  const months = [];
  const arpa = assumptions.currentMrr / Math.max(assumptions.customers, 1);
  const priceFactor = Math.max(0.35, 1 + scenario.priceChange / 100);
  const marketingFactor = Math.max(0, 1 + scenario.marketingChange / 100);
  const priceDemandFactor = Math.max(
    0.25,
    1 - (scenario.priceChange / 100) * assumptions.demandElasticity
  );
  const adjustedCac = assumptions.cac * scenarioCase.cac;
  const monthlySalesCost =
    scenario.salesHires * assumptions.salespersonMonthlyCost +
    scenario.supportHires * 11000 +
    scenario.engineerHires * 17500;
  const effectiveGrossMargin = clamp(
    assumptions.grossMargin + scenario.priceChange * assumptions.priceToMarginSensitivity,
    35,
    90
  );
  const supportCapacity = assumptions.supportCapacity + scenario.supportHires * 120;
  const engineeringCapacity = assumptions.engineeringCapacity + scenario.engineerHires * 11;

  let cash = assumptions.startingCash;
  let mrr = assumptions.currentMrr;
  let customers = assumptions.customers;
  let cumulativeNewArr = 0;
  let finalMonthlyMarketing = assumptions.marketingSpend * marketingFactor;

  for (let month = 1; month <= 12; month += 1) {
    const ramp = clamp(month / Math.max(assumptions.salesRampMonths, 1), 0, 1);
    const newMrrFromDemand =
      assumptions.baselineNewMrr *
      marketingFactor *
      priceDemandFactor *
      scenarioCase.demand *
      priceFactor;
    const newMrrFromSales =
      ((scenario.salesHires * assumptions.salesQuotaArr) / 12) *
      ramp *
      scenarioCase.sales *
      (assumptions.winRate / 22) /
      12;
    const churnRate = Math.max(
      0,
      (assumptions.monthlyChurn / 100) *
        scenarioCase.churn *
        (scenario.priceChange < 0 ? 1 + scenario.priceChange / 280 : 1 + scenario.priceChange / 180)
    );
    const churnedMrr = mrr * churnRate;
    const newMrr = Math.max(0, newMrrFromDemand + newMrrFromSales);

    mrr = Math.max(0, mrr + newMrr - churnedMrr);
    customers = Math.max(0, customers + newMrr / Math.max(arpa * priceFactor, 1) - customers * churnRate);
    cumulativeNewArr += newMrr * 12;

    const grossProfit = mrr * (effectiveGrossMargin / 100);
    const operatingOutflow =
      assumptions.baseMonthlyBurn + finalMonthlyMarketing + monthlySalesCost;
    const netCashFlow = grossProfit - operatingOutflow;
    cash += netCashFlow;

    months.push({
      month: `M${month}`,
      cash,
      mrr,
      arr: mrr * 12,
      customers,
      netCashFlow,
      supportLoad: customers * assumptions.supportTicketsPerCustomer,
      engineeringUtilization: (assumptions.roadmapDemand / Math.max(engineeringCapacity, 1)) * 100,
    });
  }

  const final = months[months.length - 1];
  const monthlyNewCustomers = Math.max(
    1,
    (assumptions.baselineNewMrr * marketingFactor * priceDemandFactor) /
      Math.max(arpa * priceFactor, 1)
  );
  const cacPayback = adjustedCac / Math.max(arpa * priceFactor * (effectiveGrossMargin / 100), 1);
  const pipelineRequired =
    ((final.arr - assumptions.currentMrr * 12) / Math.max(assumptions.salesCycleMonths, 1)) /
    Math.max(assumptions.winRate / 100, 0.01);
  const hiringCosts = monthlySalesCost * 12;
  const supportLoad = final.supportLoad;
  const supportUtilization = (supportLoad / Math.max(supportCapacity, 1)) * 100;

  return {
    key: scenarioCase.key,
    label: scenarioCase.label,
    color: scenarioCase.color,
    months,
    final,
    runwayMonths:
      final.netCashFlow >= 0
        ? 36
        : Math.max(0, final.cash / Math.abs(final.netCashFlow)),
    cacPayback,
    pipelineRequired,
    hiringCosts,
    grossMargin: effectiveGrossMargin,
    supportLoad,
    supportUtilization,
    engineeringCapacity,
    engineeringUtilization: final.engineeringUtilization,
    monthlyNewCustomers,
  };
}

export default function DigitalTwinPage() {
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);

  const simulations = useMemo(
    () => CASES.map((scenarioCase) => simulateCase(assumptions, scenario, scenarioCase)),
    [assumptions, scenario]
  );
  const expected = simulations.find((item) => item.key === "expected");
  const chartData = expected.months.map((month, index) => ({
    month: month.month,
    bestCash: simulations[0].months[index].cash,
    expectedCash: simulations[1].months[index].cash,
    worstCash: simulations[2].months[index].cash,
    bestArr: simulations[0].months[index].arr,
    expectedArr: simulations[1].months[index].arr,
    worstArr: simulations[2].months[index].arr,
  }));
  const outcomeRows = simulations.map((item) => ({
    name: item.label,
    runway: item.runwayMonths,
    arr: item.final.arr,
    mrr: item.final.mrr,
    payback: item.cacPayback,
    support: item.supportUtilization,
    engineering: item.engineeringUtilization,
  }));

  const resetModel = () => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    setScenario(DEFAULT_SCENARIO);
  };

  const applyCeoQuestion = () => {
    setScenario({
      salesHires: 5,
      marketingChange: 20,
      priceChange: -10,
      supportHires: 0,
      engineerHires: 0,
    });
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-6">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400" />
        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Company digital twin and scenario simulator
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Reason about future operating consequences.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Model how GTM, pricing, hiring, capacity, margin, and support load influence one another. Edit every assumption, then compare best, expected, and worst-case paths over the next 12 months.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              CEO question
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-200">
              What happens if we hire five salespeople, increase marketing spend by 20%, and reduce prices by 10%?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={applyCeoQuestion}
                className="h-10 rounded-md bg-white px-4 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
              >
                Load Scenario
              </button>
              <button
                type="button"
                onClick={resetModel}
                className="h-10 rounded-md border border-zinc-700 bg-[#15151a] px-4 text-xs font-semibold text-zinc-200 transition hover:bg-[#1e1e23]"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Expected Runway", `${number(expected.runwayMonths, 1)} mo`, "Cash runway after scenario effects."],
          ["Expected ARR", currency(expected.final.arr), `${currency(expected.final.mrr, false)} MRR by month 12.`],
          ["CAC Payback", `${number(expected.cacPayback, 1)} mo`, "CAC divided by gross profit per account."],
          ["Pipeline Required", currency(expected.pipelineRequired), "Qualified pipeline required for the growth delta."],
          ["Hiring Cost", currency(expected.hiringCosts), "Annualized cost of new sales, support, and engineering hires."],
          ["Gross Margin", percent(expected.grossMargin, 1), "Adjusted for the scenario price change."],
          ["Support Load", `${number(expected.supportUtilization, 0)}%`, `${number(expected.supportLoad)} tickets / month.`],
          ["Engineering Capacity", `${number(expected.engineeringCapacity)} pts`, `${percent(expected.engineeringUtilization)} roadmap utilization.`],
        ].map(([label, value, helper]) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-[#101013] p-4">
            <div className="text-xs font-medium text-zinc-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Scenario Levers
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Change the decision inputs and the model recalculates the company impact immediately.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-5">
              {scenarioFields.map(([key, label, suffix, min, max]) => (
                <label key={key} className="space-y-2">
                  <span className="block text-xs font-medium text-zinc-400">{label}</span>
                  <input
                    type="number"
                    value={scenario[key]}
                    min={min}
                    max={max}
                    onChange={updateNumeric(setScenario, key)}
                    className="h-10 w-full rounded-md border border-zinc-700 bg-[#15151a] px-3 text-sm text-white outline-none transition focus:border-sky-400"
                  />
                  <span className="block text-[10px] uppercase tracking-wider text-zinc-600">{suffix}</span>
                </label>
              ))}
            </div>
          </div>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Cash Runway Path</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickFormatter={(value) => currency(value)} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      formatter={(value) => currency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="bestCash" name="Best" stroke="#22c55e" fill="#22c55e22" />
                    <Area type="monotone" dataKey="expectedCash" name="Expected" stroke="#38bdf8" fill="#38bdf822" />
                    <Area type="monotone" dataKey="worstCash" name="Worst" stroke="#f97316" fill="#f9731622" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">ARR Trajectory</h2>
              <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} tickFormatter={(value) => currency(value)} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                      formatter={(value) => currency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="bestArr" name="Best" stroke="#22c55e" fill="#22c55e22" />
                    <Area type="monotone" dataKey="expectedArr" name="Expected" stroke="#38bdf8" fill="#38bdf822" />
                    <Area type="monotone" dataKey="worstArr" name="Worst" stroke="#f97316" fill="#f9731622" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Best, Expected, and Worst-Case Outcomes
            </h2>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Case</th>
                      <th className="py-2 pr-4 font-medium">Cash Runway</th>
                      <th className="py-2 pr-4 font-medium">ARR</th>
                      <th className="py-2 pr-4 font-medium">MRR</th>
                      <th className="py-2 pr-4 font-medium">CAC Payback</th>
                      <th className="py-2 pr-4 font-medium">Pipeline Required</th>
                      <th className="py-2 pr-4 font-medium">Hiring Cost</th>
                      <th className="py-2 pr-4 font-medium">Gross Margin</th>
                      <th className="py-2 pr-4 font-medium">Support Workload</th>
                      <th className="py-2 font-medium">Engineering Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                  {simulations.map((item) => (
                    <tr key={item.key}>
                      <td className="py-3 pr-4 font-semibold text-white">{item.label}</td>
                      <td className="py-3 pr-4">{number(item.runwayMonths, 1)} mo</td>
                      <td className="py-3 pr-4 text-emerald-200">{currency(item.final.arr)}</td>
                      <td className="py-3 pr-4">{currency(item.final.mrr, false)}</td>
                      <td className="py-3 pr-4">{number(item.cacPayback, 1)} mo</td>
                      <td className="py-3 pr-4 text-sky-200">{currency(item.pipelineRequired)}</td>
                      <td className="py-3 pr-4">{currency(item.hiringCosts)}</td>
                      <td className="py-3 pr-4">{percent(item.grossMargin, 1)}</td>
                      <td className="py-3 pr-4">{number(item.supportLoad)} tickets, {percent(item.supportUtilization)} load</td>
                      <td className="py-3">{number(item.engineeringCapacity)} pts, {percent(item.engineeringUtilization)} used</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Visible Assumptions
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              These are the editable mechanics behind the forecast. Replace them with imported finance, CRM, support, and delivery metrics as the company data model matures.
            </p>
            <div className="mt-5 space-y-5">
              {assumptionSections.map((section) => (
                <div key={section.title}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {section.title}
                  </div>
                  <div className="grid gap-3">
                    {section.fields.map(([key, label, type]) => (
                      <label key={key} className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
                        <span className="text-xs leading-5 text-zinc-400">{label}</span>
                        <input
                          type="number"
                          value={assumptions[key]}
                          onChange={updateNumeric(setAssumptions, key)}
                          className="h-9 rounded-md border border-zinc-700 bg-[#15151a] px-2 text-right text-xs text-white outline-none transition focus:border-emerald-400"
                        />
                        <span className="sr-only">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Cause and Effect Model
            </h2>
            <div className="mt-4 space-y-3 text-xs leading-5 text-zinc-400">
              <p>Marketing spend changes demand and CAC pressure.</p>
              <p>Price changes affect demand, ARPA, churn, and gross margin.</p>
              <p>Sales hiring adds ramped booking capacity and fixed monthly cost.</p>
              <p>New customers increase support workload and operational load.</p>
              <p>Engineering hiring expands capacity against roadmap demand.</p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Outcome Mix
            </h2>
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outcomeRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    formatter={(value, name) =>
                      name === "arr" ? currency(value) : number(value, 1)
                    }
                  />
                  <Bar dataKey="runway" name="Runway months" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="payback" name="CAC payback" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="support" name="Support load %" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
