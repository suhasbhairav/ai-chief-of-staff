import { readIntegrations } from "@/lib/current-data-store";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

const clean = (value) => String(value || "").trim();

const daysBetween = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const countBy = (items, getKey) => {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || "Unassigned";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const parseRepoList = (repos, defaultOwner) =>
  clean(repos)
    .split(",")
    .map((repo) => repo.trim())
    .filter(Boolean)
    .map((repo) => {
      const [owner, name] = repo.includes("/") ? repo.split("/") : [defaultOwner, repo];
      return { owner: clean(owner), name: clean(name) };
    })
    .filter((repo) => repo.name);

export const getGitHubConfig = async () => {
  const integrations = await readIntegrations();
  const github = integrations.github || {};
  const token = clean(process.env.GITHUB_TOKEN) || github.access_token;
  const owner = clean(process.env.GITHUB_OWNER) || clean(github.owner);
  const repos = clean(process.env.GITHUB_REPOS) || clean(github.repos);

  return {
    token,
    owner,
    repos,
    fromEnv: Boolean(process.env.GITHUB_TOKEN),
    integration: github,
  };
};

const githubApi = async ({ token, path, params }) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `GitHub API ${path} failed with ${response.status}`);
  }

  return data;
};

export const validateGitHubToken = async (token) => {
  const user = await githubApi({ token, path: "/user" });
  return {
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
  };
};

const fetchOwnerRepositories = async ({ token, owner }) => {
  try {
    return await githubApi({
      token,
      path: `/orgs/${owner}/repos`,
      params: { per_page: 100, sort: "updated", direction: "desc" },
    });
  } catch (error) {
    if (!String(error.message || "").includes("Not Found")) throw error;
    return githubApi({
      token,
      path: `/users/${owner}/repos`,
      params: { per_page: 100, sort: "updated", direction: "desc" },
    });
  }
};

export const fetchGitHubRepositories = async ({ token, owner, repos }) => {
  const repoList = parseRepoList(repos, owner);
  if (repoList.length) {
    return Promise.all(
      repoList.map((repo) =>
        githubApi({
          token,
          path: `/repos/${repo.owner || owner}/${repo.name}`,
        })
      )
    );
  }

  if (owner) {
    return fetchOwnerRepositories({ token, owner });
  }

  return githubApi({
    token,
    path: "/user/repos",
    params: {
      per_page: 100,
      sort: "updated",
      direction: "desc",
      affiliation: "owner,collaborator,organization_member",
    },
  });
};

export const normalizeGitHubRepositories = (repositories) =>
  repositories.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login,
    private: Boolean(repo.private),
    archived: Boolean(repo.archived),
    htmlUrl: repo.html_url,
    language: repo.language || "Unknown",
    stargazersCount: repo.stargazers_count || 0,
    forksCount: repo.forks_count || 0,
    openIssuesCount: repo.open_issues_count || 0,
    defaultBranch: repo.default_branch,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
  }));

export const fetchGitHubPullRequests = async ({ token, repositories }) => {
  const batches = await Promise.all(
    repositories.map((repo) =>
      githubApi({
        token,
        path: `/repos/${repo.owner}/${repo.name}/pulls`,
        params: { state: "all", per_page: 50, sort: "updated", direction: "desc" },
      }).then((items) => items.map((item) => ({ ...item, repo: repo.fullName })))
    )
  );
  return batches.flat();
};

export const fetchGitHubIssues = async ({ token, repositories }) => {
  const batches = await Promise.all(
    repositories.map((repo) =>
      githubApi({
        token,
        path: `/repos/${repo.owner}/${repo.name}/issues`,
        params: { state: "all", per_page: 50, sort: "updated", direction: "desc" },
      }).then((items) =>
        items
          .filter((item) => !item.pull_request)
          .map((item) => ({ ...item, repo: repo.fullName }))
      )
    )
  );
  return batches.flat();
};

export const normalizeGitHubPullRequests = (pullRequests) =>
  pullRequests.map((pr) => {
    const isMerged = Boolean(pr.merged_at);
    const isOpen = pr.state === "open";
    const updatedDaysAgo = daysBetween(pr.updated_at);
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title || "Untitled pull request",
      repo: pr.repo,
      author: pr.user?.login || "Unknown",
      state: pr.state,
      draft: Boolean(pr.draft),
      merged: isMerged,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      htmlUrl: pr.html_url,
      comments: pr.comments || 0,
      reviewComments: pr.review_comments || 0,
      labels: (pr.labels || []).map((label) => label.name),
      isOpen,
      isMerged,
      isStale: isOpen && (updatedDaysAgo ?? 0) >= 7,
      ageDays: daysBetween(pr.created_at) || 0,
      updatedDaysAgo,
    };
  });

export const normalizeGitHubIssues = (issues) =>
  issues.map((issue) => {
    const labels = (issue.labels || []).map((label) => label.name || label);
    const lowerLabels = labels.map((label) => String(label).toLowerCase());
    const isOpen = issue.state === "open";
    const updatedDaysAgo = daysBetween(issue.updated_at);
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title || "Untitled issue",
      repo: issue.repo,
      author: issue.user?.login || "Unknown",
      state: issue.state,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      closedAt: issue.closed_at,
      htmlUrl: issue.html_url,
      labels,
      assignees: (issue.assignees || []).map((assignee) => assignee.login),
      milestone: issue.milestone?.title || null,
      comments: issue.comments || 0,
      isBug: lowerLabels.some((label) =>
        /bug|defect|regression|broken|incident|sev|p0|p1/.test(label)
      ),
      isOpen,
      isStale: isOpen && (updatedDaysAgo ?? 0) >= 14,
      ageDays: daysBetween(issue.created_at) || 0,
      updatedDaysAgo,
    };
  });

export const summarizeGitHubWorkspace = ({ repositories, pullRequests, issues }) => {
  const openPrs = pullRequests.filter((pr) => pr.isOpen);
  const mergedPrs = pullRequests.filter((pr) => pr.isMerged);
  const openIssues = issues.filter((issue) => issue.isOpen);
  const openBugs = openIssues.filter((issue) => issue.isBug);
  const closedSince = daysAgo(30);
  const closedIssuesLast30Days = issues.filter((issue) => {
    if (!issue.closedAt) return false;
    const closedAt = new Date(issue.closedAt);
    return !Number.isNaN(closedAt.getTime()) && closedAt >= closedSince;
  }).length;

  const riskPrs = openPrs
    .filter((pr) => pr.isStale || pr.draft || pr.ageDays >= 10)
    .map((pr) => ({ ...pr, riskType: pr.isStale ? "Stale PR" : pr.draft ? "Draft PR" : "Aging PR" }));
  const riskIssues = openIssues
    .filter((issue) => issue.isBug || issue.isStale || issue.ageDays >= 21)
    .map((issue) => ({ ...issue, riskType: issue.isBug ? "Open bug" : issue.isStale ? "Stale issue" : "Aging issue" }));

  return {
    totalRepositories: repositories.length,
    openPullRequests: openPrs.length,
    mergedPullRequests: mergedPrs.length,
    draftPullRequests: openPrs.filter((pr) => pr.draft).length,
    stalePullRequests: openPrs.filter((pr) => pr.isStale).length,
    openIssues: openIssues.length,
    openBugs: openBugs.length,
    staleIssues: openIssues.filter((issue) => issue.isStale).length,
    closedIssuesLast30Days,
    prsByRepo: countBy(openPrs, (pr) => pr.repo),
    issuesByRepo: countBy(openIssues, (issue) => issue.repo),
    bugsByRepo: countBy(openBugs, (issue) => issue.repo),
    languageBreakdown: countBy(repositories, (repo) => repo.language),
    topRisks: [...riskIssues, ...riskPrs]
      .sort((a, b) => {
        const bugDelta = Number(b.isBug || false) - Number(a.isBug || false);
        if (bugDelta) return bugDelta;
        return (b.ageDays || 0) - (a.ageDays || 0);
      })
      .slice(0, 15),
  };
};
