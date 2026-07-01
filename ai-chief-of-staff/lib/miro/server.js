import { readIntegrations } from "@/lib/current-data-store";

const API_BASE = "https://api.miro.com";
const clean = (value) => String(value || "").trim();

const daysBetween = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
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

export const getMiroCredentials = () => ({
  clientId: clean(process.env.MIRO_CLIENT_ID),
  clientSecret: clean(process.env.MIRO_CLIENT_SECRET),
});

export const createMiroOAuthState = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export const exchangeMiroOAuthCode = async ({ clientId, clientSecret, code, redirectUri }) => {
  const response = await fetch(`${API_BASE}/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error_description || `Miro OAuth exchange failed with ${response.status}`);
  }

  return data;
};

export const getMiroConfig = async () => {
  const integrations = await readIntegrations();
  const miro = integrations.miro || {};
  const token = clean(process.env.MIRO_ACCESS_TOKEN) || miro.access_token;

  return {
    token,
    fromEnv: Boolean(process.env.MIRO_ACCESS_TOKEN),
    integration: miro,
  };
};

const miroApi = async ({ token, path, params }) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || `Miro API ${path} failed with ${response.status}`);
  }

  return data;
};

export const fetchMiroBoards = async ({ token, limit = 50 } = {}) => {
  const firstPage = await miroApi({
    token,
    path: "/v2/boards",
    params: { limit },
  });

  return Array.isArray(firstPage.data) ? firstPage.data : [];
};

export const validateMiroToken = async (token) => {
  const boards = await fetchMiroBoards({ token, limit: 1 });
  return {
    boardCount: boards.length,
    firstBoardName: boards[0]?.name,
  };
};

export const normalizeMiroBoards = (boards) =>
  boards.map((board) => {
    const modifiedAt = board.modifiedAt || board.updatedAt || board.lastModifiedAt;
    const createdAt = board.createdAt;
    const modifiedDaysAgo = daysBetween(modifiedAt);
    const ownerName =
      board.owner?.name ||
      board.owner?.email ||
      board.createdBy?.name ||
      board.createdBy?.email ||
      "Unassigned";
    const sharingPolicy =
      board.sharingPolicy?.access ||
      board.policy?.sharingPolicy?.access ||
      board.permissionsPolicy?.collaborationToolsStartAccess ||
      "Unknown";

    return {
      id: board.id,
      name: board.name || "Untitled board",
      description: board.description || "",
      viewLink: board.viewLink || board.links?.self || "",
      createdAt,
      modifiedAt,
      modifiedDaysAgo,
      ownerName,
      ownerId: board.owner?.id || board.createdBy?.id || null,
      sharingPolicy,
      pictureUrl: board.picture?.imageURL || board.picture?.url || "",
      isRecentlyUpdated: (modifiedDaysAgo ?? 999) <= 14,
      isStale: (modifiedDaysAgo ?? 0) >= 60,
      isPublic: /public|anyone|team/i.test(String(sharingPolicy)),
    };
  });

export const summarizeMiroBoards = (boards) => {
  const staleBoardQueue = boards
    .filter((board) => board.isStale)
    .sort((a, b) => (b.modifiedDaysAgo || 0) - (a.modifiedDaysAgo || 0))
    .slice(0, 15);
  const recentBoards = [...boards]
    .sort((a, b) => new Date(b.modifiedAt || 0) - new Date(a.modifiedAt || 0))
    .slice(0, 15);

  return {
    totalBoards: boards.length,
    recentlyUpdated: boards.filter((board) => board.isRecentlyUpdated).length,
    staleBoards: staleBoardQueue.length,
    privateBoards: boards.filter((board) => !board.isPublic).length,
    publicBoards: boards.filter((board) => board.isPublic).length,
    owners: new Set(boards.map((board) => board.ownerName).filter(Boolean)).size,
    ownerBreakdown: countBy(boards, (board) => board.ownerName).slice(0, 10),
    permissionBreakdown: countBy(boards, (board) => board.sharingPolicy).slice(0, 8),
    recentBoards,
    staleBoardQueue,
  };
};
