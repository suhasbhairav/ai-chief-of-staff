import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { readOrganizationSummary } from '@/lib/current-data-store';
import {
  guardedResponsesCreate,
  toGuardrailResponse,
  wrapUntrustedData,
} from '@/lib/openai/guardrails';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'] || 'missing-openai-api-key',
});

const departmentIdentities = {
  executive: "Analyze corporate targets, evaluate high-level execution bottlenecks, and identify variance gaps across board directives.",
  finance: "Assess run-rates, optimize localized burn parameters, and suggest capital-efficiency adjustments based on cash positions.",
  hr: "Evaluate talent acquisition bottlenecks, evaluate retention drops, and check performance distribution scores.",
  legal: "Identify compliance risk maps, contract expirations flags, and liability exposure mitigation steps.",
  it: "Synthesize platform architecture uptime patterns, cloud overhead budgets, and system vulnerability points.",
  operations: "Identify fulfillment latency factors, resource throughput variances, and supply chain constraints.",
  sales: "Evaluate deal win ratios, track localized quota attainment targets, and predict ARR acceleration paths.",
  marketing: "Review CAC anomalies, tracking conversion efficiencies, and optimize campaign spending distribution.",
  product: "Formulate strategic velocity improvements, feature adoption rates, and evaluate technical debt impact metrics.",
  rd: "Analyze research resource expenditures, patent pipeline progression speeds, and core experimentation milestones.",
  "customer-service": "Examine first-response SLA variances, ticket volume triggers, and agent utilization indices.",
  risk: "Provide risk index auditing summaries, security control compliance scores, and mitigation roadmaps.",
  strategy: "Provide M&A market expansion forecasts, industry ecosystem partnerships tracking, and competitive posture evaluations."
};

const buildAnalyticsInput = (department, targetFocus, context = {}) => {
  if (department === "executive") {
    return `Perform a comprehensive CEO-level operating review using the dashboard summary first and the uploaded department JSON as supporting evidence.

Core Focus: ${targetFocus}

Executive dashboard summary:
${wrapUntrustedData("executive-dashboard-summary", context.dashboardSummary || {})}

Organization Supabase JSONB snapshot:
${wrapUntrustedData("organization-supabase-jsonb", context.organizationData || {})}

Return 5 concise bullets for the CEO. Cover value creation, cash/runway, GTM efficiency, customer/product health, risk posture, and the specific owner or department for each recommended action.`;
  }

  return `Perform a comprehensive operational review for the [${department.toUpperCase()}] Department.

Core Focus: ${targetFocus}

Department Supabase JSONB snapshot:
${wrapUntrustedData(`${department}-department-supabase-jsonb`, context.departmentData || {})}

Give me 3 concrete bullet points of tactical recommendations.`;
};

const hydrateAnalyticsContext = async (department, context = {}) => {
  if (context.departmentData || context.organizationData) {
    return context;
  }

  const organizationSummary = await readOrganizationSummary();

  if (department === "executive") {
    return {
      ...context,
      organizationData: organizationSummary.departments,
      dashboardSummary: context.dashboardSummary || {
        totalDepartments: organizationSummary.totalDepartments,
        totalRecords: organizationSummary.totalRecords,
        departmentSummaries: organizationSummary.departmentSummaries,
      },
    };
  }

  return {
    ...context,
    departmentData: organizationSummary.departments?.[department] || null,
  };
};

const createAnalysis = async (department, context = {}) => {
  const openAiApiKey = process.env['OPENAI_API_KEY']?.trim();

  if (!departmentIdentities[department]) {
    return NextResponse.json(
      { error: `Unknown department: ${department}` },
      { status: 400 }
    );
  }

  const targetFocus = departmentIdentities[department];
  const hydratedContext = await hydrateAnalyticsContext(department, context);

  if (!openAiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is missing. Add it to frontend/.env and restart the Next.js dev server." },
      { status: 500 }
    );
  }

  const response = await guardedResponsesCreate(client, {
    model: 'gpt-5.5',
    instructions: 'You are TAI Chief, an elite enterprise operating intelligence assistant. You speak directly to the CEO. Provide extremely concise, analytical, action-oriented executive assessments. Never use corporate filler words or fluff. Focus on metrics, risk management, and strategic priority execution.',
    input: buildAnalyticsInput(department, targetFocus, hydratedContext),
  });

  return NextResponse.json({ analysis: response.output_text });
};

const handleAnalyticsError = (error) => {
  const guardrailResponse = toGuardrailResponse(error);
  if (guardrailResponse) {
    return NextResponse.json(guardrailResponse.body, { status: guardrailResponse.status });
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = error instanceof Error ? error.message : "Failed tracking analytical computations";

  console.error("OpenAI analytics route failed:", message);

  return NextResponse.json(
    { error: message },
    { status }
  );
};

export async function GET(_request, { params }) {
  try {
    const { department } = await params;
    return await createAnalysis(department);
  } catch (error) {
    return handleAnalyticsError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { department } = await params;
    const context = await request.json();
    return await createAnalysis(department, context);
  } catch (error) {
    return handleAnalyticsError(error);
  }
}
