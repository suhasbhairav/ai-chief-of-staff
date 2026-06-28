import { readIntegrations } from "@/lib/current-data-store";

const stripTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const daysBetween = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

const isBeforeToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const basicAuthHeader = ({ email, apiToken }) =>
  `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;

const getSharedAtlassianConfig = async () => {
  const integrations = await readIntegrations();
  const jira = integrations.jira || {};
  const confluence = integrations.confluence || {};

  return {
    integrations,
    siteUrl:
      stripTrailingSlash(process.env.ATLASSIAN_SITE_URL) ||
      stripTrailingSlash(process.env.JIRA_SITE_URL) ||
      stripTrailingSlash(process.env.CONFLUENCE_SITE_URL) ||
      stripTrailingSlash(jira.site_url) ||
      stripTrailingSlash(confluence.site_url),
    email:
      process.env.ATLASSIAN_EMAIL?.trim() ||
      process.env.JIRA_EMAIL?.trim() ||
      process.env.CONFLUENCE_EMAIL?.trim() ||
      jira.email ||
      confluence.email,
    apiToken:
      process.env.ATLASSIAN_API_TOKEN?.trim() ||
      process.env.JIRA_API_TOKEN?.trim() ||
      process.env.CONFLUENCE_API_TOKEN?.trim() ||
      jira.api_token ||
      confluence.api_token,
  };
};

export const getJiraConfig = async () => {
  const shared = await getSharedAtlassianConfig();
  const jira = shared.integrations.jira || {};
  const siteUrl = stripTrailingSlash(process.env.JIRA_SITE_URL) || shared.siteUrl;
  const email = process.env.JIRA_EMAIL?.trim() || shared.email;
  const apiToken = process.env.JIRA_API_TOKEN?.trim() || shared.apiToken;

  return {
    siteUrl,
    email,
    apiToken,
    authHeader: email && apiToken ? basicAuthHeader({ email, apiToken }) : null,
    jql: process.env.JIRA_JQL?.trim() || jira.jql || "order by updated DESC",
    fromEnv: Boolean(process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN),
    integration: jira,
  };
};

export const getConfluenceConfig = async () => {
  const shared = await getSharedAtlassianConfig();
  const confluence = shared.integrations.confluence || {};
  const siteUrl = stripTrailingSlash(process.env.CONFLUENCE_SITE_URL) || shared.siteUrl;
  const email = process.env.CONFLUENCE_EMAIL?.trim() || shared.email;
  const apiToken = process.env.CONFLUENCE_API_TOKEN?.trim() || shared.apiToken;

  return {
    siteUrl,
    email,
    apiToken,
    authHeader: email && apiToken ? basicAuthHeader({ email, apiToken }) : null,
    cql: process.env.CONFLUENCE_CQL?.trim() || confluence.cql || "type=page order by lastmodified desc",
    fromEnv: Boolean(process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN),
    integration: confluence,
  };
};

const atlassianApi = async ({ siteUrl, authHeader, path, params }) => {
  const url = new URL(`${stripTrailingSlash(siteUrl)}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: authHeader,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.errorMessages?.join(" ") || data.message || `Atlassian API ${path} failed with ${response.status}`);
  }
  return data;
};

export const validateJiraCredentials = async ({ siteUrl, email, apiToken }) => {
  const normalizedSiteUrl = stripTrailingSlash(siteUrl);
  const authHeader = basicAuthHeader({ email, apiToken });
  const myself = await atlassianApi({
    siteUrl: normalizedSiteUrl,
    authHeader,
    path: "/rest/api/3/myself",
  });
  return {
    siteUrl: normalizedSiteUrl,
    accountId: myself.accountId,
    displayName: myself.displayName,
    emailAddress: myself.emailAddress || email,
  };
};

export const validateConfluenceCredentials = async ({ siteUrl, email, apiToken }) => {
  const normalizedSiteUrl = stripTrailingSlash(siteUrl);
  const authHeader = basicAuthHeader({ email, apiToken });
  const user = await atlassianApi({
    siteUrl: normalizedSiteUrl,
    authHeader,
    path: "/wiki/rest/api/user/current",
  });
  return {
    siteUrl: normalizedSiteUrl,
    accountId: user.accountId,
    displayName: user.displayName || user.publicName,
    emailAddress: user.email || email,
  };
};

export const fetchJiraProjects = async ({ siteUrl, authHeader }) => {
  const data = await atlassianApi({
    siteUrl,
    authHeader,
    path: "/rest/api/3/project/search",
    params: { maxResults: 100 },
  });
  return data.values || [];
};

export const fetchJiraIssues = async ({ siteUrl, authHeader, jql }) => {
  const fields = [
    "summary",
    "status",
    "priority",
    "assignee",
    "reporter",
    "project",
    "issuetype",
    "created",
    "updated",
    "duedate",
    "resolutiondate",
    "labels",
    "parent",
    "fixVersions",
    "components",
  ].join(",");
  const issues = [];

  let nextPageToken = null;

  for (let page = 0; page < 5; page += 1) {
    const data = await atlassianApi({
      siteUrl,
      authHeader,
      path: "/rest/api/3/search/jql",
      params: {
        jql,
        maxResults: 100,
        fields,
        nextPageToken,
      },
    });
    const nextIssues = data.issues || [];
    issues.push(...nextIssues);
    nextPageToken = data.nextPageToken || null;
    if (!nextPageToken || nextIssues.length < 100) break;
  }

  return issues;
};

export const fetchConfluenceSpaces = async ({ siteUrl, authHeader }) => {
  const data = await atlassianApi({
    siteUrl,
    authHeader,
    path: "/wiki/rest/api/space",
    params: { limit: 100 },
  });
  return data.results || [];
};

export const fetchConfluencePages = async ({ siteUrl, authHeader, cql }) => {
  const pages = [];

  for (let start = 0; start < 500; start += 100) {
    const data = await atlassianApi({
      siteUrl,
      authHeader,
      path: "/wiki/rest/api/search",
      params: {
        cql,
        start,
        limit: 100,
        expand: "content.history,content.version,content.space",
      },
    });
    const nextPages = data.results || [];
    pages.push(...nextPages);
    if (nextPages.length < 100) break;
  }

  return pages;
};

export const normalizeJiraProjects = (projects) =>
  projects.map((project) => ({
    id: project.id,
    key: project.key,
    name: project.name,
    type: project.projectTypeKey,
    simplified: project.simplified,
    style: project.style,
  }));

export const normalizeJiraIssues = (issues, siteUrl = "") =>
  issues.map((issue) => {
    const fields = issue.fields || {};
    const statusCategory = fields.status?.statusCategory?.key || "";
    const resolutionDate = fields.resolutiondate || null;
    const isDone = statusCategory === "done" || Boolean(resolutionDate);
    const updatedDaysAgo = daysBetween(fields.updated);
    const ageDays = daysBetween(fields.created);
    const priority = fields.priority?.name || "No priority";

    return {
      id: issue.id,
      key: issue.key,
      url: siteUrl && issue.key ? `${stripTrailingSlash(siteUrl)}/browse/${issue.key}` : null,
      summary: fields.summary || "Untitled Jira issue",
      issueType: fields.issuetype?.name || "Issue",
      status: fields.status?.name || "Unknown",
      statusCategory,
      priority,
      projectKey: fields.project?.key || "",
      projectName: fields.project?.name || "",
      assignee: fields.assignee?.displayName || "Unassigned",
      reporter: fields.reporter?.displayName || "",
      createdAt: fields.created || null,
      updatedAt: fields.updated || null,
      dueDate: fields.duedate || null,
      resolvedAt: resolutionDate,
      labels: fields.labels || [],
      components: (fields.components || []).map((component) => component.name),
      fixVersions: (fields.fixVersions || []).map((version) => version.name),
      parentKey: fields.parent?.key || null,
      isDone,
      isOpen: !isDone,
      isOverdue: !isDone && isBeforeToday(fields.duedate),
      isStale: !isDone && updatedDaysAgo !== null && updatedDaysAgo >= 14,
      updatedDaysAgo,
      ageDays,
      isHighPriority: /highest|high|blocker|critical|urgent/i.test(priority),
      isRoadmap: /epic|initiative|roadmap|release|milestone/i.test(
        [
          fields.issuetype?.name,
          fields.summary,
          ...(fields.labels || []),
          ...(fields.fixVersions || []).map((version) => version.name),
        ].join(" ")
      ),
    };
  });

export const normalizeConfluenceSpaces = (spaces) =>
  spaces.map((space) => ({
    id: space.id,
    key: space.key,
    name: space.name,
    type: space.type,
    status: space.status,
  }));

export const normalizeConfluencePages = (pages, siteUrl) =>
  pages.map((result) => {
    const content = result.content || result;
    const updatedAt = content.version?.when || result.lastModified || null;
    const owner = content.version?.by?.displayName || content.history?.createdBy?.displayName || "Unknown";
    const title = content.title || result.title || "Untitled page";
    const space = content.space || result.space || {};
    const url = result.url
      ? `${stripTrailingSlash(siteUrl)}${result.url}`
      : content._links?.webui
        ? `${stripTrailingSlash(siteUrl)}${content._links.webui}`
        : null;
    const updatedDaysAgo = daysBetween(updatedAt);
    const haystack = [title, space.name, space.key, result.excerpt].join(" ");

    return {
      id: content.id || result.id,
      title,
      type: content.type || result.type || "page",
      url,
      spaceKey: space.key || "",
      spaceName: space.name || "",
      owner,
      updatedAt,
      updatedDaysAgo,
      isRecentlyUpdated: updatedDaysAgo !== null && updatedDaysAgo <= 30,
      isStale: updatedDaysAgo !== null && updatedDaysAgo >= 120,
      isRoadmap: /roadmap|strategy|okr|initiative|launch|release|planning/i.test(haystack),
      isPolicy: /policy|process|security|compliance|legal|runbook|playbook/i.test(haystack),
      excerpt: result.excerpt || "",
    };
  });

const groupCount = (items, keyOrFn) => {
  const map = new Map();
  items.forEach((item) => {
    const label = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    const name = label || "Unknown";
    const existing = map.get(name) || { name, count: 0 };
    existing.count += 1;
    map.set(name, existing);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};

export const summarizeJiraWorkspace = ({ issues, projects }) => {
  const openIssues = issues.filter((issue) => issue.isOpen);
  const doneIssues = issues.filter((issue) => issue.isDone);
  const completedLast30Days = doneIssues.filter((issue) => {
    const days = daysBetween(issue.resolvedAt);
    return days !== null && days <= 30;
  }).length;
  const topRisks = [...openIssues]
    .sort((a, b) => {
      const aRisk = (a.isOverdue ? 100 : 0) + (a.isStale ? 50 : 0) + (a.isHighPriority ? 35 : 0) + (a.ageDays || 0);
      const bRisk = (b.isOverdue ? 100 : 0) + (b.isStale ? 50 : 0) + (b.isHighPriority ? 35 : 0) + (b.ageDays || 0);
      return bRisk - aRisk;
    })
    .slice(0, 15);
  const ages = openIssues.map((issue) => toNumber(issue.ageDays)).filter((value) => value !== null);

  return {
    totalIssues: issues.length,
    totalProjects: projects.length,
    openIssues: openIssues.length,
    doneIssues: doneIssues.length,
    highPriorityIssues: openIssues.filter((issue) => issue.isHighPriority).length,
    overdueIssues: openIssues.filter((issue) => issue.isOverdue).length,
    staleIssues: openIssues.filter((issue) => issue.isStale).length,
    roadmapIssues: issues.filter((issue) => issue.isRoadmap).length,
    completedLast30Days,
    avgOpenAgeDays: ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : 0,
    statusBreakdown: groupCount(openIssues, "status"),
    projectBreakdown: groupCount(openIssues, "projectKey"),
    priorityBreakdown: groupCount(openIssues, "priority"),
    assigneeBreakdown: groupCount(openIssues, "assignee"),
    topRisks,
    syncedAt: new Date().toISOString(),
  };
};

export const summarizeConfluenceWorkspace = ({ pages, spaces }) => ({
  totalPages: pages.length,
  totalSpaces: spaces.length,
  recentlyUpdated: pages.filter((page) => page.isRecentlyUpdated).length,
  stalePages: pages.filter((page) => page.isStale).length,
  roadmapPages: pages.filter((page) => page.isRoadmap).length,
  policyPages: pages.filter((page) => page.isPolicy).length,
  knowledgeOwners: new Set(pages.map((page) => page.owner).filter(Boolean)).size,
  spaceBreakdown: groupCount(pages, "spaceKey"),
  ownerBreakdown: groupCount(pages, "owner"),
  typeBreakdown: groupCount(pages, "type"),
  topPages: [...pages]
    .sort((a, b) => {
      const aScore = (a.isRoadmap ? 40 : 0) + (a.isPolicy ? 20 : 0) + (a.isRecentlyUpdated ? 10 : 0) - (a.updatedDaysAgo || 0) / 30;
      const bScore = (b.isRoadmap ? 40 : 0) + (b.isPolicy ? 20 : 0) + (b.isRecentlyUpdated ? 10 : 0) - (b.updatedDaysAgo || 0) / 30;
      return bScore - aScore;
    })
    .slice(0, 15),
  syncedAt: new Date().toISOString(),
});
