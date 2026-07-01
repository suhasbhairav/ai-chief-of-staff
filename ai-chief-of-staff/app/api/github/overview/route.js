import { NextResponse } from "next/server";
import { readGitHubWorkspace, writeGitHubWorkspace } from "@/lib/current-data-store";
import {
  fetchGitHubIssues,
  fetchGitHubPullRequests,
  fetchGitHubRepositories,
  getGitHubConfig,
  normalizeGitHubIssues,
  normalizeGitHubPullRequests,
  normalizeGitHubRepositories,
  summarizeGitHubWorkspace,
} from "@/lib/github/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readGitHubWorkspace(), getGitHubConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.token),
      fromEnv: config.fromEnv,
      owner: config.owner || store.owner,
      repos: config.repos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read GitHub overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getGitHubConfig();
    if (!config.token) {
      return NextResponse.json(
        {
          error:
            "GitHub is not configured. Add GITHUB_TOKEN in Vercel or connect GitHub from Integrations.",
        },
        { status: 400 }
      );
    }

    const rawRepositories = await fetchGitHubRepositories({
      token: config.token,
      owner: config.owner,
      repos: config.repos,
    });
    const repositories = normalizeGitHubRepositories(rawRepositories).filter(
      (repo) => repo.owner && repo.name
    );

    const [rawPullRequests, rawIssues] = await Promise.all([
      fetchGitHubPullRequests({ token: config.token, repositories }),
      fetchGitHubIssues({ token: config.token, repositories }),
    ]);
    const pullRequests = normalizeGitHubPullRequests(rawPullRequests);
    const issues = normalizeGitHubIssues(rawIssues);
    const summary = summarizeGitHubWorkspace({ repositories, pullRequests, issues });

    const store = await writeGitHubWorkspace({
      owner: config.owner || repositories[0]?.owner || null,
      repositories,
      pullRequests,
      issues,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      repos: config.repos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync GitHub overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
