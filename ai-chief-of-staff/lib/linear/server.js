import { LinearClient } from "@linear/sdk";
import { readIntegrations } from "@/lib/current-data-store";

const daysBetween = (dateValue, now = new Date()) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

const isBeforeToday = (dateValue) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const toIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const createLinearClient = (apiKey) => new LinearClient({ apiKey });

const resolveMaybe = async (value) => {
  if (!value) return null;
  try {
    return await value;
  } catch {
    return null;
  }
};

export const getLinearConfig = async () => {
  const integrations = await readIntegrations();
  const linear = integrations.linear || {};

  return {
    apiKey: process.env.LINEAR_API_KEY?.trim() || linear.api_key,
    fromEnv: Boolean(process.env.LINEAR_API_KEY?.trim()),
    integration: linear,
  };
};

export const validateLinearToken = async (apiKey) => {
  const client = createLinearClient(apiKey);
  const viewer = await client.viewer;
  const organization = await resolveMaybe(viewer.organization);

  return {
    userId: viewer.id,
    userName: viewer.name,
    userEmail: viewer.email,
    organizationId: organization?.id || null,
    organizationName: organization?.name || "Linear workspace",
    organizationUrlKey: organization?.urlKey || null,
  };
};

export const fetchLinearIssues = async (apiKey) => {
  const client = createLinearClient(apiKey);
  const issues = [];
  let after;

  do {
    const connection = await client.issues({
      first: 100,
      after,
    });
    issues.push(...(connection.nodes || []));
    after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after && issues.length < 1000);

  return issues;
};

export const normalizeLinearIssues = async (issues) => {
  const normalized = await Promise.all(
    issues.map(async (issue) => {
      const [state, team, assignee, project, cycle] = await Promise.all([
        resolveMaybe(issue.state),
        resolveMaybe(issue.team),
        resolveMaybe(issue.assignee),
        resolveMaybe(issue.project),
        resolveMaybe(issue.cycle),
      ]);

      const stateType = state?.type || "unknown";
      const completedAt = toIso(issue.completedAt);
      const canceledAt = toIso(issue.canceledAt);
      const createdAt = toIso(issue.createdAt);
      const updatedAt = toIso(issue.updatedAt);
      const isDone = stateType === "completed" || Boolean(completedAt);
      const isCanceled = stateType === "canceled" || Boolean(canceledAt);
      const isOpen = !isDone && !isCanceled;
      const ageDays = daysBetween(createdAt);
      const updatedDaysAgo = daysBetween(updatedAt);
      const isOverdue = isOpen && isBeforeToday(issue.dueDate);
      const isStale = isOpen && updatedDaysAgo !== null && updatedDaysAgo >= 14;

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        priority: issue.priority ?? 0,
        priorityLabel: issue.priorityLabel || "No priority",
        estimate: issue.estimate ?? null,
        state: state?.name || "Unknown",
        stateType,
        team: team?.name || "Unassigned team",
        teamKey: team?.key || "",
        assignee: assignee?.name || "Unassigned",
        assigneeEmail: assignee?.email || "",
        project: project?.name || "No project",
        projectStatus: project?.status || "",
        projectProgress: project?.progress ?? null,
        cycle: cycle?.name || "",
        dueDate: issue.dueDate || null,
        createdAt,
        updatedAt,
        completedAt,
        canceledAt,
        labelIds: issue.labelIds || [],
        isOpen,
        isDone,
        isCanceled,
        isOverdue,
        isStale,
        ageDays,
        updatedDaysAgo,
      };
    })
  );

  return normalized;
};

const groupCount = (items, key) => {
  const map = new Map();
  items.forEach((item) => {
    const label = item[key] || "Unknown";
    const existing = map.get(label) || { name: label, count: 0 };
    existing.count += 1;
    map.set(label, existing);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};

export const summarizeLinearIssues = (issues) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const openIssues = issues.filter((issue) => issue.isOpen);
  const completedLast30Days = issues.filter((issue) => {
    if (!issue.completedAt) return false;
    const completedAt = new Date(issue.completedAt);
    return !Number.isNaN(completedAt.getTime()) && completedAt >= thirtyDaysAgo;
  });

  const topRisks = [...openIssues]
    .sort((a, b) => {
      const aRisk =
        (a.isOverdue ? 100 : 0) +
        (a.isStale ? 50 : 0) +
        (5 - (a.priority || 5)) * 10 +
        (a.ageDays || 0);
      const bRisk =
        (b.isOverdue ? 100 : 0) +
        (b.isStale ? 50 : 0) +
        (5 - (b.priority || 5)) * 10 +
        (b.ageDays || 0);
      return bRisk - aRisk;
    })
    .slice(0, 12);

  return {
    totalIssues: issues.length,
    openIssues: openIssues.length,
    urgentIssues: openIssues.filter((issue) => issue.priority === 1).length,
    overdueIssues: openIssues.filter((issue) => issue.isOverdue).length,
    staleIssues: openIssues.filter((issue) => issue.isStale).length,
    completedLast30Days: completedLast30Days.length,
    canceledIssues: issues.filter((issue) => issue.isCanceled).length,
    avgOpenAgeDays: openIssues.length
      ? Math.round(openIssues.reduce((sum, issue) => sum + (issue.ageDays || 0), 0) / openIssues.length)
      : 0,
    stateBreakdown: groupCount(openIssues, "state"),
    teamBreakdown: groupCount(openIssues, "team"),
    priorityBreakdown: groupCount(openIssues, "priorityLabel"),
    projectBreakdown: groupCount(openIssues, "project"),
    topRisks,
    syncedAt: new Date().toISOString(),
  };
};
