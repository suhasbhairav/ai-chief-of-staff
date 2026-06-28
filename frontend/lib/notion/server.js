import { readIntegrations } from "@/lib/current-data-store";

const NOTION_VERSION = "2022-06-28";

const getPlainText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => item?.plain_text || item?.text?.content || "").join("");
  }
  if (value.name) return value.name;
  if (value.plain_text) return value.plain_text;
  if (value.start) return value.start;
  return "";
};

const readProperty = (properties, names) => {
  const key = names.find((name) => properties?.[name]);
  if (!key) return "";
  const property = properties[key];

  switch (property.type) {
    case "title":
      return getPlainText(property.title);
    case "rich_text":
      return getPlainText(property.rich_text);
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "multi_select":
      return (property.multi_select || []).map((item) => item.name).join(", ");
    case "number":
      return property.number ?? "";
    case "date":
      return property.date?.start || "";
    case "people":
      return (property.people || []).map((person) => person.name || person.person?.email).filter(Boolean).join(", ");
    case "checkbox":
      return property.checkbox ? "Yes" : "No";
    case "url":
      return property.url || "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "formula":
      return property.formula?.number ?? property.formula?.string ?? property.formula?.boolean ?? "";
    case "rollup":
      return property.rollup?.number ?? property.rollup?.array?.map((item) => getPlainText(item[item.type])).join(", ") ?? "";
    default:
      return "";
  }
};

const normalizeProgress = (value) => {
  const numeric = Number(String(value).replace("%", ""));
  if (!Number.isFinite(numeric)) return null;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
};

export const getNotionConfig = async () => {
  const integrations = await readIntegrations();
  const notion = integrations.notion || {};

  return {
    apiKey: process.env.NOTION_API_KEY?.trim() || notion.api_key,
    databaseId: process.env.NOTION_OKR_DATABASE_ID?.trim() || notion.database_id,
    fromEnv: Boolean(process.env.NOTION_API_KEY?.trim() && process.env.NOTION_OKR_DATABASE_ID?.trim()),
    integration: notion,
  };
};

export const notionApi = async ({ endpoint, method = "GET", token, body }) => {
  const response = await fetch(`https://api.notion.com/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Notion API ${endpoint} failed with ${response.status}`);
  }
  return data;
};

export const parseNotionOkrPage = (page) => {
  const properties = page.properties || {};
  const objective = readProperty(properties, ["Objective", "Name", "OKR", "Title", "Goal"]);
  const keyResult = readProperty(properties, ["Key Result", "KR", "KeyResult", "Result", "Metric"]);
  const progress = normalizeProgress(readProperty(properties, ["Progress", "% Complete", "Completion", "Percent", "Confidence %"]));

  return {
    id: page.id,
    notionUrl: page.url,
    objective: objective || keyResult || "Untitled OKR",
    keyResult: keyResult || objective || "Untitled key result",
    owner: readProperty(properties, ["Owner", "DRI", "Lead", "PM", "Assignee"]) || "Unassigned",
    status: readProperty(properties, ["Status", "State", "Stage"]) || "Unknown",
    progress,
    quarter: readProperty(properties, ["Quarter", "Period", "Cycle", "Timeframe"]) || "Current",
    confidence: readProperty(properties, ["Confidence", "Confidence Level"]) || "",
    dueDate: readProperty(properties, ["Due Date", "Date", "Target Date"]) || "",
    department: readProperty(properties, ["Department", "Team", "Function"]) || "Product",
    priority: readProperty(properties, ["Priority", "P"]) || "",
    lastEditedAt: page.last_edited_time,
  };
};

export const fetchNotionOkrs = async ({ apiKey, databaseId }) => {
  if (!apiKey || !databaseId) {
    throw new Error("NOTION_API_KEY and NOTION_OKR_DATABASE_ID are required.");
  }

  const pages = [];
  let cursor;

  do {
    const data = await notionApi({
      endpoint: `databases/${databaseId}/query`,
      method: "POST",
      token: apiKey,
      body: {
        page_size: 100,
        start_cursor: cursor,
        sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      },
    });
    pages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages.map(parseNotionOkrPage);
};

export const summarizeOkrs = (okrs) => {
  const total = okrs.length;
  const withProgress = okrs.filter((okr) => typeof okr.progress === "number");
  const avgProgress = withProgress.length
    ? Math.round(withProgress.reduce((sum, okr) => sum + okr.progress, 0) / withProgress.length)
    : null;
  const atRisk = okrs.filter((okr) =>
    /risk|blocked|off track|behind/i.test(`${okr.status} ${okr.confidence}`) ||
    (typeof okr.progress === "number" && okr.progress < 50)
  );
  const completed = okrs.filter((okr) => /done|complete|shipped|achieved/i.test(okr.status));
  const owners = [...new Set(okrs.map((okr) => okr.owner).filter(Boolean))];

  return {
    total,
    avgProgress,
    atRisk: atRisk.length,
    completed: completed.length,
    owners: owners.length,
    lastSyncedAt: new Date().toISOString(),
  };
};
