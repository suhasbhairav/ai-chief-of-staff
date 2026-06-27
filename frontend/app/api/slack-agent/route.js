import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  readOrganizationSummary,
  readTodoList,
  writeTodoList,
} from "@/lib/current-data-store";
import {
  assertSafeDirectUserInput,
  guardedResponsesCreate,
  toGuardrailResponse,
  wrapUntrustedData,
} from "@/lib/openai/guardrails";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"] || "missing-openai-api-key",
});

const ACTION_BLOCK_REGEX = /\[\[ACTION:\s*([\s\S]*?)\s*\]\]/g;
const MAX_HISTORY_MESSAGES = 10;

const jsonError = (message, status = 400) =>
  NextResponse.json({ error: message }, { status });

const normalizeMessageHistory = (messagesHistory) =>
  Array.isArray(messagesHistory)
    ? messagesHistory
        .slice(-MAX_HISTORY_MESSAGES)
        .filter((message) => message?.text)
        .map((message) => ({
          sender: message.sender === "user" ? "User" : "Agent",
          text: wrapUntrustedData("conversation-history-message", String(message.text).slice(0, 2000), 2500),
        }))
    : [];

const buildMetricsContext = (orgSummary) => {
  const departments = Object.values(orgSummary.departments || {});

  if (!departments.length) {
    return "No department metrics have been uploaded yet.";
  }

  return departments
    .map((department) => {
      const sampleRecord = department.sampleRecords?.[0]
        ? JSON.stringify(department.sampleRecords[0])
        : "No sample record";

      return `- ${department.departmentName}: ${department.recordCount} records. Sample: ${wrapUntrustedData("department-sample-record", sampleRecord, 4000)}`;
    })
    .join("\n");
};

const buildTodoContext = (todoStore) => {
  const todos = Array.isArray(todoStore.todos) ? todoStore.todos : [];

  if (!todos.length) {
    return "No open to-do items.";
  }

  return todos
    .map(
      (task) =>
        `- [${task.id}] ${wrapUntrustedData("task-title", task.title, 500)} | Priority: ${task.priority} | Source: ${task.source} | Status: ${task.status} | Owner: ${wrapUntrustedData("task-owner", task.owner || "Unassigned", 200)}`
    )
    .join("\n");
};

const buildWaitingContext = (todoStore) => {
  const waitingOn = Array.isArray(todoStore.waitingOn)
    ? todoStore.waitingOn
    : [];

  if (!waitingOn.length) {
    return "No waiting-on items.";
  }

  return waitingOn
    .map((item) => `- ${wrapUntrustedData("waiting-owner", item.owner, 200)}: ${wrapUntrustedData("waiting-title", item.title, 500)} (${item.status})`)
    .join("\n");
};

const buildSystemPrompt = ({ metricsContext, todosContext, waitingContext }) => `
You are Aegis, an elite enterprise AI Chief of Staff operating inside the company's Slack workspace.
You speak directly to the CEO. Be concise, analytical, action-oriented, and metric-driven. Avoid filler.

Company operating metrics:
${metricsContext}

Master To-Do list:
${todosContext}

Waiting on others:
${waitingContext}

You may execute to-do actions only when the CEO clearly asks you to resolve, complete, finish, clear, delegate, or add a task.

To execute actions, append one or more action blocks at the end of your response:
[[ACTION: {"type": "resolve", "taskId": "task-id"}]]
[[ACTION: {"type": "delegate", "taskId": "task-id", "to": "person-name"}]]
[[ACTION: {"type": "add", "task": {"title": "Task description", "priority": "P1", "source": "Slack", "status": "Needs you", "owner": "Owner name", "description": "Optional context", "dueDate": "Today"}}]]

Rules:
- Do not invent task IDs. Use IDs from the Master To-Do list.
- If the request is ambiguous, ask one concise clarification question.
- Keep Slack formatting clean with *bold* and short bullets.
- Never expose action blocks in the visible prose; they are machine instructions only.
`;

const buildModelInput = ({ message, history }) => {
  const historyText = history
    .map((entry) => `${entry.sender}: ${entry.text}`)
    .join("\n");

  return `Recent conversation:
${historyText || "No prior messages."}

CEO message:
${message}`;
};

const extractActions = (responseText) => {
  const actions = [];
  let match;

  while ((match = ACTION_BLOCK_REGEX.exec(responseText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed?.type) {
        actions.push(parsed);
      }
    } catch (error) {
      console.error("Ignored invalid Slack agent action block:", error);
    }
  }

  return actions;
};

const stripActionBlocks = (responseText) =>
  responseText.replace(ACTION_BLOCK_REGEX, "").trim();

const nextTaskId = (todos) => {
  const maxNumericId = todos.reduce((max, task) => {
    const match = String(task.id || "").match(/^task-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `task-${maxNumericId + 1}`;
};

const applyActionsToTodoStore = (todoStore, actions) => {
  let modified = false;
  const executedActions = [];
  const todos = Array.isArray(todoStore.todos) ? [...todoStore.todos] : [];

  actions.forEach((action) => {
    if (action.type === "resolve" && action.taskId) {
      const existing = todos.find((task) => task.id === action.taskId);
      if (!existing) return;

      existing.status = "Done";
      modified = true;
      executedActions.push(action);
      return;
    }

    if (action.type === "delegate" && action.taskId && action.to) {
      const existing = todos.find((task) => task.id === action.taskId);
      if (!existing) return;

      existing.status = `Delegated to ${action.to}`;
      existing.owner = action.to;
      modified = true;
      executedActions.push(action);
      return;
    }

    if (action.type === "add" && action.task?.title) {
      const newTask = {
        id: nextTaskId(todos),
        title: String(action.task.title).slice(0, 180),
        priority: action.task.priority || "P2",
        source: action.task.source || "Slack",
        status: action.task.status || "Needs you",
        owner: action.task.owner || "Aegis",
        description: action.task.description || "",
        dueDate: action.task.dueDate || "Today",
      };

      todos.push(newTask);
      modified = true;
      executedActions.push({ ...action, task: newTask });
    }
  });

  return {
    modified,
    executedActions,
    todoStore: {
      ...todoStore,
      todos,
    },
  };
};

export async function POST(request) {
  try {
    const openAiApiKey = process.env["OPENAI_API_KEY"]?.trim();

    if (!openAiApiKey) {
      return jsonError(
        "OPENAI_API_KEY is missing. Add it to frontend/.env.local or frontend/.env to activate the Slack AI Chief of Staff.",
        500
      );
    }

    const body = await request.json();
    const message = assertSafeDirectUserInput(body?.message, "Slack agent message");

    const history = normalizeMessageHistory(body.messagesHistory);
    const [orgSummary, todoStore] = await Promise.all([
      readOrganizationSummary(),
      readTodoList(),
    ]);

    const systemPrompt = buildSystemPrompt({
      metricsContext: buildMetricsContext(orgSummary),
      todosContext: buildTodoContext(todoStore),
      waitingContext: buildWaitingContext(todoStore),
    });

    const response = await guardedResponsesCreate(client, {
      model: "gpt-5.5",
      instructions: systemPrompt,
      input: buildModelInput({ message, history }),
    });

    const responseText = response.output_text || "";
    const requestedActions = extractActions(responseText);
    const cleanText =
      stripActionBlocks(responseText) ||
      "I reviewed the current context, but no response text was returned.";

    const actionResult = applyActionsToTodoStore(todoStore, requestedActions);

    if (actionResult.modified) {
      await writeTodoList(actionResult.todoStore);
    }

    return NextResponse.json({
      text: cleanText,
      actions: actionResult.executedActions,
      todoStore: actionResult.todoStore,
    });
  } catch (error) {
    const guardrailResponse = toGuardrailResponse(error);
    if (guardrailResponse) {
      return NextResponse.json(guardrailResponse.body, { status: guardrailResponse.status });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Slack agent failed to generate response.";
    console.error("Slack agent route failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
