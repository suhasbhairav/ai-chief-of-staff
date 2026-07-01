"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from 'recharts';
import { generateBoardMemoPdf, generateDashboardPdfReport } from '@/lib/pdf-report';

// Data maps matching schema structural frameworks for all 13 departments
const DEPT_CONFIGS = {
  executive: {
    title: "Executive / Office of the CEO",
    csvTemplate: "Month,Revenue_Growth_Rate,FCF_Margin,Rule_of_40,ARR,Net_Revenue_Retention,Cash_Balance,Burn_Multiple,Strategic_Priority_Completion,Enterprise_Risk_Score\n2026-06,24,18,42,8400000,118,4680000,1.3,82,2.1",
    metrics: [{ name: "OKRs Active", value: "12" }, { name: "Corp Target Health", value: "94%" }, { name: "Board Directives", value: "8" }]
  },
  finance: {
    title: "Finance (Accounting & Treasury)",
    csvTemplate: "Month,Revenue,ARR,Revenue_Growth_Rate,Net_Revenue_Retention,COGS,Gross_Margin,Operating_Expenses,Cash_Balance,Net_New_ARR,EBITDA,Free_Cash_Flow,FCF_Margin,AR,AP,Debt\n2026-06,720000,8400000,24,118,180000,75,410000,4680000,315000,95000,82000,11.4,610000,420000,900000",
    metrics: [{ name: "Burn Rate", value: "$180K/mo" }, { name: "Runway", value: "26 Months" }, { name: "Cash on Hand", value: "$4.68M" }]
  },
  hr: {
    title: "Human Resources (Talent & Compensation)",
    csvTemplate: "Month,Headcount,Open_Roles,Attrition_Rate,eNPS,Revenue_per_Employee,Offer_Acceptance_Rate,Time_to_Hire_Days,Diversity_Index,Performance_Index\n2026-06,142,18,3.8,44,60845,82,31,71,87",
    metrics: [{ name: "Headcount Total", value: "142" }, { name: "Retention Rate", value: "96.2%" }, { name: "eNPS Score", value: "+44" }]
  },
  legal: {
    title: "Legal & Compliance",
    csvTemplate: "Month,Contracts_Executed,Contract_Cycle_Days,Compliance_Score,Open_Risk_Items,Liability_Exposure,Outside_Counsel_Spend,IP_Filings,Claims_Open,Regulatory_Actions\n2026-06,42,19,96,3,250000,58000,6,1,0",
    metrics: [{ name: "Pending Audits", value: "0" }, { name: "Contracts Flagged", value: "2" }, { name: "Regulatory Safe", value: "100%" }]
  },
  it: {
    title: "Information Technology (IT) / Tech Services",
    csvTemplate: "Month,Uptime_Percent,Security_Incidents,Critical_Vulnerabilities,Cloud_Spend,SaaS_Spend,MTTR_Minutes,Tickets_Resolved,Provisioning_SLA_Hours,Automation_Coverage\n2026-06,99.98,1,2,124000,86000,42,1180,5,64",
    metrics: [{ name: "Avg Uptime", value: "99.98%" }, { name: "Open Vulnerabilities", value: "1" }, { name: "Provision Speed", value: "14 min" }]
  },
  operations: {
    title: "Operations / Supply Chain",
    csvTemplate: "Month,Throughput_Units,Demand_Units,On_Time_Delivery,Inventory_Turns,Defect_Rate_PPM,Gross_Yield,Operating_Cost,Unit_Cost,Supplier_OTIF\n2026-06,125000,131000,98.4,14.2,120,99.1,89000,0.71,96.8",
    metrics: [{ name: "SLA Adherence", value: "98.4%" }, { name: "Logistics Cost", value: "-4.2% MoM" }, { name: "Yield Rate", value: "99.98%" }]
  },
  sales: {
    title: "Sales & Revenue Distribution",
    csvTemplate: "Month,Pipeline_Created,Qualified_Pipeline,Bookings,ARR_Won,Net_Revenue_Retention,Win_Rate,Sales_Cycle_Days,Quota_Attainment,Forecast_Commit,Churn_Risk_ARR\n2026-06,2600000,1420000,910000,760000,118,28,46,104,840000,180000",
    metrics: [{ name: "Pipeline Value", value: "$14.2M" }, { name: "Closed Won YTD", value: "$6.1M" }, { name: "Quota Attainment", value: "104%" }]
  },
  marketing: {
    title: "Marketing & Communications",
    csvTemplate: "Month,Spend,MQL,SQL,Pipeline_Created,CAC,LTV,CAC_Payback_Months,Conversion_Rate,ROAS,Brand_Search_Index\n2026-06,185000,3410,920,1280000,385,1840,11,26.9,4.8,74",
    metrics: [{ name: "CAC Blend", value: "$38.50" }, { name: "LTV:CAC Ratio", value: "4.8x" }, { name: "MQLs Generated", value: "3,410" }]
  },
  product: {
    title: "Product Management & Development",
    csvTemplate: "Month,Active_Users,Activation_Rate,Retention_30d,NPS,Velocity_SP,Bugs_P1,Cycle_Time_Days,Feature_Adoption,ARR_Influenced\n2026-06,184000,42,71,48,84,3,11,36,940000",
    metrics: [{ name: "Feature Velocity", value: "92%" }, { name: "Active Epics", value: "7" }, { name: "User Retention", value: "42.1%" }]
  },
  rd: {
    title: "Research & Development / Innovation",
    csvTemplate: "Month,R&D_Spend,Budget_Allocated,Patent_Filings,Experiments_Run,Milestone_Hit_Rate,TRL_Score,Time_to_Prototype_Days,Researchers_Count,Commercialization_Value\n2026-06,420000,500000,4,38,86,6,21,28,1800000",
    metrics: [{ name: "Active Patents", value: "14" }, { name: "R&D Spend Share", value: "15.4%" }, { name: "Prototyping Time", value: "11 Days" }]
  },
  "customer-service": {
    title: "Customer Service & Support",
    csvTemplate: "Month,Tickets_Created,Tickets_Resolved,First_Response_Minutes,Resolution_Time_Hours,CSAT,NPS,Escalation_Rate,Backlog_Tickets,Retention_Risk_Accounts\n2026-06,4850,4920,2.4,5.2,4.91,52,6.8,114,18",
    metrics: [{ name: "First Response", value: "2.4 min" }, { name: "CSAT Average", value: "4.91/5" }, { name: "Backlog Vol", value: "14" }]
  },
  risk: {
    title: "Risk Management & Internal Audit",
    csvTemplate: "Month,Enterprise_Risk_Score,Control_Coverage,Audit_Score,Unmitigated_Risks,Mitigated_Risks,Open_Audit_Items,Security_Findings,Operational_Loss,Compliance_Breaches\n2026-06,2.1,94,98,3,12,4,2,18000,0",
    metrics: [{ name: "Risk Index", value: "Low (2.1)" }, { name: "Unmitigated Threats", value: "0" }, { name: "Audit Score", value: "98/100" }]
  },
  strategy: {
    title: "Corporate Strategy & Biz Dev",
    csvTemplate: "Month,Strategic_Pipeline_Value,TAM_Coverage,Market_Share,Synergy_Score,Diligence_Risk_Score,Partnership_Revenue,Competitive_Win_Rate,Strategic_Initiatives_OnTrack,M&A_Targets\n2026-06,45000000,18.4,6.2,9.2,2.4,1200000,64,82,3",
    metrics: [{ name: "M&A Pipeline", value: "3 Targets" }, { name: "TAM Penetration", value: "18.4%" }, { name: "JV Partnerships", value: "4 Active" }]
  }
};

const ANALYTICS_MODELS = {
  executive: {
    metricCards: [
      { name: "ARR", type: "latest", column: "ARR", prefix: "$", compact: true },
      { name: "Rule of 40", type: "sumLatest", columns: ["Revenue_Growth_Rate", "FCF_Margin"], suffix: "%" },
      { name: "Runway", type: "ratio", numerator: "Cash_Balance", denominator: "Operating_Expenses", suffix: " mo" },
      { name: "Enterprise Risk", type: "latest", column: "Enterprise_Risk_Score" },
    ],
    charts: [
      { title: "Value Creation and Cash", type: "bar", x: "period", series: [{ key: "health", name: "CEO Score" }, { key: "targetScore", name: "Target Score" }] },
      { title: "GTM Efficiency", type: "bar", x: "period", series: [{ key: "health", name: "CEO Score" }, { key: "targetScore", name: "Target Score" }] },
      { title: "Customer and Product Health", type: "bar", x: "period", series: [{ key: "health", name: "CEO Score" }, { key: "targetScore", name: "Target Score" }] },
      { title: "Risk and Execution Posture", type: "bar", x: "period", series: [{ key: "health", name: "CEO Score" }, { key: "targetScore", name: "Target Score" }] },
    ],
  },
  finance: {
    metricCards: [
      { name: "ARR", type: "latest", column: "ARR", prefix: "$", compact: true },
      { name: "Burn Multiple", type: "ratio", numerator: "Operating_Expenses", denominator: "Net_New_ARR", suffix: "x" },
      { name: "Runway", type: "ratio", numerator: "Cash_Balance", denominator: "Operating_Expenses", suffix: " mo" },
      { name: "Rule of 40", type: "sumLatest", columns: ["Revenue_Growth_Rate", "FCF_Margin"], suffix: "%" },
    ],
    charts: [
      { title: "Revenue, ARR, and FCF", type: "area", x: "Month", series: [{ key: "ARR", name: "ARR" }, { key: "Free_Cash_Flow", name: "FCF" }] },
      { title: "Burn and Cash Balance", type: "bar", x: "Month", series: [{ key: "Operating_Expenses", name: "Operating Expenses" }, { key: "Cash_Balance", name: "Cash" }] },
      { title: "Margins", type: "line", x: "Month", series: [{ key: "Gross_Margin", name: "Gross Margin" }, { key: "FCF_Margin", name: "FCF Margin" }] },
      { title: "Working Capital", type: "bar", x: "Month", series: [{ key: "AR", name: "Accounts Receivable" }, { key: "AP", name: "Accounts Payable" }] },
    ],
  },
  hr: {
    metricCards: [
      { name: "Headcount", type: "latest", column: "Headcount" },
      { name: "Revenue / Employee", type: "latest", column: "Revenue_per_Employee", prefix: "$", compact: true },
      { name: "Attrition", type: "avg", column: "Attrition_Rate", suffix: "%" },
      { name: "eNPS", type: "latest", column: "eNPS" },
    ],
    charts: [
      { title: "Headcount and Hiring Plan", type: "area", x: "Month", series: [{ key: "Headcount", name: "Headcount" }, { key: "Open_Roles", name: "Open Roles" }] },
      { title: "Talent Health", type: "line", x: "Month", series: [{ key: "Attrition_Rate", name: "Attrition" }, { key: "eNPS", name: "eNPS" }] },
      { title: "Hiring Efficiency", type: "bar", x: "Month", series: [{ key: "Time_to_Hire_Days", name: "Time to Hire" }, { key: "Offer_Acceptance_Rate", name: "Offer Acceptance" }] },
      { title: "Productivity", type: "line", x: "Month", series: [{ key: "Revenue_per_Employee", name: "Revenue / Employee" }, { key: "Performance_Index", name: "Performance Index" }] },
    ],
  },
  legal: {
    metricCards: [
      { name: "Open Legal Risk", type: "sum", column: "Open_Risk_Items" },
      { name: "Contract Cycle", type: "avg", column: "Contract_Cycle_Days", suffix: " days" },
      { name: "Compliance Score", type: "latest", column: "Compliance_Score", suffix: "%" },
      { name: "Exposure", type: "sum", column: "Liability_Exposure", prefix: "$", compact: true },
    ],
    charts: [
      { title: "Legal Exposure", type: "area", x: "Month", series: [{ key: "Liability_Exposure", name: "Exposure" }, { key: "Outside_Counsel_Spend", name: "Outside Counsel" }] },
      { title: "Contract Throughput", type: "bar", x: "Month", series: [{ key: "Contracts_Executed", name: "Executed" }, { key: "Contract_Cycle_Days", name: "Cycle Days" }] },
      { title: "Compliance and Risk", type: "line", x: "Month", series: [{ key: "Compliance_Score", name: "Compliance" }, { key: "Open_Risk_Items", name: "Open Risks" }] },
      { title: "IP and Claims", type: "bar", x: "Month", series: [{ key: "IP_Filings", name: "IP Filings" }, { key: "Claims_Open", name: "Claims Open" }] },
    ],
  },
  it: {
    metricCards: [
      { name: "Uptime", type: "avg", column: "Uptime_Percent", suffix: "%" },
      { name: "Security Incidents", type: "sum", column: "Security_Incidents" },
      { name: "Cloud Spend", type: "sum", column: "Cloud_Spend", prefix: "$", compact: true },
      { name: "MTTR", type: "avg", column: "MTTR_Minutes", suffix: " min" },
    ],
    charts: [
      { title: "Reliability", type: "line", x: "Month", series: [{ key: "Uptime_Percent", name: "Uptime" }, { key: "MTTR_Minutes", name: "MTTR" }] },
      { title: "Security Posture", type: "bar", x: "Month", series: [{ key: "Security_Incidents", name: "Incidents" }, { key: "Critical_Vulnerabilities", name: "Critical Vulns" }] },
      { title: "Technology Spend", type: "area", x: "Month", series: [{ key: "Cloud_Spend", name: "Cloud Spend" }, { key: "SaaS_Spend", name: "SaaS Spend" }] },
      { title: "Service Desk", type: "bar", x: "Month", series: [{ key: "Tickets_Resolved", name: "Resolved" }, { key: "Provisioning_SLA_Hours", name: "Provision SLA" }] },
    ],
  },
  operations: {
    metricCards: [
      { name: "On-Time Delivery", type: "avg", column: "On_Time_Delivery", suffix: "%" },
      { name: "Gross Yield", type: "avg", column: "Gross_Yield", suffix: "%" },
      { name: "Inventory Turns", type: "avg", column: "Inventory_Turns", suffix: "x" },
      { name: "Unit Cost", type: "avg", column: "Unit_Cost", prefix: "$" },
    ],
    charts: [
      { title: "Throughput and Demand", type: "area", x: "Month", series: [{ key: "Throughput_Units", name: "Throughput" }, { key: "Demand_Units", name: "Demand" }] },
      { title: "Quality and Yield", type: "line", x: "Month", series: [{ key: "Gross_Yield", name: "Yield" }, { key: "Defect_Rate_PPM", name: "Defects PPM" }] },
      { title: "Cost Structure", type: "bar", x: "Month", series: [{ key: "Operating_Cost", name: "Operating Cost" }, { key: "Unit_Cost", name: "Unit Cost" }] },
      { title: "Supply Chain Health", type: "line", x: "Month", series: [{ key: "On_Time_Delivery", name: "On-Time Delivery" }, { key: "Inventory_Turns", name: "Inventory Turns" }] },
    ],
  },
  sales: {
    metricCards: [
      { name: "Pipeline", type: "sum", column: "Qualified_Pipeline", prefix: "$", compact: true },
      { name: "Bookings", type: "sum", column: "Bookings", prefix: "$", compact: true },
      { name: "Win Rate", type: "avg", column: "Win_Rate", suffix: "%" },
      { name: "Quota Attainment", type: "avg", column: "Quota_Attainment", suffix: "%" },
    ],
    charts: [
      { title: "Pipeline Creation", type: "area", x: "Month", series: [{ key: "Pipeline_Created", name: "Created" }, { key: "Qualified_Pipeline", name: "Qualified" }] },
      { title: "Bookings and ARR Won", type: "bar", x: "Month", series: [{ key: "Bookings", name: "Bookings" }, { key: "ARR_Won", name: "ARR Won" }] },
      { title: "Sales Efficiency", type: "line", x: "Month", series: [{ key: "Win_Rate", name: "Win Rate" }, { key: "Quota_Attainment", name: "Quota" }] },
      { title: "Forecast and Risk", type: "bar", x: "Month", series: [{ key: "Forecast_Commit", name: "Commit" }, { key: "Churn_Risk_ARR", name: "Churn Risk ARR" }] },
    ],
  },
  marketing: {
    metricCards: [
      { name: "Pipeline Created", type: "sum", column: "Pipeline_Created", prefix: "$", compact: true },
      { name: "CAC", type: "avg", column: "CAC", prefix: "$" },
      { name: "LTV:CAC", type: "ratio", numerator: "LTV", denominator: "CAC", suffix: "x" },
      { name: "ROAS", type: "avg", column: "ROAS", suffix: "x" },
    ],
    charts: [
      { title: "Spend to Pipeline", type: "area", x: "Month", series: [{ key: "Spend", name: "Spend" }, { key: "Pipeline_Created", name: "Pipeline" }] },
      { title: "Funnel", type: "bar", x: "Month", series: [{ key: "MQL", name: "MQL" }, { key: "SQL", name: "SQL" }] },
      { title: "Unit Economics", type: "line", x: "Month", series: [{ key: "CAC", name: "CAC" }, { key: "LTV", name: "LTV" }] },
      { title: "Conversion and Brand Demand", type: "line", x: "Month", series: [{ key: "Conversion_Rate", name: "Conversion" }, { key: "Brand_Search_Index", name: "Brand Search" }] },
    ],
  },
  product: {
    metricCards: [
      { name: "Active Users", type: "latest", column: "Active_Users", compact: true },
      { name: "30d Retention", type: "avg", column: "Retention_30d", suffix: "%" },
      { name: "NPS", type: "latest", column: "NPS" },
      { name: "ARR Influenced", type: "sum", column: "ARR_Influenced", prefix: "$", compact: true },
    ],
    charts: [
      { title: "Adoption and Usage", type: "area", x: "Month", series: [{ key: "Active_Users", name: "Active Users" }, { key: "Feature_Adoption", name: "Feature Adoption" }] },
      { title: "Retention and Activation", type: "line", x: "Month", series: [{ key: "Activation_Rate", name: "Activation" }, { key: "Retention_30d", name: "30d Retention" }] },
      { title: "Delivery Health", type: "bar", x: "Month", series: [{ key: "Velocity_SP", name: "Velocity" }, { key: "Cycle_Time_Days", name: "Cycle Time" }] },
      { title: "Quality and Revenue Impact", type: "bar", x: "Month", series: [{ key: "Bugs_P1", name: "P1 Bugs" }, { key: "ARR_Influenced", name: "ARR Influenced" }] },
    ],
  },
  rd: {
    metricCards: [
      { name: "R&D Spend", type: "sum", column: "R&D_Spend", prefix: "$", compact: true },
      { name: "Patent Filings", type: "sum", column: "Patent_Filings" },
      { name: "Milestone Hit Rate", type: "avg", column: "Milestone_Hit_Rate", suffix: "%" },
      { name: "Time to Prototype", type: "avg", column: "Time_to_Prototype_Days", suffix: " days" },
    ],
    charts: [
      { title: "Innovation Investment", type: "area", x: "Month", series: [{ key: "R&D_Spend", name: "R&D Spend" }, { key: "Budget_Allocated", name: "Budget" }] },
      { title: "IP Creation", type: "bar", x: "Month", series: [{ key: "Patent_Filings", name: "Patent Filings" }, { key: "Experiments_Run", name: "Experiments" }] },
      { title: "Milestone Execution", type: "line", x: "Month", series: [{ key: "Milestone_Hit_Rate", name: "Hit Rate" }, { key: "TRL_Score", name: "TRL" }] },
      { title: "Prototype Velocity", type: "bar", x: "Month", series: [{ key: "Time_to_Prototype_Days", name: "Prototype Days" }, { key: "Researchers_Count", name: "Researchers" }] },
    ],
  },
  "customer-service": {
    metricCards: [
      { name: "CSAT", type: "avg", column: "CSAT", suffix: "/5" },
      { name: "NPS", type: "latest", column: "NPS" },
      { name: "First Response", type: "avg", column: "First_Response_Minutes", suffix: " min" },
      { name: "Backlog", type: "latest", column: "Backlog_Tickets" },
    ],
    charts: [
      { title: "Ticket Flow", type: "area", x: "Month", series: [{ key: "Tickets_Created", name: "Created" }, { key: "Tickets_Resolved", name: "Resolved" }] },
      { title: "Customer Experience", type: "line", x: "Month", series: [{ key: "CSAT", name: "CSAT" }, { key: "NPS", name: "NPS" }] },
      { title: "SLA Performance", type: "bar", x: "Month", series: [{ key: "First_Response_Minutes", name: "First Response" }, { key: "Resolution_Time_Hours", name: "Resolution Time" }] },
      { title: "Escalation Pressure", type: "bar", x: "Month", series: [{ key: "Escalation_Rate", name: "Escalation Rate" }, { key: "Backlog_Tickets", name: "Backlog" }] },
    ],
  },
  risk: {
    metricCards: [
      { name: "Enterprise Risk", type: "latest", column: "Enterprise_Risk_Score" },
      { name: "Control Coverage", type: "avg", column: "Control_Coverage", suffix: "%" },
      { name: "Audit Score", type: "avg", column: "Audit_Score", suffix: "/100" },
      { name: "Unmitigated Risks", type: "sum", column: "Unmitigated_Risks" },
    ],
    charts: [
      { title: "Risk Index", type: "line", x: "Month", series: [{ key: "Enterprise_Risk_Score", name: "Risk Score" }, { key: "Unmitigated_Risks", name: "Unmitigated" }] },
      { title: "Control Coverage", type: "area", x: "Month", series: [{ key: "Control_Coverage", name: "Coverage" }, { key: "Audit_Score", name: "Audit Score" }] },
      { title: "Incident Profile", type: "bar", x: "Month", series: [{ key: "Security_Findings", name: "Security Findings" }, { key: "Operational_Loss", name: "Operational Loss" }] },
      { title: "Mitigation Velocity", type: "bar", x: "Month", series: [{ key: "Mitigated_Risks", name: "Mitigated" }, { key: "Open_Audit_Items", name: "Open Audit Items" }] },
    ],
  },
  strategy: {
    metricCards: [
      { name: "Strategic Pipeline", type: "sum", column: "Strategic_Pipeline_Value", prefix: "$", compact: true },
      { name: "TAM Coverage", type: "avg", column: "TAM_Coverage", suffix: "%" },
      { name: "Synergy Score", type: "avg", column: "Synergy_Score" },
      { name: "Partnership Revenue", type: "sum", column: "Partnership_Revenue", prefix: "$", compact: true },
    ],
    charts: [
      { title: "Strategic Pipeline", type: "area", x: "Month", series: [{ key: "Strategic_Pipeline_Value", name: "Pipeline Value" }, { key: "Partnership_Revenue", name: "Partnership Revenue" }] },
      { title: "Market Expansion", type: "line", x: "Month", series: [{ key: "TAM_Coverage", name: "TAM Coverage" }, { key: "Market_Share", name: "Market Share" }] },
      { title: "Deal Quality", type: "bar", x: "Month", series: [{ key: "Synergy_Score", name: "Synergy" }, { key: "Diligence_Risk_Score", name: "Diligence Risk" }] },
      { title: "Competitive Posture", type: "line", x: "Month", series: [{ key: "Competitive_Win_Rate", name: "Win Rate" }, { key: "Strategic_Initiatives_OnTrack", name: "On Track" }] },
    ],
  },
};

const METRIC_DEFINITIONS = {
  ARR: "Annual recurring revenue; the recurring revenue base normalized to a yearly run rate.",
  "Rule of 40": "Revenue growth rate plus free cash flow margin; a CEO shorthand for balancing growth and profitability.",
  Runway: "Estimated months of cash remaining at the current operating expense level.",
  "Enterprise Risk": "Composite risk posture from audit, security, operational, compliance, and mitigation signals.",
  "Value Creation and Cash": "Executive scorecard for growth quality, retention, gross margin, and runway.",
  "GTM Efficiency": "Go-to-market scorecard covering pipeline, bookings, CAC payback, and sales win rate.",
  "Customer and Product Health": "Customer/product scorecard covering retention, NPS, CSAT, and activation.",
  "Risk and Execution Posture": "Execution scorecard covering enterprise risk, audit posture, operational delivery, and incidents.",
  "CEO Score": "Normalized 0-100 operating score against the CEO target for metrics with different units.",
  "Target Score": "The benchmark score line; 100 means the metric meets the CEO target.",
  NRR: "Net revenue retention; expansion minus contraction and churn across the existing customer base.",
  "Gross Margin": "Revenue after direct cost of goods sold, expressed as a percentage of revenue.",
  "Qualified Pipeline": "Sales pipeline that meets qualification criteria and is credible for forecast planning.",
  Bookings: "Closed contract value booked in the measured period.",
  "CAC Payback": "Months required to recover customer acquisition cost from gross profit.",
  "Win Rate": "Percentage of qualified opportunities converted to closed won deals.",
  "30d Retention": "Share of users or customers still active 30 days after activation.",
  NPS: "Net Promoter Score; customer willingness to recommend the product.",
  CSAT: "Customer satisfaction score.",
  Activation: "Percentage of new users reaching the product's defined value moment.",
  "Audit Score": "Internal or external audit score across controls and operating compliance.",
  "On-Time Delivery": "Percentage of operational commitments delivered on or before target.",
  "Security Incidents": "Count of material security incidents in the period.",
};

const parseCsvText = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV has an unclosed quoted value.");
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
};

const parseCsvFile = async (file) => {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const rows = parseCsvText(text);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = rows[0];
  const records = rows.slice(1).map((values) => {
    return headers.reduce((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {});
  });

  return { headers, records };
};

const buildDepartmentSnapshot = (departmentId, file, parsedCsv, importType = "current-upload") => ({
  departmentId,
  departmentName: DEPT_CONFIGS[departmentId]?.title || departmentId,
  filename: file.name,
  importType,
  uploadedAt: new Date().toISOString(),
  headers: parsedCsv.headers,
  recordCount: parsedCsv.records.length,
  records: parsedCsv.records,
  sampleRecords: parsedCsv.records.slice(0, 5),
});

const fetchCurrentDataStore = async () => {
  const response = await fetch("/api/current-data");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load current data.");
  }

  return data.departments || {};
};

const fetchHistoricalDataStore = async (departmentId) => {
  const params = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  const response = await fetch(`/api/historical-data${params}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load historical imports.");
  }

  return data.history || [];
};

const saveDepartmentSnapshot = async (departmentSnapshot) => {
  const response = await fetch("/api/current-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(departmentSnapshot),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to save current data.");
  }

  return data.departments || {};
};

const saveBoardMemo = async (memo) => {
  const response = await fetch("/api/board-memos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(memo),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to save board memo.");
  }

  return data;
};

const fetchNotionOkrs = async ({ sync = false } = {}) => {
  const response = await fetch("/api/notion/okrs", {
    method: sync ? "POST" : "GET",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Notion OKRs.");
  }

  return data;
};

const formatDateTime = (value) => {
  if (!value) return "Not uploaded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/[$,%\s]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMetricValue = (value, metric = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "Missing";
  const absValue = Math.abs(value);
  const compactValue = metric.compact && absValue >= 1000
    ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : new Intl.NumberFormat("en", { maximumFractionDigits: value % 1 === 0 ? 0 : 1 }).format(value);

  return `${metric.prefix || ""}${compactValue}${metric.suffix || ""}`;
};

const getColumnValues = (rows, column) => rows
  .map((row) => toNumber(row[column]))
  .filter((value) => value !== null);

const getLatestValue = (rows, column) => {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = toNumber(rows[index][column]);
    if (value !== null) return value;
  }
  return null;
};

const getDepartmentSnapshot = (departmentRows, departmentId) =>
  departmentRows.find((department) => department.departmentId === departmentId);

const latestDepartmentValue = (departmentRows, departmentId, column) => {
  const snapshot = getDepartmentSnapshot(departmentRows, departmentId);
  return snapshot ? getLatestValue(snapshot.records || [], column) : null;
};

const sumDepartmentColumn = (departmentRows, departmentId, column) => {
  const snapshot = getDepartmentSnapshot(departmentRows, departmentId);
  const values = snapshot ? getColumnValues(snapshot.records || [], column) : [];
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
};

const averageDepartmentColumn = (departmentRows, departmentId, column) => {
  const snapshot = getDepartmentSnapshot(departmentRows, departmentId);
  const values = snapshot ? getColumnValues(snapshot.records || [], column) : [];
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};

const safeSum = (...values) => {
  const usable = values.filter((value) => value !== null && value !== undefined);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) : null;
};

const calculateExecutiveMetrics = (departmentRows) => {
  const revenueGrowth = latestDepartmentValue(departmentRows, "finance", "Revenue_Growth_Rate");
  const fcfMargin = latestDepartmentValue(departmentRows, "finance", "FCF_Margin");
  const cashBalance = latestDepartmentValue(departmentRows, "finance", "Cash_Balance");
  const operatingExpenses = latestDepartmentValue(departmentRows, "finance", "Operating_Expenses");

  return {
    arr: latestDepartmentValue(departmentRows, "finance", "ARR"),
    ruleOf40: safeSum(revenueGrowth, fcfMargin),
    runway: cashBalance !== null && operatingExpenses ? cashBalance / operatingExpenses : null,
    enterpriseRisk: latestDepartmentValue(departmentRows, "risk", "Enterprise_Risk_Score"),
  };
};

const scorePoint = (label, value, target, invert = false) => ({
  period: label,
  value: value === null ? 0 : Number(value.toFixed ? value.toFixed(1) : value),
  target,
  targetScore: 100,
  health: value === null ? 0 : Math.max(0, Math.min(100, invert ? (target / Math.max(value, 0.01)) * 100 : (value / target) * 100)),
});

const calculateMetric = (rows, metric) => {
  if (!rows.length) return null;

  if (metric.type === "count") return rows.length;

  if (metric.type === "latest") return getLatestValue(rows, metric.column);

  if (metric.type === "sum") {
    const values = getColumnValues(rows, metric.column);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  if (metric.type === "avg") {
    const values = getColumnValues(rows, metric.column);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  if (metric.type === "ratio") {
    const numerator = getLatestValue(rows, metric.numerator);
    const denominator = getLatestValue(rows, metric.denominator);
    if (numerator === null || !denominator) return null;
    return numerator / denominator;
  }

  if (metric.type === "sumLatest") {
    const values = metric.columns.map((column) => getLatestValue(rows, column));
    if (values.some((value) => value === null)) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }

  return null;
};

const buildMetricCards = (departmentId, snapshot, executiveRows) => {
  const model = ANALYTICS_MODELS[departmentId];
  if (!model) return [];

  if (departmentId === "executive") {
    const executiveMetrics = calculateExecutiveMetrics(executiveRows);

    return [
      { name: "ARR", value: formatMetricValue(executiveMetrics.arr, { prefix: "$", compact: true }) },
      { name: "Rule of 40", value: formatMetricValue(executiveMetrics.ruleOf40, { suffix: "%" }) },
      { name: "Runway", value: formatMetricValue(executiveMetrics.runway, { suffix: " mo" }) },
      { name: "Enterprise Risk", value: formatMetricValue(executiveMetrics.enterpriseRisk) },
    ];
  }

  const rows = snapshot?.records || [];
  return model.metricCards.map((metric) => ({
    name: metric.name,
    value: rows.length ? formatMetricValue(calculateMetric(rows, metric), metric) : "Upload CSV",
  }));
};

const normalizeChartRows = (rows, chart) => rows.slice(0, 24).map((row, index) => {
  const point = {
    period: getPeriodLabel(row, index, Object.keys(row)),
  };

  chart.series.forEach((series) => {
    point[series.key] = toNumber(row[series.key]) || 0;
  });

  return point;
});

const getNumericHeaders = (snapshot) => {
  if (!snapshot?.records?.length) return [];
  return snapshot.headers.filter((header) => snapshot.records.some((record) => toNumber(record[header]) !== null));
};

const parseDateValue = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const quarterMatch = text.match(/^(\d{4})[-\s]?Q([1-4])$/i);
  if (quarterMatch) {
    const month = (Number(quarterMatch[2]) - 1) * 3;
    return new Date(Number(quarterMatch[1]), month, 1);
  }

  const monthMatch = text.match(/^(\d{4})-(\d{1,2})$/);
  if (monthMatch) {
    return new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1);
  }

  const yearMatch = text.match(/^\d{4}$/);
  if (yearMatch) return new Date(Number(text), 0, 1);

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isDateHeader = (header, rows) =>
  /date|month|quarter|period|week|year|uploaded|created|updated/i.test(header) ||
  rows.some((row) => parseDateValue(row[header]));

const getChartSourceRows = ({ isExecutiveDashboard, departmentUpload, storedDepartmentRows }) => {
  if (!isExecutiveDashboard) return departmentUpload?.records || [];

  return storedDepartmentRows.flatMap((department) =>
    (department.records || []).map((record, index) => ({
      Department: department.departmentId,
      Department_Name: department.departmentName,
      Uploaded_At: department.uploadedAt,
      Row: index + 1,
      ...record,
    }))
  );
};

const getChartSourceHeaders = ({ isExecutiveDashboard, departmentUpload, chartSourceRows }) => {
  if (!isExecutiveDashboard) return departmentUpload?.headers || [];
  const headers = new Set(["Department", "Department_Name", "Uploaded_At", "Row"]);
  chartSourceRows.forEach((row) => Object.keys(row).forEach((key) => headers.add(key)));
  return Array.from(headers);
};

const buildAdvancedChartOptions = (rows, headers) => {
  const numericHeaders = headers.filter((header) =>
    rows.some((row) => toNumber(row[header]) !== null)
  );
  const dateHeaders = headers.filter((header) => isDateHeader(header, rows));
  const dimensionHeaders = headers.filter((header) =>
    header &&
    (dateHeaders.includes(header) ||
      !numericHeaders.includes(header) ||
      rows.some((row) => row[header] !== null && row[header] !== undefined && row[header] !== ""))
  );

  return { numericHeaders, dateHeaders, dimensionHeaders };
};

const formatDateInputValue = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateBounds = (rows, dateColumn) => {
  if (!dateColumn) return { min: "", max: "" };
  const dates = rows
    .map((row) => parseDateValue(row[dateColumn]))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  return {
    min: formatDateInputValue(dates[0]),
    max: formatDateInputValue(dates[dates.length - 1]),
  };
};

const buildAdvancedChartPanel = ({ rows, config }) => {
  const {
    xColumn,
    yColumn,
    dateColumn,
    startDate,
    endDate,
    chartType,
    aggregation,
  } = config;

  if (!rows.length || !xColumn || !yColumn) {
    return {
      title: "Advanced Chart Builder",
      type: chartType,
      series: [{ key: "value", name: yColumn || "Value" }],
      data: [],
      missingColumns: [],
      xMode: "category",
    };
  }

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  const filteredRows = rows.filter((row) => {
    if (!dateColumn || (!start && !end)) return true;
    const date = parseDateValue(row[dateColumn]);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });

  const xIsNumeric = filteredRows.some((row) => toNumber(row[xColumn]) !== null);

  if (chartType === "scatter" && xIsNumeric) {
    return {
      title: `${yColumn} vs ${xColumn}`,
      type: "scatter",
      series: [{ key: "value", name: yColumn }],
      data: filteredRows
        .map((row, index) => ({
          period: getPeriodLabel(row, index, Object.keys(row)),
          x: toNumber(row[xColumn]),
          value: toNumber(row[yColumn]),
        }))
        .filter((point) => point.x !== null && point.value !== null)
        .slice(0, 250),
      missingColumns: [],
      xMode: "number",
      xLabel: xColumn,
    };
  }

  const groups = new Map();
  filteredRows.forEach((row, index) => {
    const rawLabel = row[xColumn] ?? getPeriodLabel(row, index, Object.keys(row));
    const labelDate = parseDateValue(rawLabel);
    const label = labelDate && isDateHeader(xColumn, filteredRows)
      ? formatDateInputValue(labelDate)
      : String(rawLabel || `Row ${index + 1}`).slice(0, 32);
    const value = toNumber(row[yColumn]);
    if (value === null) return;
    const existing = groups.get(label) || { period: label, value: 0, count: 0 };
    existing.value += value;
    existing.count += 1;
    groups.set(label, existing);
  });

  const data = Array.from(groups.values())
    .map((point) => ({
      ...point,
      value: aggregation === "avg" ? point.value / point.count : point.value,
    }))
    .sort((a, b) => String(a.period).localeCompare(String(b.period), undefined, { numeric: true }))
    .slice(0, 100);

  return {
    title: `${yColumn} by ${xColumn}`,
    type: chartType === "scatter" ? "bar" : chartType,
    series: [{ key: "value", name: `${aggregation === "avg" ? "Avg" : "Sum"} ${yColumn}` }],
    data,
    missingColumns: [],
    xMode: "category",
  };
};

const getPeriodLabel = (record, index, headers) => {
  const preferredHeader = headers.find((header) =>
    /date|month|quarter|period|stage|department|owner|name|id/i.test(header)
  );

  if (preferredHeader && record[preferredHeader]) {
    return String(record[preferredHeader]).slice(0, 18);
  }

  const firstTextHeader = headers.find((header) => toNumber(record[header]) === null && record[header]);
  return firstTextHeader ? String(record[firstTextHeader]).slice(0, 18) : `Row ${index + 1}`;
};

const buildDepartmentCharts = (departmentId, snapshot) => {
  const model = ANALYTICS_MODELS[departmentId];
  if (!model) return [];
  if (!snapshot?.records?.length) {
    return model.charts.map((chart) => ({
      ...chart,
      data: [],
      missingColumns: [],
    }));
  }

  return model.charts.map((chart) => ({
    ...chart,
    data: normalizeChartRows(snapshot.records, chart),
    missingColumns: chart.series
      .map((series) => series.key)
      .filter((key) => !snapshot.headers.includes(key)),
  }));
};

const buildExecutiveCharts = (departmentRows) => {
  const valueCreationData = [
    scorePoint(
      "Rule of 40",
      safeSum(
        latestDepartmentValue(departmentRows, "finance", "Revenue_Growth_Rate"),
        latestDepartmentValue(departmentRows, "finance", "FCF_Margin")
      ),
      40
    ),
    scorePoint("NRR", latestDepartmentValue(departmentRows, "sales", "Net_Revenue_Retention") ?? latestDepartmentValue(departmentRows, "finance", "Net_Revenue_Retention"), 110),
    scorePoint("Gross Margin", latestDepartmentValue(departmentRows, "finance", "Gross_Margin"), 75),
    scorePoint("Runway", calculateExecutiveMetrics(departmentRows).runway, 18),
  ];

  const gtmData = [
    scorePoint("Qualified Pipeline", sumDepartmentColumn(departmentRows, "sales", "Qualified_Pipeline"), 5000000),
    scorePoint("Bookings", sumDepartmentColumn(departmentRows, "sales", "Bookings"), 3000000),
    scorePoint("CAC Payback", averageDepartmentColumn(departmentRows, "marketing", "CAC_Payback_Months"), 12, true),
    scorePoint("Win Rate", averageDepartmentColumn(departmentRows, "sales", "Win_Rate"), 30),
  ];

  const customerProductData = [
    scorePoint("30d Retention", averageDepartmentColumn(departmentRows, "product", "Retention_30d"), 75),
    scorePoint("NPS", latestDepartmentValue(departmentRows, "product", "NPS") ?? latestDepartmentValue(departmentRows, "customer-service", "NPS"), 50),
    scorePoint("CSAT", averageDepartmentColumn(departmentRows, "customer-service", "CSAT"), 4.7),
    scorePoint("Activation", averageDepartmentColumn(departmentRows, "product", "Activation_Rate"), 45),
  ];

  const riskExecutionData = [
    scorePoint("Enterprise Risk", latestDepartmentValue(departmentRows, "risk", "Enterprise_Risk_Score"), 2, true),
    scorePoint("Audit Score", averageDepartmentColumn(departmentRows, "risk", "Audit_Score"), 95),
    scorePoint("On-Time Delivery", averageDepartmentColumn(departmentRows, "operations", "On_Time_Delivery"), 97),
    scorePoint("Security Incidents", sumDepartmentColumn(departmentRows, "it", "Security_Incidents"), 0.5, true),
  ];

  const executiveChartData = [
    valueCreationData,
    gtmData,
    customerProductData,
    riskExecutionData,
  ];

  return ANALYTICS_MODELS.executive.charts.map((chart, index) => ({
    ...chart,
    data: executiveChartData[index],
    missingColumns: [],
  }));
};

const buildMetricGlossary = (metricCards, chartPanels) => {
  const names = new Set();

  metricCards.forEach((metric) => names.add(metric.name));
  chartPanels.forEach((panel) => {
    names.add(panel.title);
    panel.series.forEach((series) => names.add(series.name));
    panel.data.forEach((point) => names.add(point.period));
  });

  return Array.from(names)
    .filter((name) => METRIC_DEFINITIONS[name])
    .map((name) => ({
      name,
      definition: METRIC_DEFINITIONS[name],
    }));
};

const SERIES_COLORS = ["#818cf8", "#22c55e", "#f59e0b", "#ef4444"];

const renderChart = (panel) => {
  const hasData = panel.data.length > 0 && panel.missingColumns.length === 0;

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[#27272a] px-4 text-center text-xs text-zinc-500">
        {panel.missingColumns.length > 0
          ? `Missing required columns: ${panel.missingColumns.join(", ")}`
          : "Upload CSV data to render this operating chart."}
      </div>
    );
  }

  const commonAxis = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
      <XAxis dataKey="period" stroke="#52525b" fontSize={11} tickLine={false} />
      <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
    </>
  );

  if (panel.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={panel.data}>
          {commonAxis}
          {panel.series.map((series, index) => (
            <Bar key={series.key} dataKey={series.key} fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={[4, 4, 0, 0]} name={series.name} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (panel.type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={panel.data}>
          {commonAxis}
          {panel.series.map((series, index) => (
            <Line key={series.key} type="monotone" dataKey={series.key} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} name={series.name} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (panel.type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart data={panel.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
          <XAxis
            dataKey="x"
            name={panel.xLabel || "X"}
            type="number"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            dataKey="value"
            name={panel.series[0]?.name || "Value"}
            type="number"
            stroke="#52525b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
          <Scatter dataKey="value" fill={SERIES_COLORS[0]} name={panel.series[0]?.name || "Value"} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={panel.data}>
        <defs>
          {panel.series.map((series, index) => (
            <linearGradient key={series.key} id={`gradient-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={SERIES_COLORS[index % SERIES_COLORS.length]} stopOpacity={0}/>
            </linearGradient>
          ))}
        </defs>
        {commonAxis}
        {panel.series.map((series, index) => (
          <Area key={series.key} type="monotone" dataKey={series.key} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${series.key})`} name={series.name} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default function DepartmentPage() {
  const params = useParams();
  const departmentId = params.slug;
  const isExecutiveDashboard = departmentId === "executive";
  const config = DEPT_CONFIGS[departmentId] || DEPT_CONFIGS.executive;

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loadingCurrentData, setLoadingCurrentData] = useState(true);
  const [historicalImports, setHistoricalImports] = useState([]);
  const [exportingBoardMemo, setExportingBoardMemo] = useState(false);
  const [orgDataStore, setOrgDataStore] = useState({});
  const [notionOkrStore, setNotionOkrStore] = useState(null);
  const [loadingNotionOkrs, setLoadingNotionOkrs] = useState(false);
  const [syncingNotionOkrs, setSyncingNotionOkrs] = useState(false);
  const [notionOkrError, setNotionOkrError] = useState("");
  const [insights, setInsights] = useState(
    isExecutiveDashboard
      ? "Click Fetch Suggestions to generate an organization-wide CEO brief from uploaded department data."
      : "Click Fetch Suggestions to generate AI recommendations for this department."
  );
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [advancedChartConfig, setAdvancedChartConfig] = useState({
    dateColumn: "",
    startDate: "",
    endDate: "",
    xColumn: "",
    yColumn: "",
    chartType: "bar",
    aggregation: "sum",
  });
  const departmentUpload = orgDataStore[departmentId];
  const storedDepartmentRows = useMemo(
    () => Object.values(orgDataStore).sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
    [orgDataStore]
  );
  const latestUpload = storedDepartmentRows.reduce((latest, item) => {
    if (!latest || new Date(item.uploadedAt) > new Date(latest.uploadedAt)) return item;
    return latest;
  }, null);
  const displayedMetrics = useMemo(
    () => buildMetricCards(departmentId, departmentUpload, storedDepartmentRows),
    [departmentId, departmentUpload, storedDepartmentRows]
  );
  const chartPanels = useMemo(
    () => isExecutiveDashboard ? buildExecutiveCharts(storedDepartmentRows) : buildDepartmentCharts(departmentId, departmentUpload),
    [departmentId, departmentUpload, isExecutiveDashboard, storedDepartmentRows]
  );
  const advancedChartRows = useMemo(
    () => getChartSourceRows({ isExecutiveDashboard, departmentUpload, storedDepartmentRows }),
    [departmentUpload, isExecutiveDashboard, storedDepartmentRows]
  );
  const advancedChartHeaders = useMemo(
    () => getChartSourceHeaders({ isExecutiveDashboard, departmentUpload, chartSourceRows: advancedChartRows }),
    [advancedChartRows, departmentUpload, isExecutiveDashboard]
  );
  const advancedChartOptions = useMemo(
    () => buildAdvancedChartOptions(advancedChartRows, advancedChartHeaders),
    [advancedChartHeaders, advancedChartRows]
  );
  const effectiveAdvancedChartConfig = useMemo(() => {
    const dateColumn = advancedChartOptions.dateHeaders.includes(advancedChartConfig.dateColumn)
      ? advancedChartConfig.dateColumn
      : advancedChartOptions.dateHeaders[0] || "";
    const xColumn = advancedChartOptions.dimensionHeaders.includes(advancedChartConfig.xColumn)
      ? advancedChartConfig.xColumn
      : dateColumn || advancedChartOptions.dimensionHeaders[0] || "";
    const yColumn = advancedChartOptions.numericHeaders.includes(advancedChartConfig.yColumn)
      ? advancedChartConfig.yColumn
      : advancedChartOptions.numericHeaders[0] || "";
    const bounds = getDateBounds(advancedChartRows, dateColumn);

    return {
      ...advancedChartConfig,
      dateColumn,
      xColumn,
      yColumn,
      startDate: advancedChartConfig.startDate || bounds.min,
      endDate: advancedChartConfig.endDate || bounds.max,
    };
  }, [advancedChartConfig, advancedChartOptions, advancedChartRows]);
  const advancedChartPanel = useMemo(
    () => buildAdvancedChartPanel({ rows: advancedChartRows, config: effectiveAdvancedChartConfig }),
    [effectiveAdvancedChartConfig, advancedChartRows]
  );
  const metricGlossary = useMemo(
    () => buildMetricGlossary(displayedMetrics, chartPanels),
    [displayedMetrics, chartPanels]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setLoadingCurrentData(true);
      fetchCurrentDataStore()
        .then((nextStore) => {
          setOrgDataStore(nextStore);
          setInsights(
            departmentId === "executive"
              ? "Click Fetch Suggestions to generate an organization-wide CEO brief from Supabase JSONB."
              : "Click Fetch Suggestions to generate AI recommendations for this department."
          );
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Unable to load current data.";
          setInsights(`Current data load failed: ${message}`);
        })
        .finally(() => setLoadingCurrentData(false));

      fetchHistoricalDataStore(isExecutiveDashboard ? "" : departmentId)
        .then(setHistoricalImports)
        .catch((error) => {
          console.error("Historical import load failed:", error);
        });
    });
  }, [departmentId, isExecutiveDashboard]);

  useEffect(() => {
    if (departmentId !== "product") {
      return;
    }

    queueMicrotask(() => {
      setLoadingNotionOkrs(true);
      fetchNotionOkrs()
        .then((store) => {
          setNotionOkrStore(store);
          setNotionOkrError("");
        })
        .catch((error) => {
          setNotionOkrError(error instanceof Error ? error.message : "Unable to load Notion OKRs.");
        })
        .finally(() => setLoadingNotionOkrs(false));
    });
  }, [departmentId]);

  const fetchInsights = useCallback(async (targetDepartmentId = departmentId) => {
    if (!targetDepartmentId || !DEPT_CONFIGS[targetDepartmentId]) {
      setInsights("Select a valid department to generate executive intelligence synthesis.");
      return;
    }

    setLoadingInsights(true);
    try {
      const analyticsPayload = {
        departmentData: orgDataStore[targetDepartmentId] || null,
        organizationData: isExecutiveDashboard ? orgDataStore : null,
        dashboardSummary: {
          metricCards: displayedMetrics,
          chartScorecards: isExecutiveDashboard
            ? chartPanels.map((panel) => ({
                title: panel.title,
                points: panel.data.map((point) => ({
                  metric: point.period,
                  value: point.value,
                  target: point.target,
                  score: point.health,
                })),
              }))
            : [],
        },
      };
      const res = await fetch(`/api/analytics/${targetDepartmentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(analyticsPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Analytics request failed with status ${res.status}`);
      }
      setInsights(data.analysis || "No executive insights returned for this division layout.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown analytics error";
      setInsights(`Error generating TAI Chief synthesis: ${message}`);
    } finally {
      setLoadingInsights(false);
    }
  }, [chartPanels, departmentId, displayedMetrics, isExecutiveDashboard, orgDataStore]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([config.csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${departmentId}_strategic_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    generateDashboardPdfReport({
      title: isExecutiveDashboard
        ? "Executive Operating Intelligence Report"
        : `${config.title} Intelligence Report`,
      departmentName: config.title,
      generatedAt: new Date().toISOString(),
      insights,
      metrics: displayedMetrics,
      chartPanels,
      isExecutive: isExecutiveDashboard,
      departmentUpload,
      storedDepartmentRows,
      historicalImports,
    });
  };

  const handleExportBoardMemo = async () => {
    setExportingBoardMemo(true);
    try {
      const memo = {
        memoType: "board-memo",
        title: isExecutiveDashboard
          ? "Executive Board Memo"
          : `${config.title} Board Memo`,
        departmentId,
        departmentName: config.title,
        generatedAt: new Date().toISOString(),
        executiveSummary: insights,
        recommendation:
          "Use this memo to align the board on current operating health, decision priorities, and the management actions implied by the latest department data.",
        risks: chartPanels
          .flatMap((panel) => panel.data || [])
          .filter((point) => typeof point.health === "number" && point.health < 70)
          .slice(0, 5)
          .map((point) => `${point.period}: score ${Math.round(point.health)}`)
          .join("\n") || "No quantified risk score below threshold in the current dashboard calculation.",
        actions:
          "Review under-target scorecards, assign owners to each gap, refresh department CSVs before the next operating review, and re-run AI synthesis after the data update.",
        metrics: displayedMetrics,
        chartPanels,
        historicalImports,
      };

      const savedMemo = await saveBoardMemo(memo);
      generateBoardMemoPdf({
        ...memo,
        memoId: savedMemo.id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export board memo.";
      alert(message);
    } finally {
      setExportingBoardMemo(false);
    }
  };

  const handleFileUpload = async (file, importType = "current-upload") => {
    if (!file) return;
    setUploading(true);

    try {
      const parsedCsv = await parseCsvFile(file);
      const departmentSnapshot = buildDepartmentSnapshot(departmentId, file, parsedCsv, importType);
      const nextStore = await saveDepartmentSnapshot(departmentSnapshot);
      const nextHistory = await fetchHistoricalDataStore(isExecutiveDashboard ? "" : departmentId);

      setOrgDataStore(nextStore);
      setHistoricalImports(nextHistory);
      setInsights("Upload saved to Supabase JSONB and historical imports. Click Fetch Suggestions to generate updated AI recommendations.");
      alert("CSV saved to Supabase, historical imports, and the organization summary was updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse CSV.";
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSyncNotionOkrs = async () => {
    setSyncingNotionOkrs(true);
    setNotionOkrError("");
    try {
      const store = await fetchNotionOkrs({ sync: true });
      setNotionOkrStore(store);
    } catch (error) {
      setNotionOkrError(error instanceof Error ? error.message : "Unable to sync Notion OKRs.");
    } finally {
      setSyncingNotionOkrs(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 sm:space-y-8">
      {/* Header Context Bar */}
      <div className="flex flex-col gap-4 border-b border-[#27272a] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-white">{config.title}</h1>
          <p className="text-xs text-zinc-400 mt-1">Strategic Operations Control & Predictive Modeling Matrix</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={handleExportPdf}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-4 text-xs font-medium text-indigo-100 transition-colors hover:bg-indigo-500/20 hover:text-white sm:h-9 sm:w-auto"
          >
            📄 Export PDF Report
          </button>
          <button
            onClick={handleExportBoardMemo}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-medium text-emerald-100 transition-colors hover:bg-emerald-500/20 hover:text-white sm:h-9 sm:w-auto"
            disabled={exportingBoardMemo}
          >
            {exportingBoardMemo ? "Saving Memo..." : "📝 Export Board Memo"}
          </button>
          {!isExecutiveDashboard && (
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#18181b] px-4 text-xs font-medium text-zinc-200 border border-[#27272a] hover:bg-[#27272a] hover:text-white transition-colors sm:h-9 sm:w-auto"
          >
            📥 Download CSV Template
          </button>
          )}
        </div>
      </div>

      {metricGlossary.length > 0 && (
        <details className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-5">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Metrics Glossary
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {metricGlossary.map((metric) => (
              <div key={metric.name} className="rounded-lg border border-[#27272a] bg-[#0f0f11] p-3">
                <div className="text-xs font-semibold text-zinc-100">{metric.name}</div>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{metric.definition}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Core Metrics Summary Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {displayedMetrics.map((metric, idx) => (
          <div key={idx} className="rounded-xl border border-[#27272a] bg-[#121214] p-5 shadow-sm">
            <div className="text-xs font-medium text-zinc-500">{metric.name}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{metric.value}</div>
          </div>
        ))}
      </div>

      {departmentId === "product" && (
        <div className="rounded-xl border border-sky-500/25 bg-gradient-to-b from-sky-500/10 to-[#121214] p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-200">Notion Product OKR Tracker</h3>
              <p className="mt-1 text-xs text-zinc-400">
                Syncs a real Notion OKR database into TAI Chief for product objective health, ownership, and risk tracking.
              </p>
            </div>
            <button
              onClick={handleSyncNotionOkrs}
              disabled={syncingNotionOkrs}
              className="inline-flex h-9 items-center justify-center rounded-md bg-sky-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncingNotionOkrs ? "Syncing Notion..." : "Sync Notion OKRs"}
            </button>
          </div>

          {notionOkrError && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
              {notionOkrError} Connect Notion in Integrations or set NOTION_API_KEY and NOTION_OKR_DATABASE_ID in Vercel.
            </div>
          )}

          {loadingNotionOkrs ? (
            <div className="rounded-lg border border-dashed border-sky-500/20 p-6 text-center text-xs text-zinc-500">
              Loading Notion OKRs...
            </div>
          ) : notionOkrStore?.okrs?.length ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-5">
                {[
                  ["OKRs", notionOkrStore.summary?.total ?? notionOkrStore.okrs.length],
                  ["Avg Progress", notionOkrStore.summary?.avgProgress === null ? "n/a" : `${notionOkrStore.summary?.avgProgress}%`],
                  ["At Risk", notionOkrStore.summary?.atRisk ?? 0],
                  ["Completed", notionOkrStore.summary?.completed ?? 0],
                  ["Owners", notionOkrStore.summary?.owners ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="border-b border-sky-500/20 text-zinc-500">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Objective</th>
                      <th className="py-2 pr-4 font-medium">Key Result</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Progress</th>
                      <th className="py-2 pr-4 font-medium">Quarter</th>
                      <th className="py-2 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202024] text-zinc-300">
                    {notionOkrStore.okrs.slice(0, 12).map((okr) => (
                      <tr key={okr.id}>
                        <td className="py-3 pr-4 font-medium text-zinc-100">{okr.objective}</td>
                        <td className="py-3 pr-4 text-zinc-400">{okr.keyResult}</td>
                        <td className="py-3 pr-4">{okr.owner}</td>
                        <td className="py-3 pr-4">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-300">
                            {okr.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sky-200">
                          {typeof okr.progress === "number" ? `${okr.progress}%` : "n/a"}
                        </td>
                        <td className="py-3 pr-4 text-zinc-400">{okr.quarter}</td>
                        <td className="py-3 text-zinc-400">{okr.dueDate || "n/a"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-zinc-500">
                Last synced: {formatDateTime(notionOkrStore.syncedAt)}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sky-500/20 p-6 text-center text-xs leading-5 text-zinc-500">
              No Notion OKRs synced yet. Connect Notion in Integrations, share the OKR database with your integration, then click Sync Notion OKRs.
            </div>
          )}
        </div>
      )}

      {!isExecutiveDashboard && (
        <div className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Supabase Current Data JSON</h3>
          {loadingCurrentData ? (
            <p className="mt-3 text-xs text-zinc-500">Loading Supabase JSONB...</p>
          ) : departmentUpload ? (
            <div className="mt-3 grid gap-3 text-xs text-zinc-400 sm:grid-cols-4">
              <div>
                <div className="text-zinc-500">File</div>
                <div className="mt-1 truncate text-zinc-200">{departmentUpload.filename}</div>
              </div>
              <div>
                <div className="text-zinc-500">Rows</div>
                <div className="mt-1 text-zinc-200">{departmentUpload.recordCount}</div>
              </div>
              <div>
                <div className="text-zinc-500">Columns</div>
                <div className="mt-1 text-zinc-200">{departmentUpload.headers.length}</div>
              </div>
              <div>
                <div className="text-zinc-500">Updated</div>
                <div className="mt-1 text-zinc-200">{formatDateTime(departmentUpload.uploadedAt)}</div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">No CSV uploaded for this department yet.</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/10 to-[#121214] p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
              Advanced Chart Builder
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
              Select a date range and compare any uploaded column against another. Executive mode combines all department datasets and adds department labels for cross-company analysis.
            </p>
          </div>
          <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
            {advancedChartRows.length} rows available
          </div>
        </div>

        {advancedChartRows.length && advancedChartOptions.numericHeaders.length ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date Column</span>
                <select
                  value={effectiveAdvancedChartConfig.dateColumn}
                  onChange={(e) => {
                    const dateColumn = e.target.value;
                    const bounds = getDateBounds(advancedChartRows, dateColumn);
                    setAdvancedChartConfig((current) => ({
                      ...current,
                      dateColumn,
                      startDate: bounds.min,
                      endDate: bounds.max,
                      xColumn: current.xColumn || dateColumn,
                    }));
                  }}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value="">No date filter</option>
                  {advancedChartOptions.dateHeaders.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Start Date</span>
                <input
                  type="date"
                  value={effectiveAdvancedChartConfig.startDate}
                  disabled={!effectiveAdvancedChartConfig.dateColumn}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, startDate: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500 disabled:opacity-40"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">End Date</span>
                <input
                  type="date"
                  value={effectiveAdvancedChartConfig.endDate}
                  disabled={!effectiveAdvancedChartConfig.dateColumn}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, endDate: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500 disabled:opacity-40"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Chart Type</span>
                <select
                  value={effectiveAdvancedChartConfig.chartType}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, chartType: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                  <option value="scatter">Scatter</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">X Column</span>
                <select
                  value={effectiveAdvancedChartConfig.xColumn}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, xColumn: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  {advancedChartOptions.dimensionHeaders.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Y Column</span>
                <select
                  value={effectiveAdvancedChartConfig.yColumn}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, yColumn: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  {advancedChartOptions.numericHeaders.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Aggregation</span>
                <select
                  value={effectiveAdvancedChartConfig.aggregation}
                  onChange={(e) => setAdvancedChartConfig((current) => ({ ...current, aggregation: e.target.value }))}
                  className="h-10 w-full rounded-md border border-[#27272a] bg-[#0f0f11] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                >
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-[#27272a] bg-[#0f0f11] p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {advancedChartPanel.title}
                </h4>
                <span className="text-[10px] text-zinc-500">
                  {advancedChartPanel.data.length} plotted points
                </span>
              </div>
              <div className="h-72 w-full">
                {renderChart(advancedChartPanel)}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-indigo-500/20 p-8 text-center text-xs leading-5 text-zinc-500">
            Upload CSV data with at least one numeric column to unlock advanced date-filtered charting.
          </div>
        )}
      </div>

      {/* Operating Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {chartPanels.map((panel) => (
          <div key={panel.title} className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-6">
            <h3 className="mb-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">{panel.title}</h3>
            <div className="h-56 w-full sm:h-64">
              {renderChart(panel)}
            </div>
          </div>
        ))}
      </div>

      {!isExecutiveDashboard && (
        <div className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">Strategic Operational Data Ingestion</h3>
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragActive ? 'border-indigo-500 bg-[#18181b]' : 'border-[#27272a] hover:bg-[#141416]'
            }`}
          >
            <span className="text-2xl mb-2">📁</span>
            <p className="text-center text-xs text-zinc-300 font-medium">Drag & Drop data template or browse file system</p>
            <p className="text-[10px] text-zinc-500 mt-1">Accepts strictly structured operational .CSV datasets</p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => handleFileUpload(e.target.files[0])}
              className="mt-4 w-full max-w-xs text-xs text-zinc-400 file:mr-4 file:rounded file:border file:border-[#27272a] file:bg-[#18181b] file:px-3 file:py-1 file:text-xs file:text-zinc-200 file:hover:bg-[#27272a] cursor-pointer" 
              disabled={uploading}
            />
            {uploading && <p className="text-xs text-indigo-400 mt-2 animate-pulse">Parsing records into Supabase JSONB...</p>}
          </div>

          <div className="mt-4 rounded-lg border border-[#27272a] bg-[#0f0f11] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Historical Trend Import</h4>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                  Import multi-period CSVs to preserve an immutable trend history while refreshing the current dashboard snapshot.
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileUpload(e.target.files[0], "historical-trend-import")}
                className="w-full max-w-xs text-xs text-zinc-400 file:mr-4 file:rounded file:border file:border-emerald-500/30 file:bg-emerald-500/10 file:px-3 file:py-1 file:text-xs file:text-emerald-100 file:hover:bg-emerald-500/20 cursor-pointer sm:w-auto"
                disabled={uploading}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Historical Trend Imports</h3>
            <p className="mt-1 text-xs text-zinc-500">Immutable Supabase import ledger used for multi-period analysis and board reporting.</p>
          </div>
          <div className="text-xs text-zinc-400">{historicalImports.length} imports</div>
        </div>

        {historicalImports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-[#27272a] text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Department</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">File</th>
                  <th className="py-2 pr-4 font-medium">Rows</th>
                  <th className="py-2 pr-4 font-medium">Period</th>
                  <th className="py-2 font-medium">Imported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202024] text-zinc-300">
                {historicalImports.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4 font-medium text-zinc-100">{item.departmentName}</td>
                    <td className="py-3 pr-4 text-zinc-400">{item.importType}</td>
                    <td className="py-3 pr-4 text-zinc-400">{item.filename}</td>
                    <td className="py-3 pr-4">{item.recordCount}</td>
                    <td className="py-3 pr-4 text-zinc-400">
                      {[item.periodStart, item.periodEnd].filter(Boolean).join(" to ") || "Not detected"}
                    </td>
                    <td className="py-3 text-zinc-400">{formatDateTime(item.importedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#27272a] p-6 text-center text-xs text-zinc-500">
            No historical trend imports yet. Upload a multi-period CSV to build the import ledger.
          </div>
        )}
      </div>

      {/* LLM Executive Synthesis Output Display */}
      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-b from-[#13121c] to-[#121214] p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm">✨</span>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">TAI Chief Intelligence Synthesis</h3>
          </div>
          <button 
            onClick={() => fetchInsights(departmentId)} 
            className="inline-flex h-8 items-center justify-center rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 text-[11px] text-indigo-200 transition-colors hover:bg-indigo-500/15 hover:text-white sm:border-0 sm:bg-transparent sm:px-0 sm:text-zinc-400"
            disabled={loadingInsights}
          >
            {loadingInsights ? "Evaluating..." : isExecutiveDashboard ? "Fetch Org Suggestions" : "Fetch Suggestions"}
          </button>
        </div>
        {loadingInsights ? (
          <div className="space-y-2 py-2">
            <div className="h-3 w-3/4 rounded bg-[#27272a] animate-pulse"></div>
            <div className="h-3 w-1/2 rounded bg-[#27272a] animate-pulse"></div>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">{insights}</p>
        )}
      </div>

      {isExecutiveDashboard && (
        <div className="rounded-xl border border-[#27272a] bg-[#121214] p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Organization Data Store</h3>
              <p className="mt-1 text-xs text-zinc-500">JSON assembled from department CSV uploads stored in Supabase.</p>
            </div>
            <div className="text-xs text-zinc-400">
              Latest: {loadingCurrentData ? "Loading..." : latestUpload ? formatDateTime(latestUpload.uploadedAt) : "No uploads yet"}
            </div>
          </div>

          {loadingCurrentData ? (
            <div className="rounded-lg border border-dashed border-[#27272a] p-6 text-center text-xs text-zinc-500">
              Loading Supabase JSONB...
            </div>
          ) : storedDepartmentRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="border-b border-[#27272a] text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Department</th>
                    <th className="py-2 pr-4 font-medium">File</th>
                    <th className="py-2 pr-4 font-medium">Rows</th>
                    <th className="py-2 pr-4 font-medium">Columns</th>
                    <th className="py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202024] text-zinc-300">
                  {storedDepartmentRows.map((item) => (
                    <tr key={item.departmentId}>
                      <td className="py-3 pr-4 font-medium text-zinc-100">{item.departmentName}</td>
                      <td className="py-3 pr-4 text-zinc-400">{item.filename}</td>
                      <td className="py-3 pr-4">{item.recordCount}</td>
                      <td className="py-3 pr-4">{item.headers.length}</td>
                      <td className="py-3 text-zinc-400">{formatDateTime(item.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#27272a] p-6 text-center text-xs text-zinc-500">
              Upload CSVs in department workspaces to build the executive organization summary.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
