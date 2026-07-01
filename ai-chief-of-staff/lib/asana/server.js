import { readIntegrations } from "@/lib/current-data-store";

const API_BASE = "https://app.asana.com/api/1.0";

const clean = (value) => String(value || "").trim();

const daysBetween = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

const isPast = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isDueSoon = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  return date >= today && date <= week;
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

const parseProjectGids = (value) =>
  clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const getAsanaConfig = async () => {
  const integrations = await readIntegrations();
  const asana = integrations.asana || {};

  return {
    accessToken: clean(process.env.ASANA_ACCESS_TOKEN) || asana.access_token,
    workspaceGid: clean(process.env.ASANA_WORKSPACE_GID) || clean(asana.workspace_gid),
    projectGids: clean(process.env.ASANA_PROJECT_GIDS) || clean(asana.project_gids),
    fromEnv: Boolean(process.env.ASANA_ACCESS_TOKEN),
    integration: asana,
  };
};

const asanaApi = async ({ accessToken, path, params }) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.errors?.map((error) => error.message).join(" ") || payload.message;
    throw new Error(message || `Asana API ${path} failed with ${response.status}`);
  }

  return payload.data || payload;
};

export const validateAsanaToken = async (accessToken) => {
  const user = await asanaApi({
    accessToken,
    path: "/users/me",
    params: {
      opt_fields: "gid,name,email,workspaces.gid,workspaces.name",
    },
  });

  return {
    gid: user.gid,
    name: user.name,
    email: user.email,
    workspaces: user.workspaces || [],
  };
};

export const fetchAsanaWorkspaces = async ({ accessToken }) =>
  asanaApi({
    accessToken,
    path: "/workspaces",
    params: { limit: 100, opt_fields: "gid,name,is_organization" },
  });

export const fetchAsanaProjects = async ({ accessToken, workspaceGid, projectGids }) => {
  const selectedProjectGids = parseProjectGids(projectGids);
  if (selectedProjectGids.length) {
    return Promise.all(
      selectedProjectGids.map((gid) =>
        asanaApi({
          accessToken,
          path: `/projects/${gid}`,
          params: {
            opt_fields:
              "gid,name,archived,completed,completed_at,current_status.color,current_status.title,current_status.text,created_at,modified_at,owner.name,team.name,permalink_url",
          },
        })
      )
    );
  }

  return asanaApi({
    accessToken,
    path: "/projects",
    params: {
      workspace: workspaceGid,
      archived: false,
      limit: 100,
      opt_fields:
        "gid,name,archived,completed,completed_at,current_status.color,current_status.title,current_status.text,created_at,modified_at,owner.name,team.name,permalink_url",
    },
  });
};

export const fetchAsanaTasks = async ({ accessToken, projects }) => {
  const batches = await Promise.all(
    projects.slice(0, 25).map((project) =>
      asanaApi({
        accessToken,
        path: `/projects/${project.gid}/tasks`,
        params: {
          limit: 100,
          completed_since: "now",
          opt_fields:
            "gid,name,completed,completed_at,created_at,modified_at,due_on,due_at,assignee.name,assignee.email,permalink_url,tags.name,memberships.project.gid,memberships.project.name",
        },
      }).then((tasks) =>
        tasks.map((task) => ({
          ...task,
          project_gid: project.gid,
          project_name: project.name,
        }))
      )
    )
  );

  return batches.flat();
};

export const normalizeAsanaProjects = (projects) =>
  projects.map((project) => ({
    gid: project.gid,
    name: project.name || "Untitled project",
    archived: Boolean(project.archived),
    completed: Boolean(project.completed),
    completedAt: project.completed_at || null,
    createdAt: project.created_at || null,
    modifiedAt: project.modified_at || null,
    owner: project.owner?.name || "Unassigned",
    team: project.team?.name || "No team",
    statusColor: project.current_status?.color || "none",
    statusTitle: project.current_status?.title || null,
    statusText: project.current_status?.text || null,
    url: project.permalink_url || null,
  }));

export const normalizeAsanaTasks = (tasks) =>
  tasks.map((task) => {
    const dueDate = task.due_on || task.due_at || null;
    const ageDays = daysBetween(task.created_at) || 0;
    const updatedDaysAgo = daysBetween(task.modified_at);
    return {
      gid: task.gid,
      name: task.name || "Untitled task",
      completed: Boolean(task.completed),
      completedAt: task.completed_at || null,
      createdAt: task.created_at || null,
      modifiedAt: task.modified_at || null,
      dueDate,
      assignee: task.assignee?.name || "Unassigned",
      assigneeEmail: task.assignee?.email || null,
      projectGid: task.project_gid,
      projectName: task.project_name,
      url: task.permalink_url || null,
      tags: (task.tags || []).map((tag) => tag.name),
      isOpen: !task.completed,
      isOverdue: !task.completed && isPast(dueDate),
      isDueSoon: !task.completed && isDueSoon(dueDate),
      isStale: !task.completed && (updatedDaysAgo ?? 0) >= 14,
      isUnassigned: !task.assignee,
      ageDays,
      updatedDaysAgo,
    };
  });

export const summarizeAsanaWorkspace = ({ projects, tasks }) => {
  const openTasks = tasks.filter((task) => task.isOpen);
  const completedTasks = tasks.filter((task) => task.completed);
  const ages = openTasks.map((task) => task.ageDays || 0);
  const topRisks = openTasks
    .filter((task) => task.isOverdue || task.isStale || task.isUnassigned || task.ageDays >= 21)
    .sort((a, b) => {
      const overdueDelta = Number(b.isOverdue) - Number(a.isOverdue);
      if (overdueDelta) return overdueDelta;
      return (b.ageDays || 0) - (a.ageDays || 0);
    })
    .slice(0, 15);

  return {
    totalProjects: projects.length,
    totalTasks: tasks.length,
    openTasks: openTasks.length,
    completedTasks: completedTasks.length,
    overdueTasks: openTasks.filter((task) => task.isOverdue).length,
    dueSoonTasks: openTasks.filter((task) => task.isDueSoon).length,
    staleTasks: openTasks.filter((task) => task.isStale).length,
    unassignedTasks: openTasks.filter((task) => task.isUnassigned).length,
    avgOpenAgeDays: ages.length
      ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
      : 0,
    statusBreakdown: [
      { name: "Open", count: openTasks.length },
      { name: "Completed", count: completedTasks.length },
      { name: "Overdue", count: openTasks.filter((task) => task.isOverdue).length },
      { name: "Stale", count: openTasks.filter((task) => task.isStale).length },
    ],
    projectBreakdown: countBy(openTasks, (task) => task.projectName),
    ownerBreakdown: countBy(openTasks, (task) => task.assignee),
    topRisks,
  };
};
