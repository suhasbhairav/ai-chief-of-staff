import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readTodoList, writeTodoList, readOrganizationSummary } from "@/lib/current-data-store";
import {
  getSlackCredentials,
  readActiveSlackInstallation,
  recordSlackEvent,
  slackApi,
  verifySlackSignature,
} from "@/lib/slack/server";
import {
  assertSafeDirectUserInput,
  extractJsonObject,
  guardedResponsesCreate,
  wrapUntrustedData,
} from "@/lib/openai/guardrails";

// Helper to send a message back to Slack channel/IM
const sendSlackMessage = async (token, channel, text) => {
  try {
    await slackApi("chat.postMessage", token, { channel, text });
  } catch (e) {
    console.error("Slack postMessage request crashed:", e);
  }
};

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const headers = request.headers;
    const { signingSecret } = getSlackCredentials();

    if (!signingSecret) {
      return new Response("SLACK_SIGNING_SECRET is not configured", { status: 500 });
    }

    const verified = verifySlackSignature(rawBody, headers, signingSecret);
    if (!verified) {
      console.warn("Slack signature verification failed");
      return new Response("Unauthorized signature", { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // 1. Handle URL Verification Challenge (Slack Setup Handshake)
    if (payload.type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // 2. Process Events
    if (payload.type === "event_callback") {
      const event = payload.event;
      await recordSlackEvent(payload);

      // Ignore messages from bots to prevent infinite loop recursion
      if (event.bot_id || event.subtype === "bot_message") {
        return new Response("Ignored bot message", { status: 200 });
      }

      const installation = await readActiveSlackInstallation();
      const botToken = installation?.bot_access_token;

      if (!botToken) {
        console.warn("Slack bot token not found in integrations configuration");
        return new Response("Slack integration not configured", { status: 200 });
      }

      // Initialize OpenAI client
      const apiKey = process.env.OPENAI_API_KEY?.trim() || "missing-openai-api-key";
      const client = new OpenAI({ apiKey });

      // A. DIRECT MESSAGE EVENT (Interaction Command Center)
      if (
        event.type === "message" &&
        (event.channel_type === "im" || event.channel_type === "app_home") &&
        event.text
      ) {
        const orgSummary = await readOrganizationSummary();
        const todoStore = await readTodoList();

        const metricsContext = Object.values(orgSummary.departments || {}).map((dept) => {
          const sample = dept.sampleRecords && dept.sampleRecords[0] ? JSON.stringify(dept.sampleRecords[0]) : "No metrics";
          return `- ${dept.departmentName}: ${dept.recordCount} records. Metrics overview: ${wrapUntrustedData("department-sample-record", sample, 4000)}`;
        }).join("\n");

        const todosContext = todoStore.todos.map((t) => 
          `- [${t.id}] ${wrapUntrustedData("task-title", t.title, 500)} (Priority: ${t.priority}, Source: ${t.source}, Status: ${t.status})`
        ).join("\n");

        const waitingContext = todoStore.waitingOn.map((w) => 
          `- ${wrapUntrustedData("waiting-owner", w.owner, 200)}: ${wrapUntrustedData("waiting-title", w.title, 500)} (${w.status})`
        ).join("\n");

        const systemPrompt = `You are Aegis, an elite enterprise AI Chief of Staff. You speak directly to the CEO, Richard. 
Respond to Richard's message inside Slack. Keep replies extremely concise, metric-focused, and action-oriented. Never use fluff or filler.

Current metrics context:
${metricsContext}

Current Master To-Do list:
${todosContext}

Waiting on others:
${waitingContext}

If Richard requests to resolve, complete, add, or delegate tasks:
Append this formatting at the end of your response text so the system executes it:
[[ACTION: {"type": "resolve", "taskId": "task-id"}]]
[[ACTION: {"type": "delegate", "taskId": "task-id", "to": "person-name"}]]
[[ACTION: {"type": "add", "task": {"title": "Task description", "priority": "P1", "source": "Slack", "status": "Needs you", "dueDate": "Today"}}]]`;

        let agentReply = "";
        let actionTriggered = [];

        if (apiKey === "missing-openai-api-key") {
          agentReply = "OpenAI API key is missing. Add `OPENAI_API_KEY` to your deployment environment to activate Aegis.";
        } else {
          try {
            const safeSlackDm = assertSafeDirectUserInput(event.text, "Slack direct message");
            const resObj = await guardedResponsesCreate(client, {
              model: 'gpt-5.5',
              instructions: systemPrompt,
              input: `Richard: ${safeSlackDm}`
            });
            agentReply = resObj.output_text || "";

            // Parse actions from reply
            const actionRegex = /\[\[ACTION:\s*({.*?})\s*\]\]/g;
            let match;
            let modified = false;

            while ((match = actionRegex.exec(agentReply)) !== null) {
              try {
                const actionData = JSON.parse(match[1]);
                actionTriggered.push(actionData);

                if (actionData.type === "resolve") {
                  todoStore.todos = todoStore.todos.map((t) => 
                    t.id === actionData.taskId ? { ...t, status: "Done" } : t
                  );
                  modified = true;
                } else if (actionData.type === "delegate") {
                  todoStore.todos = todoStore.todos.map((t) => 
                    t.id === actionData.taskId ? { ...t, status: `Delegated to ${actionData.to}` } : t
                  );
                  modified = true;
                } else if (actionData.type === "add") {
                  todoStore.todos.push({
                    id: `task-${todoStore.todos.length + 1}`,
                    title: actionData.task.title,
                    priority: actionData.task.priority || "P2",
                    source: "Slack",
                    status: "Needs you",
                    owner: "Aegis",
                    description: actionData.task.description || "",
                    dueDate: "Today"
                  });
                  modified = true;
                }
              } catch (parseErr) {
                console.error("Action parsing error:", parseErr);
              }
            }

            if (modified) {
              await writeTodoList(todoStore);
            }

            // Clean action tags out of user Slack message
            agentReply = agentReply.replace(/\[\[ACTION:\s*({.*?})\s*\]\]/g, "").trim();

          } catch (openaiErr) {
            console.error("OpenAI DM reply handler crashed:", openaiErr);
            agentReply = `Sorry Richard, I ran into an error reviewing that: ${openaiErr.message}`;
          }
        }

        // Post response back to Slack Direct Message channel
        await sendSlackMessage(botToken, event.channel, agentReply);
      }

      // B. CHANNEL MESSAGE EVENT (Commitment Harvester)
      else if (
        ((event.type === "message" && event.channel_type !== "im") ||
          event.type === "app_mention") &&
        event.text
      ) {
        // Run classifier to see if task commitment/alert exists
        if (apiKey !== "missing-openai-api-key") {
          try {
            const classifierPrompt = `Read the following untrusted Slack channel message. Determine if the sender is making a concrete commitment, stating a task, or flagging an issue that requires the CEO to act upon.
Examples of positive matches:
- "Richard, I need that licensing agreement signed by EOD..."
- "hey @richard the compression algo is leaking memory."
- "Approval needed on equipment request before standup."

Return JSON strictly matching this schema:
{
  "isCommitment": boolean,
  "taskTitle": "Short summary of the task (e.g. Sign licensing agreement with Gavin Belson)",
  "priority": "P0" (critical/blocker) | "P1" (high) | "P2" (medium) | "P3" (low),
  "assignee": "Name of task owner (e.g., Gavin Belson, Dinesh, Gilfoyle, Richard)"
}`;

            const completion = await guardedResponsesCreate(client, {
              model: "gpt-5.5",
              instructions: classifierPrompt,
              input: wrapUntrustedData("slack-channel-message", event.text, 5000)
            });

            const result = extractJsonObject(completion.output_text || "{}");

            if (result.isCommitment) {
              // Add task to Master To-Do
              const todoStore = await readTodoList();
              const newTaskId = `task-${todoStore.todos.length + 1}`;
              
              todoStore.todos.push({
                id: newTaskId,
                title: result.taskTitle,
                priority: result.priority || "P2",
                source: "Slack",
                status: result.assignee?.toLowerCase() === "richard" ? "Needs you" : `Delegated to ${result.assignee || "Monica"}`,
                owner: result.assignee || "Someone",
                description: `Harvested from Slack channel message: "${event.text}"`,
                dueDate: "Today"
              });

              await writeTodoList(todoStore);

              // Notify the channel that Aegis has harvested the task
              const notifyText = `⚡ *Aegis AI Task Harvester* has logged a *${result.priority || "P2"}* task to Richard's Master To-Do: 
> *${result.taskTitle}* (Owner: ${result.assignee || "Richard"})`;
              
              await sendSlackMessage(botToken, event.channel, notifyText);
            }
          } catch (harvesterErr) {
            console.error("Slack task harvesting agent failed:", harvesterErr);
          }
        }
      }
    }

    return new Response("Success", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Events Webhook processing failed.";
    console.error("Slack Events Webhook crashed:", message);
    return new Response(message, { status: 500 });
  }
}
