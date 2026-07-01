import { NextResponse } from "next/server";
import { readJiraWorkspace, writeJiraWorkspace } from "@/lib/current-data-store";
import {
  fetchJiraIssues,
  fetchJiraProjects,
  getJiraConfig,
  normalizeJiraIssues,
  normalizeJiraProjects,
  summarizeJiraWorkspace,
} from "@/lib/atlassian/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readJiraWorkspace(), getJiraConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.authHeader && config.siteUrl),
      fromEnv: config.fromEnv,
      siteUrl: config.siteUrl || store.siteUrl,
      jql: config.jql,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Jira overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getJiraConfig();
    if (!config.siteUrl || !config.authHeader) {
      return NextResponse.json(
        {
          error:
            "Jira is not configured. Add ATLASSIAN_SITE_URL, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN in Vercel or connect Jira from Integrations.",
        },
        { status: 400 }
      );
    }

    const [rawProjects, rawIssues] = await Promise.all([
      fetchJiraProjects({ siteUrl: config.siteUrl, authHeader: config.authHeader }),
      fetchJiraIssues({ siteUrl: config.siteUrl, authHeader: config.authHeader, jql: config.jql }),
    ]);
    const projects = normalizeJiraProjects(rawProjects);
    const issues = normalizeJiraIssues(rawIssues, config.siteUrl);
    const summary = summarizeJiraWorkspace({ issues, projects });
    const store = await writeJiraWorkspace({
      siteUrl: config.siteUrl,
      issues,
      projects,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      jql: config.jql,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Jira overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
