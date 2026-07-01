import crypto from "crypto";
import { readIntegrations } from "@/lib/current-data-store";

const CLICKUP_BASE_URL = "https://api.clickup.com/api/v2";

export const createClickUpAuthHeader = (token, { oauth = false } = {}) => {
  if (!token) return token;
  const trimmed = String(token).trim();
  if (trimmed.startsWith("Bearer ")) return trimmed;
  return oauth ? `Bearer ${trimmed}` : trimmed;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const millisToIso = (value) => {
  const numeric = toNumber(value);
  if (!numeric) return null;
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

export const createClickUpOAuthState = () => crypto.randomBytes(24).toString("hex");

export const getClickUpCredentials = () => ({
  clientId: process.env.CLICKUP_CLIENT_ID?.trim(),
  clientSecret: process.env.CLICKUP_CLIENT_SECRET?.trim(),
});

export const getClickUpConfig = async () => {
  const integrations = await readIntegrations();
  const clickup = integrations.clickup || {};
  const envToken = process.env.CLICKUP_API_TOKEN?.trim();
  const storedAccessToken = clickup.access_token
    ? createClickUpAuthHeader(clickup.access_token, { oauth: true })
    : null;

  return {
    token: envToken || storedAccessToken || clickup.api_token,
    workspaceId: process.env.CLICKUP_WORKSPACE_ID?.trim() || clickup.workspace_id,
    fromEnv: Boolean(envToken),
    integration: clickup,
  };
};

export const clickUpApi = async ({ endpoint, token, params, method = "GET", body }) => {
  const url = new URL(`${CLICKUP_BASE_URL}${endpoint}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.err || data.message || `ClickUp API ${endpoint} failed with ${response.status}`);
  }
  return data;
};

export const exchangeClickUpOAuthCode = async ({ clientId, clientSecret, code }) => {
  const response = await fetch(`${CLICKUP_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.err || data.message || `ClickUp OAuth token exchange failed with ${response.status}`);
  }
  return data;
};

export const fetchClickUpWorkspaces = async (token) => {
  const data = await clickUpApi({ endpoint: "/team", token });
  return data.teams || [];
};

export const validateClickUpToken = async (token) => {
  const [userData, workspaces] = await Promise.all([
    clickUpApi({ endpoint: "/user", token }),
    fetchClickUpWorkspaces(token),
  ]);
  const workspace = workspaces[0] || null;

  return {
    user: userData.user || null,
    workspaces,
    workspaceId: workspace?.id ? String(workspace.id) : null,
    workspaceName: workspace?.name || "ClickUp workspace",
  };
};

export const fetchClickUpGoals = async ({ token, workspaceId }) => {
  const data = await clickUpApi({
    endpoint: `/team/${workspaceId}/goal`,
    token,
    params: { include_completed: true },
  });
  return data.goals || [];
};

export const fetchClickUpViews = async ({ token, workspaceId }) => {
  const data = await clickUpApi({
    endpoint: `/team/${workspaceId}/view`,
    token,
  });
  return data.views || [];
};

export const fetchClickUpTasks = async ({ token, workspaceId }) => {
  const tasks = [];

  for (let page = 0; page < 10; page += 1) {
    const data = await clickUpApi({
      endpoint: `/team/${workspaceId}/task`,
      token,
      params: {
        page,
        include_closed: true,
        subtasks: true,
        order_by: "updated",
        reverse: true,
        include_markdown_description: true,
      },
    });
    const nextTasks = data.tasks || [];
    tasks.push(...nextTasks);
    if (nextTasks.length < 100) break;
  }

  return tasks;
};

const goalProgress = (goal) => {
  const candidates = [
    goal.percent_completed,
    goal.progress,
    goal.pretty_progress,
    goal.completed_targets && goal.targets?.length
      ? (goal.completed_targets / goal.targets.length) * 100
      : null,
  ];
  const value = candidates.map(toNumber).find((item) => item !== null);
  if (value === undefined || value === null) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const goalOwners = (goal) => {
  const owners = Array.isArray(goal.owners)
    ? goal.owners
    : goal.owner
      ? [goal.owner]
      : [];

  return owners
    .map((owner) => owner.username || owner.email || owner.name)
    .filter(Boolean);
};

export const normalizeClickUpGoals = (goals) =>
  goals.map((goal) => ({
    id: goal.id,
    name: goal.name || "Untitled goal",
    description: goal.description || "",
    progress: goalProgress(goal),
    owners: goalOwners(goal),
    dueDate: millisToIso(goal.due_date),
    startDate: millisToIso(goal.start_date),
    archived: Boolean(goal.archived),
    targets: (goal.targets || []).map((target) => ({
      id: target.id,
      name: target.name,
      type: target.type,
      unit: target.unit,
      progress: toNumber(target.percent_completed ?? target.progress),
      current: target.current,
      target: target.target,
    })),
  }));

const taskAssignees = (task) =>
  (task.assignees || [])
    .map((assignee) => assignee.username || assignee.email || assignee.initials)
    .filter(Boolean);

const isTaskRoadmap = (task) => {
  const haystack = [
    task.name,
    task.list?.name,
    task.folder?.name,
    task.space?.name,
    task.status?.status,
    ...(task.tags || []).map((tag) => tag.name),
    ...(task.custom_fields || []).map((field) => `${field.name} ${field.value}`),
  ].join(" ");
  return /roadmap|milestone|initiative|launch|release|epic|okr|goal/i.test(haystack);
};

export const normalizeClickUpTasks = (tasks) =>
  tasks.map((task) => {
    const status = task.status?.status || "Unknown";
    const statusType = task.status?.type || "";
    const dueDate = millisToIso(task.due_date);
    const updatedAt = millisToIso(task.date_updated);
    const createdAt = millisToIso(task.date_created);
    const closedAt = millisToIso(task.date_closed || task.date_done);
    const isClosed = statusType === "closed" || Boolean(closedAt) || /complete|done|closed/i.test(status);
    const isOpen = !isClosed;
    const updatedDaysAgo = daysBetween(updatedAt);
    const ageDays = daysBetween(createdAt);

    return {
      id: task.id,
      customId: task.custom_id,
      name: task.name || "Untitled task",
      url: task.url,
      status,
      statusType,
      priority: task.priority?.priority || "No priority",
      priorityColor: task.priority?.color,
      list: task.list?.name || "Unknown list",
      folder: task.folder?.name || "",
      space: task.space?.name || "",
      assignees: taskAssignees(task),
      tags: (task.tags || []).map((tag) => tag.name),
      dueDate,
      createdAt,
      updatedAt,
      closedAt,
      timeEstimate: task.time_estimate || null,
      points: task.points || null,
      isOpen,
      isClosed,
      isOverdue: isOpen && isBeforeToday(dueDate),
      isStale: isOpen && updatedDaysAgo !== null && updatedDaysAgo >= 14,
      isRoadmap: isTaskRoadmap(task),
      updatedDaysAgo,
      ageDays,
    };
  });

export const normalizeClickUpViews = (views) =>
  views.map((view) => ({
    id: view.id,
    name: view.name || "Untitled view",
    type: view.type,
    url: view.url,
    parent: view.parent,
    grouping: view.grouping,
  }));

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

export const summarizeClickUpWorkspace = ({ goals, tasks, roadmaps }) => {
  const openTasks = tasks.filter((task) => task.isOpen);
  const completedTasks = tasks.filter((task) => task.isClosed);
  const goalProgressValues = goals
    .map((goal) => goal.progress)
    .filter((value) => typeof value === "number");
  const topRisks = [...openTasks]
    .sort((a, b) => {
      const aRisk = (a.isOverdue ? 100 : 0) + (a.isStale ? 50 : 0) + (a.priority === "urgent" ? 30 : 0) + (a.ageDays || 0);
      const bRisk = (b.isOverdue ? 100 : 0) + (b.isStale ? 50 : 0) + (b.priority === "urgent" ? 30 : 0) + (b.ageDays || 0);
      return bRisk - aRisk;
    })
    .slice(0, 12);

  return {
    totalGoals: goals.length,
    avgGoalProgress: goalProgressValues.length
      ? Math.round(goalProgressValues.reduce((sum, value) => sum + value, 0) / goalProgressValues.length)
      : null,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter((task) => task.isOverdue).length,
    urgentTasks: openTasks.filter((task) => /urgent/i.test(task.priority)).length,
    staleTasks: openTasks.filter((task) => task.isStale).length,
    completedTasks: completedTasks.length,
    roadmapItems: roadmaps.length,
    statusBreakdown: groupCount(openTasks, "status"),
    ownerBreakdown: groupCount(openTasks, (task) => task.assignees[0] || "Unassigned"),
    roadmapBreakdown: groupCount(roadmaps, "status"),
    topRisks,
    syncedAt: new Date().toISOString(),
  };
};
