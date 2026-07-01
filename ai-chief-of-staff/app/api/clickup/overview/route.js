import { NextResponse } from "next/server";
import { readClickUpWorkspace, writeClickUpWorkspace } from "@/lib/current-data-store";
import {
  fetchClickUpGoals,
  fetchClickUpTasks,
  fetchClickUpViews,
  fetchClickUpWorkspaces,
  getClickUpConfig,
  normalizeClickUpGoals,
  normalizeClickUpTasks,
  normalizeClickUpViews,
  summarizeClickUpWorkspace,
} from "@/lib/clickup/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readClickUpWorkspace(), getClickUpConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.token),
      fromEnv: config.fromEnv,
      workspaceId: config.workspaceId || config.integration?.workspace_id || store.workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read ClickUp overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getClickUpConfig();
    if (!config.token) {
      return NextResponse.json(
        {
          error:
            "ClickUp is not configured. Add CLICKUP_API_TOKEN in Vercel, connect OAuth, or paste a token in Integrations.",
        },
        { status: 400 }
      );
    }

    const workspaces = await fetchClickUpWorkspaces(config.token);
    const workspace =
      workspaces.find((team) => String(team.id) === String(config.workspaceId)) ||
      workspaces[0];

    if (!workspace?.id) {
      throw new Error("No authorized ClickUp workspace was found for this token.");
    }

    const workspaceId = String(workspace.id);
    const [rawGoals, rawTasks, rawViews] = await Promise.all([
      fetchClickUpGoals({ token: config.token, workspaceId }),
      fetchClickUpTasks({ token: config.token, workspaceId }),
      fetchClickUpViews({ token: config.token, workspaceId }),
    ]);
    const goals = normalizeClickUpGoals(rawGoals);
    const tasks = normalizeClickUpTasks(rawTasks);
    const views = normalizeClickUpViews(rawViews);
    const roadmaps = tasks.filter((task) => task.isRoadmap);
    const summary = summarizeClickUpWorkspace({ goals, tasks, roadmaps });
    const store = await writeClickUpWorkspace({
      workspaceId,
      workspaceName: workspace.name,
      goals,
      tasks,
      roadmaps,
      views,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync ClickUp overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
