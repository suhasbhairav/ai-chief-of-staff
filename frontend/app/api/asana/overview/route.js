import { NextResponse } from "next/server";
import { readAsanaWorkspace, writeAsanaWorkspace } from "@/lib/current-data-store";
import {
  fetchAsanaProjects,
  fetchAsanaTasks,
  fetchAsanaWorkspaces,
  getAsanaConfig,
  normalizeAsanaProjects,
  normalizeAsanaTasks,
  summarizeAsanaWorkspace,
} from "@/lib/asana/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readAsanaWorkspace(), getAsanaConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.accessToken),
      fromEnv: config.fromEnv,
      workspaceGid: config.workspaceGid || store.workspaceGid,
      projectGids: config.projectGids,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Asana overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getAsanaConfig();
    if (!config.accessToken) {
      return NextResponse.json(
        {
          error:
            "Asana is not configured. Add ASANA_ACCESS_TOKEN in Vercel or connect Asana from Integrations.",
        },
        { status: 400 }
      );
    }

    const workspaces = await fetchAsanaWorkspaces({ accessToken: config.accessToken });
    const workspace =
      workspaces.find((item) => item.gid === config.workspaceGid) || workspaces[0];

    if (!workspace?.gid && !config.projectGids) {
      return NextResponse.json(
        { error: "No Asana workspace found for this token." },
        { status: 400 }
      );
    }

    const rawProjects = await fetchAsanaProjects({
      accessToken: config.accessToken,
      workspaceGid: config.workspaceGid || workspace?.gid,
      projectGids: config.projectGids,
    });
    const projects = normalizeAsanaProjects(rawProjects);
    const rawTasks = await fetchAsanaTasks({ accessToken: config.accessToken, projects });
    const tasks = normalizeAsanaTasks(rawTasks);
    const summary = summarizeAsanaWorkspace({ projects, tasks });

    const store = await writeAsanaWorkspace({
      workspaceGid: config.workspaceGid || workspace?.gid || null,
      workspaceName: workspace?.name || null,
      projects,
      tasks,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      projectGids: config.projectGids,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Asana overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
