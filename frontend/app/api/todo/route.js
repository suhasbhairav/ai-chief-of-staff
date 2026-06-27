import { NextResponse } from "next/server";
import { readTodoList, writeTodoList } from "@/lib/current-data-store";
import { readActiveSlackInstallation, slackApi } from "@/lib/slack/server";
import {
  extractJsonObject,
  guardedResponsesCreate,
  wrapUntrustedData,
} from "@/lib/openai/guardrails";
import OpenAI from "openai";

export async function GET() {
  try {
    const todoStore = await readTodoList();
    const installation = await readActiveSlackInstallation();
    const integrations = {
      slack: {
        connected: Boolean(installation),
        name: "Slack",
        icon: "💬",
        team_name: installation?.team_name,
        team_id: installation?.team_id,
      },
    };
    return NextResponse.json({ ...todoStore, integrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve To-Do list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const { action } = payload;
    const todoStore = await readTodoList();

    if (action === "resolve") {
      const { taskId } = payload;
      todoStore.todos = todoStore.todos.map((task) => 
        task.id === taskId ? { ...task, status: "Done" } : task
      );
      const updated = await writeTodoList(todoStore);
      return NextResponse.json(updated);
    }

    if (action === "delegate") {
      const { taskId, delegateTo } = payload;
      todoStore.todos = todoStore.todos.map((task) => 
        task.id === taskId ? { ...task, status: `Delegated to ${delegateTo}` } : task
      );
      const updated = await writeTodoList(todoStore);
      return NextResponse.json(updated);
    }

    if (action === "sync") {
      const installation = await readActiveSlackInstallation();
      const botToken = installation?.bot_access_token;
      let addedCount = 0;

      if (botToken) {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (apiKey) {
          const client = new OpenAI({ apiKey });
          const channelData = await slackApi("conversations.list", botToken, {
            types: "public_channel,private_channel",
            exclude_archived: true,
            limit: 50,
          }, {
            httpMethod: "GET",
          });
          const channels = channelData.channels || [];
          
          let textSnippets = [];
          for (const chan of channels) {
            if (!chan.is_member && chan.is_channel) continue;

            const historyData = await slackApi("conversations.history", botToken, {
              channel: chan.id,
              limit: 20,
            }, {
              httpMethod: "GET",
            });
            const userMessages = (historyData.messages || [])
              .filter(m => !m.bot_id && m.subtype !== "bot_message" && m.text)
              .slice(0, 10);
            
            userMessages.forEach(msg => {
              textSnippets.push(`[Channel: #${chan.name}] User: ${msg.text}`);
            });
          }

          if (textSnippets.length > 0) {
            try {
              // Ask OpenAI to parse commitments from logs
              const analysisPrompt = `Review these untrusted company Slack message logs. Extract only concrete task commitments, bug reports, and critical action items that require attention.
Return JSON strictly matching this schema:
{
  "tasks": [
    {
      "title": "Short descriptive summary of task",
      "priority": "P0|P1|P2|P3",
      "owner": "Name of task owner or CEO",
      "description": "Evidence from the Slack message"
    }
  ]
}
Return JSON only.`;

              const completion = await guardedResponsesCreate(client, {
                model: "gpt-5.5",
                instructions: analysisPrompt,
                input: wrapUntrustedData("slack-sync-message-log", textSnippets.join("\n"), 40000)
              });

              const parsed = extractJsonObject(completion.output_text || "{}");
              const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : (Array.isArray(parsed) ? parsed : []);

              tasks.forEach((t) => {
                // Deduplicate by title similarity
                const isDuplicate = todoStore.todos.some((existing) => 
                  existing.title.toLowerCase().includes(t.title.toLowerCase()) || 
                  t.title.toLowerCase().includes(existing.title.toLowerCase())
                );

                if (!isDuplicate) {
                  todoStore.todos.push({
                    id: `task-${todoStore.todos.length + 1}`,
                    title: t.title,
                    priority: t.priority || "P2",
                    source: "Slack",
                    status: t.owner?.toLowerCase() === "richard" ? "Needs you" : `Delegated to ${t.owner || "Monica"}`,
                    owner: t.owner || "Someone",
                    description: t.description || "Harvested during sync",
                    dueDate: "Today"
                  });
                  addedCount += 1;
                }
              });
            } catch (err) {
              console.error("OpenAI sync extraction crashed:", err);
            }
          }
        }
      }

      const updated = await writeTodoList(todoStore);
      return NextResponse.json({ ...updated, addedCount });
    }

    if (action === "update") {
      const { todos, waitingOn } = payload;
      if (todos) todoStore.todos = todos;
      if (waitingOn) todoStore.waitingOn = waitingOn;
      const updated = await writeTodoList(todoStore);
      return NextResponse.json(updated);
    }

    // Default: overwrite entire store
    const updated = await writeTodoList(payload);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to modify To-Do list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
