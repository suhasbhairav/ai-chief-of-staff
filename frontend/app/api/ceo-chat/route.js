import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readOrganizationSummary } from "@/lib/current-data-store";
import {
  assertSafeDirectUserInput,
  extractJsonObject,
  guardedResponsesCreate,
  toGuardrailResponse,
  wrapUntrustedData,
} from "@/lib/openai/guardrails";
import { searchDepartmentEmbeddings } from "@/lib/openai/department-embeddings";
import { isSupabaseConfigured } from "@/lib/supabase/server";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"] || "missing-openai-api-key",
});

const DEPARTMENT_IDS = [
  "executive",
  "finance",
  "hr",
  "legal",
  "it",
  "operations",
  "sales",
  "marketing",
  "product",
  "rd",
  "customer-service",
  "risk",
  "strategy",
];

const buildPlannerPrompt = () => `You are the retrieval planner for an AI Chief of Staff.
Decide whether the CEO question requires searching department operating data in Supabase vector embeddings.

Return JSON only:
{
  "needsRetrieval": boolean,
  "departmentId": "all|executive|finance|hr|legal|it|operations|sales|marketing|product|rd|customer-service|risk|strategy",
  "reason": "short reason",
  "searchQuery": "best vector search query"
}

Use retrieval for questions about metrics, departments, risks, priorities, performance, recommendations, comparisons, trends, board memos, PDFs, Slack-derived tasks, or operating decisions.
Skip retrieval only for generic product/help questions that do not need company data.`;

const buildAnswerPrompt = ({ plan, organizationSummary, searchResults, retrievalError }) => `
You are an elite AI Chief of Staff for the CEO.
Answer like a concise operating partner: direct, specific, metric-aware, and action-oriented.

Planner decision:
${wrapUntrustedData("retrieval-plan", plan)}

Organization summary:
${wrapUntrustedData("organization-summary", {
  updatedAt: organizationSummary.updatedAt,
  totalDepartments: organizationSummary.totalDepartments,
  totalRecords: organizationSummary.totalRecords,
  departmentSummaries: organizationSummary.departmentSummaries,
})}

Vector search evidence:
${wrapUntrustedData("supabase-vector-results", searchResults)}

Retrieval status:
${wrapUntrustedData("retrieval-status", {
  supabaseConfigured: isSupabaseConfigured,
  retrievalError: retrievalError || null,
})}

Rules:
- Use vector evidence when available.
- If evidence is missing, say what data must be uploaded or embedded.
- Give the CEO 3-6 useful bullets unless the user asks otherwise.
- Include department ownership when recommending actions.
- Never claim a metric exists if it is not in the provided evidence.`;

const normalizeHistory = (messages) =>
  Array.isArray(messages)
    ? messages
        .slice(-8)
        .filter((message) => message?.content)
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content).slice(0, 2000),
        }))
    : [];

export async function POST(request) {
  try {
    const openAiApiKey = process.env["OPENAI_API_KEY"]?.trim();

    if (!openAiApiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing. Add it to your deployment environment." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const message = assertSafeDirectUserInput(body?.message, "CEO chat message");
    const preferredDepartment = DEPARTMENT_IDS.includes(body?.departmentId)
      ? body.departmentId
      : "all";
    const history = normalizeHistory(body?.messages);
    const historyText = history
      .map((entry) => `${entry.role}: ${entry.content}`)
      .join("\n");

    const plannerResponse = await guardedResponsesCreate(client, {
      model: "gpt-5.5",
      instructions: buildPlannerPrompt(),
      input: `Preferred department: ${preferredDepartment}
Conversation:
${wrapUntrustedData("chat-history", historyText || "No prior messages.")}

CEO question:
${message}`,
      maxInputChars: 20000,
    });

    let plan = extractJsonObject(plannerResponse.output_text || "{}");
    plan = {
      needsRetrieval: Boolean(plan.needsRetrieval),
      departmentId: plan.departmentId || preferredDepartment,
      reason: plan.reason || "Planner did not return a reason.",
      searchQuery: plan.searchQuery || message,
    };
    if (!DEPARTMENT_IDS.includes(plan.departmentId) && plan.departmentId !== "all") {
      plan.departmentId = preferredDepartment;
    }
    if (preferredDepartment !== "all" && plan.departmentId === "all") {
      plan.departmentId = preferredDepartment;
    }
    plan.searchQuery = plan.searchQuery || message;

    const organizationSummary = await readOrganizationSummary();
    let retrievalError = null;
    let searchResults = [];

    if (plan.needsRetrieval) {
      if (!isSupabaseConfigured) {
        retrievalError = "Supabase is not configured, so vector search was skipped.";
      } else {
        try {
          searchResults = await searchDepartmentEmbeddings({
            query: plan.searchQuery,
            departmentId: plan.departmentId,
            matchCount: 10,
          });
        } catch (error) {
          retrievalError =
            error instanceof Error
              ? error.message
              : "Supabase vector search failed.";
        }
      }
    }

    const answerResponse = await guardedResponsesCreate(client, {
      model: "gpt-5.5",
      instructions: buildAnswerPrompt({
        plan,
        organizationSummary,
        searchResults,
        retrievalError,
      }),
      input: `CEO question: ${message}`,
      maxInputChars: 80000,
    });

    return NextResponse.json({
      answer: answerResponse.output_text || "No answer returned.",
      plan,
      retrievalError,
      sources: searchResults.map((result) => ({
        departmentId: result.department_id,
        departmentName: result.department_name,
        similarity: result.similarity,
        sourceType: result.source_type,
        sourceId: result.source_id,
        snippet: result.content?.slice(0, 500),
      })),
    });
  } catch (error) {
    const guardrailResponse = toGuardrailResponse(error);
    if (guardrailResponse) {
      return NextResponse.json(guardrailResponse.body, {
        status: guardrailResponse.status,
      });
    }

    const message =
      error instanceof Error ? error.message : "CEO chat failed to respond.";
    console.error("CEO chat route failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
