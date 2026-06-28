import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  disconnectSlackInstallation,
  readActiveSlackInstallation,
  saveSlackInstallation,
  tokenToPublicIntegration,
} from "@/lib/slack/server";
import { upsertDepartmentEmbeddings } from "@/lib/openai/department-embeddings";
import fs from "fs";
import path from "path";

// Helper to get the local data directory path
const getLocalDataDir = () => {
  const base = process.cwd();
  const dirPath = base.endsWith("frontend")
    ? path.join(base, "current-data")
    : path.join(base, "frontend", "current-data");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

const toDepartmentSnapshot = (row) => {
  const content = row.content || {};

  return {
    ...content,
    departmentId: row.department_id,
    departmentName: row.department_name,
    filename: row.filename || content.filename || "",
    uploadedAt: row.uploaded_at || content.uploadedAt,
    headers: row.headers || content.headers || [],
    recordCount: row.record_count ?? content.recordCount ?? 0,
    records: row.records || content.records || [],
    sampleRecords: row.sample_records || content.sampleRecords || [],
  };
};

const normalizeDepartmentSnapshot = (snapshot) => {
  const headers = Array.isArray(snapshot.headers) ? snapshot.headers : [];
  const records = Array.isArray(snapshot.records) ? snapshot.records : [];
  const sampleRecords = Array.isArray(snapshot.sampleRecords)
    ? snapshot.sampleRecords
    : records.slice(0, 5);
  const uploadedAt = snapshot.uploadedAt || new Date().toISOString();

  return {
    ...snapshot,
    uploadedAt,
    headers,
    records,
    sampleRecords,
    recordCount: Number.isInteger(snapshot.recordCount)
      ? snapshot.recordCount
      : records.length,
  };
};

const getPeriodBounds = (records, headers) => {
  const periodHeader = headers.find((header) =>
    /date|month|quarter|period|week|year/i.test(header)
  );
  const values = periodHeader
    ? records
        .map((record) => record[periodHeader])
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map(String)
        .sort()
    : [];

  return {
    periodStart: values[0] || null,
    periodEnd: values[values.length - 1] || null,
  };
};

export const buildOrganizationSummary = (departments) => {
  const departmentSummaries = Object.values(departments)
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName))
    .map((department) => ({
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      filename: department.filename,
      uploadedAt: department.uploadedAt,
      headers: department.headers,
      recordCount: department.recordCount,
      sampleRecords: department.sampleRecords,
    }));

  return {
    updatedAt: new Date().toISOString(),
    totalDepartments: departmentSummaries.length,
    totalRecords: departmentSummaries.reduce(
      (sum, department) => sum + department.recordCount,
      0
    ),
    departments,
    departmentSummaries,
  };
};

export const readOrganizationSummary = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const summaryPath = path.join(dir, "organization-summary.json");
    
    if (fs.existsSync(summaryPath)) {
      try {
        const raw = fs.readFileSync(summaryPath, "utf-8");
        return JSON.parse(raw);
      } catch (e) {
        console.error("Failed to parse organization-summary.json, rebuilding...", e);
      }
    }

    // Rebuild from individual department files
    const files = fs.readdirSync(dir);
    const departments = {};
    const excludedFiles = [
      "organization-summary.json",
      "history.json",
      "board-memos.json",
      "todo-list.json",
      "notion-okrs.json",
      "hubspot-deals.json",
      "linear-tickets.json",
      "clickup-workspace.json",
      "jira-workspace.json",
      "confluence-workspace.json",
      "github-workspace.json",
      "asana-workspace.json",
      "mailchimp-marketing.json",
      "quickbooks-accounting.json",
      "salesforce-crm.json",
      "stripe-payments.json",
      "integrations.json"
    ];

    for (const file of files) {
      if (file.endsWith(".json") && !excludedFiles.includes(file)) {
        try {
          const deptId = path.basename(file, ".json");
          const raw = fs.readFileSync(path.join(dir, file), "utf-8");
          const data = JSON.parse(raw);
          departments[deptId] = normalizeDepartmentSnapshot(data);
        } catch (e) {
          console.error(`Failed to parse local department file ${file}:`, e);
        }
      }
    }

    const summary = buildOrganizationSummary(departments);
    await upsertOrganizationSummary(summary);
    return summary;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_snapshots")
    .select(
      "department_id, department_name, filename, uploaded_at, headers, record_count, sample_records, records, content"
    )
    .order("department_name", { ascending: true });

  if (error) {
    throw new Error(`Unable to read Supabase department snapshots: ${error.message}`);
  }

  const departments = Object.fromEntries(
    (data || []).map((row) => [row.department_id, toDepartmentSnapshot(row)])
  );
  const summary = buildOrganizationSummary(departments);

  await upsertOrganizationSummary(summary);

  return summary;
};

export const upsertDepartmentSnapshot = async (snapshot) => {
  const normalized = normalizeDepartmentSnapshot(snapshot);
  const { periodStart, periodEnd } = getPeriodBounds(
    normalized.records,
    normalized.headers
  );

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    
    // Save snapshot file
    const deptPath = path.join(dir, `${normalized.departmentId}.json`);
    fs.writeFileSync(deptPath, JSON.stringify(normalized, null, 2), "utf-8");

    // Append to local history
    const historyPath = path.join(dir, "history.json");
    let history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      } catch (e) {
        console.error("Failed to parse history.json, resetting...", e);
      }
    }

    const historyRecord = {
      id: Math.random().toString(36).substring(2, 11),
      departmentId: normalized.departmentId,
      departmentName: normalized.departmentName,
      importType: normalized.importType || "current-upload",
      filename: normalized.filename,
      importedAt: normalized.uploadedAt,
      periodStart,
      periodEnd,
      headers: normalized.headers,
      recordCount: normalized.recordCount,
      sampleRecords: normalized.sampleRecords,
      records: normalized.records,
      content: {
        ...normalized,
        periodStart,
        periodEnd,
      },
    };

    history.unshift(historyRecord);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");

    return readOrganizationSummary();
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("department_snapshots")
    .upsert(
      {
        department_id: normalized.departmentId,
        department_name: normalized.departmentName,
        filename: normalized.filename,
        uploaded_at: normalized.uploadedAt,
        headers: normalized.headers,
        record_count: normalized.recordCount,
        sample_records: normalized.sampleRecords,
        records: normalized.records,
        content: normalized,
      },
      { onConflict: "department_id" }
    );

  if (error) {
    throw new Error(`Unable to save Supabase department snapshot: ${error.message}`);
  }

  const { error: historyError } = await supabase
    .from("department_snapshot_history")
    .insert({
      department_id: normalized.departmentId,
      department_name: normalized.departmentName,
      import_type: normalized.importType || "current-upload",
      filename: normalized.filename,
      imported_at: normalized.uploadedAt,
      period_start: periodStart,
      period_end: periodEnd,
      headers: normalized.headers,
      record_count: normalized.recordCount,
      sample_records: normalized.sampleRecords,
      records: normalized.records,
      content: {
        ...normalized,
        periodStart,
        periodEnd,
      },
    });

  if (historyError) {
    throw new Error(`Unable to save Supabase historical import: ${historyError.message}`);
  }

  try {
    await upsertDepartmentEmbeddings(normalized);
  } catch (embeddingError) {
    console.error("Department embedding refresh failed:", embeddingError);
  }

  return readOrganizationSummary();
};

export const readHistoricalImports = async ({ departmentId } = {}) => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const historyPath = path.join(dir, "history.json");
    if (!fs.existsSync(historyPath)) return [];
    
    try {
      const history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      if (departmentId && departmentId !== "executive") {
        return history.filter((item) => item.departmentId === departmentId);
      }
      return history;
    } catch (e) {
      console.error("Failed to read local history:", e);
      return [];
    }
  }

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("department_snapshot_history")
    .select(
      "id, department_id, department_name, import_type, filename, imported_at, period_start, period_end, headers, record_count, sample_records, records, content"
    )
    .order("imported_at", { ascending: false })
    .limit(100);

  if (departmentId && departmentId !== "executive") {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to read Supabase historical imports: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    importType: row.import_type,
    filename: row.filename,
    importedAt: row.imported_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    headers: row.headers || [],
    recordCount: row.record_count || 0,
    sampleRecords: row.sample_records || [],
    records: row.records || [],
    content: row.content || {},
  }));
};

export const upsertOrganizationSummary = async (summary) => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const summaryPath = path.join(dir, "organization-summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    return;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("organization_summaries")
    .upsert(
      {
        id: "current",
        updated_at: summary.updatedAt,
        total_departments: summary.totalDepartments,
        total_records: summary.totalRecords,
        department_summaries: summary.departmentSummaries,
        departments: summary.departments,
        content: summary,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(`Unable to save Supabase organization summary: ${error.message}`);
  }
};

export const createBoardMemoRecord = async (memo) => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const memosPath = path.join(dir, "board-memos.json");
    let memos = [];
    if (fs.existsSync(memosPath)) {
      try {
        memos = JSON.parse(fs.readFileSync(memosPath, "utf-8"));
      } catch (e) {
        console.error("Failed to parse board-memos.json, resetting...", e);
      }
    }
    const mockId = Math.random().toString(36).substring(2, 15) + "-" + Math.random().toString(36).substring(2, 15);
    const newMemo = { ...memo, id: mockId, savedAt: new Date().toISOString() };
    memos.push(newMemo);
    fs.writeFileSync(memosPath, JSON.stringify(memos, null, 2), "utf-8");
    return { id: mockId };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_memos")
    .insert({
      memo_type: memo.memoType || "board-memo",
      title: memo.title,
      department_id: memo.departmentId,
      department_name: memo.departmentName,
      generated_at: memo.generatedAt,
      content: memo,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Unable to save Supabase board memo: ${error.message}`);
  }

  return data;
};

// ==========================================
// TO-DO LIST OPERATIONS
// ==========================================

const DEFAULT_TODO_LIST = [
  {
    id: "task-1",
    title: "Sign contract with Gavin Belson",
    priority: "P0",
    source: "Gmail",
    status: "Needs you",
    owner: "Gavin Belson",
    description: "Richard, I need that licensing agreement signed by EOD...",
    dueDate: "Today",
  },
  {
    id: "task-2",
    title: "Reply to Erlich Bachman re: TechCrunch launch",
    priority: "P2",
    source: "Gmail",
    status: "Delegated to Monica",
    owner: "Erlich Bachman",
    description: "Launch prep and media routing confirmation.",
    dueDate: "Tomorrow",
  },
  {
    id: "task-3",
    title: "Address Gilfoyle's compression algorithm memory leak",
    priority: "P0",
    source: "Slack",
    status: "Needs you",
    owner: "Gilfoyle",
    description: "hey @richard the compression algo is leaking memory.",
    dueDate: "Immediate",
  },
  {
    id: "task-4",
    title: "Prep board deck for Laurie Bream",
    priority: "P1",
    source: "Google Calendar",
    status: "Needs you",
    owner: "Laurie Bream",
    description: "Board meeting starts in 15 min with Laurie Bream, Monica Hall, and 3 others.",
    dueDate: "In 15m",
  },
  {
    id: "task-5",
    title: "Deny server access request from Jian-Yang",
    priority: "P3",
    source: "Gmail",
    status: "Delegated to Gilfoyle",
    owner: "Jian-Yang",
    description: "Richard, I make new app. It is your app but for octopus.",
    dueDate: "2 days",
  },
  {
    id: "task-6",
    title: "Revert Dinesh's production push",
    priority: "P1",
    source: "Slack",
    status: "Needs you",
    owner: "Dinesh",
    description: "Updated the API docs — can you review before standup?",
    dueDate: "Today",
  }
];

const DEFAULT_WAITING_ON = [
  {
    id: "wait-1",
    owner: "Amy Santiago",
    title: "Case brief review",
    status: "1 day overdue",
  },
  {
    id: "wait-2",
    owner: "Charles Boyle",
    title: "Stakeout report",
    status: "Pending",
  },
  {
    id: "wait-3",
    owner: "Rosa Diaz",
    title: "Suspect list",
    status: "3 days overdue",
  }
];

export const readTodoList = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const todoPath = path.join(dir, "todo-list.json");
    
    if (fs.existsSync(todoPath)) {
      try {
        return JSON.parse(fs.readFileSync(todoPath, "utf-8"));
      } catch (e) {
        console.error("Failed to read todo-list.json, rebuilding defaults...", e);
      }
    }

    const defaultStore = {
      todos: DEFAULT_TODO_LIST,
      waitingOn: DEFAULT_WAITING_ON,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(todoPath, JSON.stringify(defaultStore, null, 2), "utf-8");
    return defaultStore;
  }

  // Supabase implementation
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_summaries")
      .select("content")
      .eq("id", "current")
      .maybeSingle();

    if (error) throw error;
    if (data?.content?.todoStore) {
      return data.content.todoStore;
    }
  } catch (err) {
    console.error("Failed to read todoList from Supabase:", err);
  }

  const defaultStore = {
    todos: DEFAULT_TODO_LIST,
    waitingOn: DEFAULT_WAITING_ON,
    updatedAt: new Date().toISOString(),
  };
  return defaultStore;
};

export const writeTodoList = async (todoStore) => {
  const updatedStore = {
    ...todoStore,
    updatedAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const todoPath = path.join(dir, "todo-list.json");
    fs.writeFileSync(todoPath, JSON.stringify(updatedStore, null, 2), "utf-8");
    return updatedStore;
  }

  // Supabase implementation
  try {
    const supabase = createSupabaseServerClient();
    let summary = {};
    const { data } = await supabase
      .from("organization_summaries")
      .select("content")
      .eq("id", "current")
      .maybeSingle();

    if (data?.content) {
      summary = data.content;
    } else {
      summary = {
        updatedAt: new Date().toISOString(),
        totalDepartments: 0,
        totalRecords: 0,
        departments: {},
        departmentSummaries: [],
      };
    }

    summary.todoStore = updatedStore;
    await upsertOrganizationSummary(summary);
  } catch (err) {
    console.error("Failed to write todoList to Supabase:", err);
  }
  return updatedStore;
};

// ==========================================
// INTEGRATIONS SETTINGS
// ==========================================

const DEFAULT_INTEGRATIONS = {
  slack: { connected: false, name: "Slack", icon: "💬" },
  gmail: { connected: false, name: "Gmail & Calendar", icon: "📧" },
  notion: { connected: false, name: "Notion OKRs", icon: "📓" },
  hubspot: { connected: false, name: "HubSpot Deals", icon: "🧲" },
  linear: { connected: false, name: "Linear Tickets", icon: "🎫" },
  clickup: { connected: false, name: "ClickUp Workspace", icon: "☑️" },
  jira: { connected: false, name: "Jira Issues", icon: "🔷" },
  confluence: { connected: false, name: "Confluence Knowledge", icon: "📘" },
  github: { connected: false, name: "GitHub Engineering", icon: "🐙" },
  asana: { connected: false, name: "Asana Work Management", icon: "🔴" },
  mailchimp: { connected: false, name: "Mailchimp Marketing", icon: "📬" },
  quickbooks: { connected: false, name: "QuickBooks Accounting", icon: "📗" },
  salesforce: { connected: false, name: "Salesforce CRM", icon: "☁️" },
  stripe: { connected: false, name: "Stripe Payments", icon: "💳" },
};

export const readIntegrations = async () => {
  let slackIntegration = DEFAULT_INTEGRATIONS.slack;

  try {
    const slackInstallation = await readActiveSlackInstallation();
    if (slackInstallation) {
      slackIntegration = tokenToPublicIntegration(slackInstallation);
    }
  } catch (error) {
    console.error("Failed to read Slack installation:", error);
  }

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const integrationsPath = path.join(dir, "integrations.json");
    
    if (fs.existsSync(integrationsPath)) {
      try {
        const localIntegrations = JSON.parse(fs.readFileSync(integrationsPath, "utf-8"));
        return {
          ...DEFAULT_INTEGRATIONS,
          ...localIntegrations,
          slack: localIntegrations.slack || slackIntegration,
        };
      } catch (e) {
        console.error("Failed to read integrations.json, rebuilding...", e);
      }
    }

    const defaults = { ...DEFAULT_INTEGRATIONS, slack: slackIntegration };
    fs.writeFileSync(integrationsPath, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }

  // Supabase implementation
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("organization_summaries")
      .select("content")
      .eq("id", "current")
      .maybeSingle();

    if (error) throw error;
    if (data?.content?.integrations) {
      return {
        ...DEFAULT_INTEGRATIONS,
        ...data.content.integrations,
        slack: slackIntegration,
      };
    }
  } catch (err) {
    console.error("Failed to read integrations from Supabase:", err);
  }

  return { ...DEFAULT_INTEGRATIONS, slack: slackIntegration };
};

export const writeIntegrations = async (integrations) => {
  if (integrations?.slack?.bot_token) {
    const savedInstallation = await saveSlackInstallation({
      access_token: integrations.slack.bot_token,
      team_id: integrations.slack.team_id,
      team_name: integrations.slack.team_name,
      bot_user_id: integrations.slack.bot_user_id,
      scope: integrations.slack.scope,
    });
    integrations = {
      ...integrations,
      slack: tokenToPublicIntegration(savedInstallation),
    };
  } else if (integrations?.slack && integrations.slack.connected === false) {
    await disconnectSlackInstallation();
    integrations = {
      ...integrations,
      slack: DEFAULT_INTEGRATIONS.slack,
    };
  } else if (integrations?.slack) {
    const currentInstallation = await readActiveSlackInstallation();
    integrations = {
      ...integrations,
      slack: currentInstallation
        ? tokenToPublicIntegration(currentInstallation)
        : DEFAULT_INTEGRATIONS.slack,
    };
  }

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const integrationsPath = path.join(dir, "integrations.json");
    fs.writeFileSync(integrationsPath, JSON.stringify(integrations, null, 2), "utf-8");
    return integrations;
  }

  // Supabase implementation
  try {
    const supabase = createSupabaseServerClient();
    let summary = {};
    const { data } = await supabase
      .from("organization_summaries")
      .select("content")
      .eq("id", "current")
      .maybeSingle();

    if (data?.content) {
      summary = data.content;
    } else {
      summary = {
        updatedAt: new Date().toISOString(),
        totalDepartments: 0,
        totalRecords: 0,
        departments: {},
        departmentSummaries: [],
      };
    }

    summary.integrations = integrations;
    await upsertOrganizationSummary(summary);
  } catch (err) {
    console.error("Failed to write integrations to Supabase:", err);
  }
  return integrations;
};

// ==========================================
// NOTION OKR STORE
// ==========================================

const DEFAULT_NOTION_OKR_STORE = {
  syncedAt: null,
  databaseId: null,
  okrs: [],
  summary: {
    total: 0,
    avgProgress: null,
    atRisk: 0,
    completed: 0,
    owners: 0,
  },
};

export const readNotionOkrs = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const okrPath = path.join(dir, "notion-okrs.json");
    if (!fs.existsSync(okrPath)) return DEFAULT_NOTION_OKR_STORE;

    try {
      return JSON.parse(fs.readFileSync(okrPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read notion-okrs.json:", error);
      return DEFAULT_NOTION_OKR_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notion_okr_snapshots")
    .select("database_id, synced_at, okrs, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Notion OKRs: ${error.message}`);
  }

  if (!data) return DEFAULT_NOTION_OKR_STORE;

  return {
    syncedAt: data.synced_at,
    databaseId: data.database_id,
    okrs: data.okrs || [],
    summary: data.summary || DEFAULT_NOTION_OKR_STORE.summary,
    content: data.content || {},
  };
};

export const writeNotionOkrs = async ({ databaseId, okrs, summary }) => {
  const store = {
    syncedAt: new Date().toISOString(),
    databaseId,
    okrs: Array.isArray(okrs) ? okrs : [],
    summary: summary || DEFAULT_NOTION_OKR_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const okrPath = path.join(dir, "notion-okrs.json");
    fs.writeFileSync(okrPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("notion_okr_snapshots").insert({
    database_id: databaseId,
    synced_at: store.syncedAt,
    okrs: store.okrs,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Notion OKRs: ${error.message}`);
  }

  return store;
};

// ==========================================
// HUBSPOT DEAL PIPELINE STORE
// ==========================================

const DEFAULT_HUBSPOT_DEAL_STORE = {
  syncedAt: null,
  portalId: null,
  deals: [],
  pipelines: [],
  owners: [],
  summary: {
    totalDeals: 0,
    openDeals: 0,
    openPipelineAmount: 0,
    weightedPipelineAmount: 0,
    closedWonAmount: 0,
    staleDeals: 0,
    forecastNext90Days: 0,
    avgDealSize: 0,
    winRate: null,
    stageBreakdown: [],
    pipelineBreakdown: [],
    topOpenDeals: [],
  },
};

export const readHubSpotDeals = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const dealsPath = path.join(dir, "hubspot-deals.json");
    if (!fs.existsSync(dealsPath)) return DEFAULT_HUBSPOT_DEAL_STORE;

    try {
      return JSON.parse(fs.readFileSync(dealsPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read hubspot-deals.json:", error);
      return DEFAULT_HUBSPOT_DEAL_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hubspot_deal_snapshots")
    .select("portal_id, synced_at, deals, pipelines, owners, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read HubSpot deals: ${error.message}`);
  }

  if (!data) return DEFAULT_HUBSPOT_DEAL_STORE;

  return {
    syncedAt: data.synced_at,
    portalId: data.portal_id,
    deals: data.deals || [],
    pipelines: data.pipelines || [],
    owners: data.owners || [],
    summary: data.summary || DEFAULT_HUBSPOT_DEAL_STORE.summary,
    content: data.content || {},
  };
};

export const writeHubSpotDeals = async ({ portalId, deals, pipelines, owners, summary }) => {
  const store = {
    syncedAt: new Date().toISOString(),
    portalId: portalId || null,
    deals: Array.isArray(deals) ? deals : [],
    pipelines: Array.isArray(pipelines) ? pipelines : [],
    owners: Array.isArray(owners) ? owners : [],
    summary: summary || DEFAULT_HUBSPOT_DEAL_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const dealsPath = path.join(dir, "hubspot-deals.json");
    fs.writeFileSync(dealsPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("hubspot_deal_snapshots").insert({
    portal_id: store.portalId,
    synced_at: store.syncedAt,
    deals: store.deals,
    pipelines: store.pipelines,
    owners: store.owners,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save HubSpot deals: ${error.message}`);
  }

  return store;
};

// ==========================================
// LINEAR TICKET OVERVIEW STORE
// ==========================================

const DEFAULT_LINEAR_TICKET_STORE = {
  syncedAt: null,
  organizationId: null,
  organizationName: null,
  issues: [],
  summary: {
    totalIssues: 0,
    openIssues: 0,
    urgentIssues: 0,
    overdueIssues: 0,
    staleIssues: 0,
    completedLast30Days: 0,
    canceledIssues: 0,
    avgOpenAgeDays: 0,
    stateBreakdown: [],
    teamBreakdown: [],
    priorityBreakdown: [],
    topRisks: [],
  },
};

export const readLinearTickets = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const ticketsPath = path.join(dir, "linear-tickets.json");
    if (!fs.existsSync(ticketsPath)) return DEFAULT_LINEAR_TICKET_STORE;

    try {
      return JSON.parse(fs.readFileSync(ticketsPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read linear-tickets.json:", error);
      return DEFAULT_LINEAR_TICKET_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("linear_ticket_snapshots")
    .select("organization_id, organization_name, synced_at, issues, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Linear tickets: ${error.message}`);
  }

  if (!data) return DEFAULT_LINEAR_TICKET_STORE;

  return {
    syncedAt: data.synced_at,
    organizationId: data.organization_id,
    organizationName: data.organization_name,
    issues: data.issues || [],
    summary: data.summary || DEFAULT_LINEAR_TICKET_STORE.summary,
    content: data.content || {},
  };
};

export const writeLinearTickets = async ({ organizationId, organizationName, issues, summary }) => {
  const store = {
    syncedAt: new Date().toISOString(),
    organizationId: organizationId || null,
    organizationName: organizationName || null,
    issues: Array.isArray(issues) ? issues : [],
    summary: summary || DEFAULT_LINEAR_TICKET_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const ticketsPath = path.join(dir, "linear-tickets.json");
    fs.writeFileSync(ticketsPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("linear_ticket_snapshots").insert({
    organization_id: store.organizationId,
    organization_name: store.organizationName,
    synced_at: store.syncedAt,
    issues: store.issues,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Linear tickets: ${error.message}`);
  }

  return store;
};

// ==========================================
// CLICKUP OKR / TASK / ROADMAP STORE
// ==========================================

const DEFAULT_CLICKUP_WORKSPACE_STORE = {
  syncedAt: null,
  workspaceId: null,
  workspaceName: null,
  goals: [],
  tasks: [],
  roadmaps: [],
  views: [],
  summary: {
    totalGoals: 0,
    avgGoalProgress: null,
    openTasks: 0,
    overdueTasks: 0,
    urgentTasks: 0,
    staleTasks: 0,
    completedTasks: 0,
    roadmapItems: 0,
    statusBreakdown: [],
    ownerBreakdown: [],
    roadmapBreakdown: [],
    topRisks: [],
  },
};

export const readClickUpWorkspace = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const workspacePath = path.join(dir, "clickup-workspace.json");
    if (!fs.existsSync(workspacePath)) return DEFAULT_CLICKUP_WORKSPACE_STORE;

    try {
      return JSON.parse(fs.readFileSync(workspacePath, "utf-8"));
    } catch (error) {
      console.error("Failed to read clickup-workspace.json:", error);
      return DEFAULT_CLICKUP_WORKSPACE_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clickup_workspace_snapshots")
    .select("workspace_id, workspace_name, synced_at, goals, tasks, roadmaps, views, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read ClickUp workspace: ${error.message}`);
  }

  if (!data) return DEFAULT_CLICKUP_WORKSPACE_STORE;

  return {
    syncedAt: data.synced_at,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    goals: data.goals || [],
    tasks: data.tasks || [],
    roadmaps: data.roadmaps || [],
    views: data.views || [],
    summary: data.summary || DEFAULT_CLICKUP_WORKSPACE_STORE.summary,
    content: data.content || {},
  };
};

export const writeClickUpWorkspace = async ({
  workspaceId,
  workspaceName,
  goals,
  tasks,
  roadmaps,
  views,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    workspaceId: workspaceId || null,
    workspaceName: workspaceName || null,
    goals: Array.isArray(goals) ? goals : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    roadmaps: Array.isArray(roadmaps) ? roadmaps : [],
    views: Array.isArray(views) ? views : [],
    summary: summary || DEFAULT_CLICKUP_WORKSPACE_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const workspacePath = path.join(dir, "clickup-workspace.json");
    fs.writeFileSync(workspacePath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("clickup_workspace_snapshots").insert({
    workspace_id: store.workspaceId,
    workspace_name: store.workspaceName,
    synced_at: store.syncedAt,
    goals: store.goals,
    tasks: store.tasks,
    roadmaps: store.roadmaps,
    views: store.views,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save ClickUp workspace: ${error.message}`);
  }

  return store;
};

// ==========================================
// JIRA ISSUE / PROJECT EXECUTION STORE
// ==========================================

const DEFAULT_JIRA_WORKSPACE_STORE = {
  syncedAt: null,
  siteUrl: null,
  issues: [],
  projects: [],
  summary: {
    totalIssues: 0,
    openIssues: 0,
    doneIssues: 0,
    highPriorityIssues: 0,
    overdueIssues: 0,
    staleIssues: 0,
    completedLast30Days: 0,
    avgOpenAgeDays: 0,
    statusBreakdown: [],
    projectBreakdown: [],
    priorityBreakdown: [],
    assigneeBreakdown: [],
    topRisks: [],
  },
};

export const readJiraWorkspace = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const jiraPath = path.join(dir, "jira-workspace.json");
    if (!fs.existsSync(jiraPath)) return DEFAULT_JIRA_WORKSPACE_STORE;

    try {
      return JSON.parse(fs.readFileSync(jiraPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read jira-workspace.json:", error);
      return DEFAULT_JIRA_WORKSPACE_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jira_issue_snapshots")
    .select("site_url, synced_at, issues, projects, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Jira workspace: ${error.message}`);
  }

  if (!data) return DEFAULT_JIRA_WORKSPACE_STORE;

  return {
    syncedAt: data.synced_at,
    siteUrl: data.site_url,
    issues: data.issues || [],
    projects: data.projects || [],
    summary: data.summary || DEFAULT_JIRA_WORKSPACE_STORE.summary,
    content: data.content || {},
  };
};

export const writeJiraWorkspace = async ({ siteUrl, issues, projects, summary }) => {
  const store = {
    syncedAt: new Date().toISOString(),
    siteUrl: siteUrl || null,
    issues: Array.isArray(issues) ? issues : [],
    projects: Array.isArray(projects) ? projects : [],
    summary: summary || DEFAULT_JIRA_WORKSPACE_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const jiraPath = path.join(dir, "jira-workspace.json");
    fs.writeFileSync(jiraPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("jira_issue_snapshots").insert({
    site_url: store.siteUrl,
    synced_at: store.syncedAt,
    issues: store.issues,
    projects: store.projects,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Jira workspace: ${error.message}`);
  }

  return store;
};

// ==========================================
// CONFLUENCE KNOWLEDGE / ROADMAP STORE
// ==========================================

const DEFAULT_CONFLUENCE_WORKSPACE_STORE = {
  syncedAt: null,
  siteUrl: null,
  pages: [],
  spaces: [],
  summary: {
    totalPages: 0,
    recentlyUpdated: 0,
    stalePages: 0,
    roadmapPages: 0,
    policyPages: 0,
    knowledgeOwners: 0,
    spaceBreakdown: [],
    ownerBreakdown: [],
    typeBreakdown: [],
    topPages: [],
  },
};

export const readConfluenceWorkspace = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const confluencePath = path.join(dir, "confluence-workspace.json");
    if (!fs.existsSync(confluencePath)) return DEFAULT_CONFLUENCE_WORKSPACE_STORE;

    try {
      return JSON.parse(fs.readFileSync(confluencePath, "utf-8"));
    } catch (error) {
      console.error("Failed to read confluence-workspace.json:", error);
      return DEFAULT_CONFLUENCE_WORKSPACE_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("confluence_content_snapshots")
    .select("site_url, synced_at, pages, spaces, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Confluence workspace: ${error.message}`);
  }

  if (!data) return DEFAULT_CONFLUENCE_WORKSPACE_STORE;

  return {
    syncedAt: data.synced_at,
    siteUrl: data.site_url,
    pages: data.pages || [],
    spaces: data.spaces || [],
    summary: data.summary || DEFAULT_CONFLUENCE_WORKSPACE_STORE.summary,
    content: data.content || {},
  };
};

export const writeConfluenceWorkspace = async ({ siteUrl, pages, spaces, summary }) => {
  const store = {
    syncedAt: new Date().toISOString(),
    siteUrl: siteUrl || null,
    pages: Array.isArray(pages) ? pages : [],
    spaces: Array.isArray(spaces) ? spaces : [],
    summary: summary || DEFAULT_CONFLUENCE_WORKSPACE_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const confluencePath = path.join(dir, "confluence-workspace.json");
    fs.writeFileSync(confluencePath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("confluence_content_snapshots").insert({
    site_url: store.siteUrl,
    synced_at: store.syncedAt,
    pages: store.pages,
    spaces: store.spaces,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Confluence workspace: ${error.message}`);
  }

  return store;
};

// ==========================================
// GITHUB REPOSITORY / PR / BUG STORE
// ==========================================

const DEFAULT_GITHUB_WORKSPACE_STORE = {
  syncedAt: null,
  owner: null,
  repositories: [],
  pullRequests: [],
  issues: [],
  summary: {
    totalRepositories: 0,
    openPullRequests: 0,
    mergedPullRequests: 0,
    draftPullRequests: 0,
    stalePullRequests: 0,
    openIssues: 0,
    openBugs: 0,
    staleIssues: 0,
    closedIssuesLast30Days: 0,
    prsByRepo: [],
    issuesByRepo: [],
    bugsByRepo: [],
    languageBreakdown: [],
    topRisks: [],
  },
};

export const readGitHubWorkspace = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const githubPath = path.join(dir, "github-workspace.json");
    if (!fs.existsSync(githubPath)) return DEFAULT_GITHUB_WORKSPACE_STORE;

    try {
      return JSON.parse(fs.readFileSync(githubPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read github-workspace.json:", error);
      return DEFAULT_GITHUB_WORKSPACE_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("github_repo_snapshots")
    .select("owner, synced_at, repositories, pull_requests, issues, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read GitHub workspace: ${error.message}`);
  }

  if (!data) return DEFAULT_GITHUB_WORKSPACE_STORE;

  return {
    syncedAt: data.synced_at,
    owner: data.owner,
    repositories: data.repositories || [],
    pullRequests: data.pull_requests || [],
    issues: data.issues || [],
    summary: data.summary || DEFAULT_GITHUB_WORKSPACE_STORE.summary,
    content: data.content || {},
  };
};

export const writeGitHubWorkspace = async ({
  owner,
  repositories,
  pullRequests,
  issues,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    owner: owner || null,
    repositories: Array.isArray(repositories) ? repositories : [],
    pullRequests: Array.isArray(pullRequests) ? pullRequests : [],
    issues: Array.isArray(issues) ? issues : [],
    summary: summary || DEFAULT_GITHUB_WORKSPACE_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const githubPath = path.join(dir, "github-workspace.json");
    fs.writeFileSync(githubPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("github_repo_snapshots").insert({
    owner: store.owner,
    synced_at: store.syncedAt,
    repositories: store.repositories,
    pull_requests: store.pullRequests,
    issues: store.issues,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save GitHub workspace: ${error.message}`);
  }

  return store;
};

// ==========================================
// ASANA WORKSPACE / PROJECT / TASK STORE
// ==========================================

const DEFAULT_ASANA_WORKSPACE_STORE = {
  syncedAt: null,
  workspaceGid: null,
  workspaceName: null,
  projects: [],
  tasks: [],
  summary: {
    totalProjects: 0,
    totalTasks: 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    dueSoonTasks: 0,
    staleTasks: 0,
    unassignedTasks: 0,
    avgOpenAgeDays: 0,
    statusBreakdown: [],
    projectBreakdown: [],
    ownerBreakdown: [],
    topRisks: [],
  },
};

export const readAsanaWorkspace = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const asanaPath = path.join(dir, "asana-workspace.json");
    if (!fs.existsSync(asanaPath)) return DEFAULT_ASANA_WORKSPACE_STORE;

    try {
      return JSON.parse(fs.readFileSync(asanaPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read asana-workspace.json:", error);
      return DEFAULT_ASANA_WORKSPACE_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("asana_workspace_snapshots")
    .select("workspace_gid, workspace_name, synced_at, projects, tasks, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Asana workspace: ${error.message}`);
  }

  if (!data) return DEFAULT_ASANA_WORKSPACE_STORE;

  return {
    syncedAt: data.synced_at,
    workspaceGid: data.workspace_gid,
    workspaceName: data.workspace_name,
    projects: data.projects || [],
    tasks: data.tasks || [],
    summary: data.summary || DEFAULT_ASANA_WORKSPACE_STORE.summary,
    content: data.content || {},
  };
};

export const writeAsanaWorkspace = async ({
  workspaceGid,
  workspaceName,
  projects,
  tasks,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    workspaceGid: workspaceGid || null,
    workspaceName: workspaceName || null,
    projects: Array.isArray(projects) ? projects : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    summary: summary || DEFAULT_ASANA_WORKSPACE_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const asanaPath = path.join(dir, "asana-workspace.json");
    fs.writeFileSync(asanaPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("asana_workspace_snapshots").insert({
    workspace_gid: store.workspaceGid,
    workspace_name: store.workspaceName,
    synced_at: store.syncedAt,
    projects: store.projects,
    tasks: store.tasks,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Asana workspace: ${error.message}`);
  }

  return store;
};

// ==========================================
// MAILCHIMP MARKETING / AUDIENCE / CAMPAIGN STORE
// ==========================================

const DEFAULT_MAILCHIMP_MARKETING_STORE = {
  syncedAt: null,
  accountId: null,
  accountName: null,
  audiences: [],
  campaigns: [],
  reports: [],
  summary: {
    totalAudiences: 0,
    totalContacts: 0,
    subscribedContacts: 0,
    unsubscribedContacts: 0,
    cleanedContacts: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    totalCampaigns: 0,
    sentCampaigns: 0,
    scheduledCampaigns: 0,
    draftCampaigns: 0,
    totalEmailsSent: 0,
    totalOpens: 0,
    totalClicks: 0,
    totalUnsubscribes: 0,
    totalBounces: 0,
    audienceBreakdown: [],
    campaignStatusBreakdown: [],
    campaignPerformance: [],
    topRisks: [],
  },
};

export const readMailchimpMarketing = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const mailchimpPath = path.join(dir, "mailchimp-marketing.json");
    if (!fs.existsSync(mailchimpPath)) return DEFAULT_MAILCHIMP_MARKETING_STORE;

    try {
      return JSON.parse(fs.readFileSync(mailchimpPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read mailchimp-marketing.json:", error);
      return DEFAULT_MAILCHIMP_MARKETING_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("mailchimp_marketing_snapshots")
    .select("account_id, account_name, synced_at, audiences, campaigns, reports, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Mailchimp marketing snapshot: ${error.message}`);
  }

  if (!data) return DEFAULT_MAILCHIMP_MARKETING_STORE;

  return {
    syncedAt: data.synced_at,
    accountId: data.account_id,
    accountName: data.account_name,
    audiences: data.audiences || [],
    campaigns: data.campaigns || [],
    reports: data.reports || [],
    summary: data.summary || DEFAULT_MAILCHIMP_MARKETING_STORE.summary,
    content: data.content || {},
  };
};

export const writeMailchimpMarketing = async ({
  accountId,
  accountName,
  audiences,
  campaigns,
  reports,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    accountId: accountId || null,
    accountName: accountName || null,
    audiences: Array.isArray(audiences) ? audiences : [],
    campaigns: Array.isArray(campaigns) ? campaigns : [],
    reports: Array.isArray(reports) ? reports : [],
    summary: summary || DEFAULT_MAILCHIMP_MARKETING_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const mailchimpPath = path.join(dir, "mailchimp-marketing.json");
    fs.writeFileSync(mailchimpPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("mailchimp_marketing_snapshots").insert({
    account_id: store.accountId,
    account_name: store.accountName,
    synced_at: store.syncedAt,
    audiences: store.audiences,
    campaigns: store.campaigns,
    reports: store.reports,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Mailchimp marketing snapshot: ${error.message}`);
  }

  return store;
};

// ==========================================
// QUICKBOOKS ACCOUNTING / ACCOUNT / REPORT STORE
// ==========================================

const DEFAULT_QUICKBOOKS_ACCOUNTING_STORE = {
  syncedAt: null,
  realmId: null,
  companyName: null,
  environment: "sandbox",
  accounts: [],
  reports: {},
  summary: {
    totalAccounts: 0,
    activeAccounts: 0,
    bankAccounts: 0,
    arBalance: 0,
    apBalance: 0,
    incomeBalance: 0,
    expenseBalance: 0,
    assetBalance: 0,
    liabilityBalance: 0,
    equityBalance: 0,
    netIncome: 0,
    cashBalance: 0,
    accountTypeBreakdown: [],
    balanceBreakdown: [],
    topAccounts: [],
    topRisks: [],
  },
};

export const readQuickBooksAccounting = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const quickbooksPath = path.join(dir, "quickbooks-accounting.json");
    if (!fs.existsSync(quickbooksPath)) return DEFAULT_QUICKBOOKS_ACCOUNTING_STORE;

    try {
      return JSON.parse(fs.readFileSync(quickbooksPath, "utf-8"));
    } catch (error) {
      console.error("Failed to read quickbooks-accounting.json:", error);
      return DEFAULT_QUICKBOOKS_ACCOUNTING_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("quickbooks_accounting_snapshots")
    .select("realm_id, company_name, environment, synced_at, accounts, reports, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read QuickBooks accounting snapshot: ${error.message}`);
  }

  if (!data) return DEFAULT_QUICKBOOKS_ACCOUNTING_STORE;

  return {
    syncedAt: data.synced_at,
    realmId: data.realm_id,
    companyName: data.company_name,
    environment: data.environment || "sandbox",
    accounts: data.accounts || [],
    reports: data.reports || {},
    summary: data.summary || DEFAULT_QUICKBOOKS_ACCOUNTING_STORE.summary,
    content: data.content || {},
  };
};

export const writeQuickBooksAccounting = async ({
  realmId,
  companyName,
  environment,
  accounts,
  reports,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    realmId: realmId || null,
    companyName: companyName || null,
    environment: environment || "sandbox",
    accounts: Array.isArray(accounts) ? accounts : [],
    reports: reports || {},
    summary: summary || DEFAULT_QUICKBOOKS_ACCOUNTING_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const quickbooksPath = path.join(dir, "quickbooks-accounting.json");
    fs.writeFileSync(quickbooksPath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("quickbooks_accounting_snapshots").insert({
    realm_id: store.realmId,
    company_name: store.companyName,
    environment: store.environment,
    synced_at: store.syncedAt,
    accounts: store.accounts,
    reports: store.reports,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save QuickBooks accounting snapshot: ${error.message}`);
  }

  return store;
};

// ==========================================
// SALESFORCE CRM / ACCOUNT / OPPORTUNITY STORE
// ==========================================

const DEFAULT_SALESFORCE_CRM_STORE = {
  syncedAt: null,
  instanceUrl: null,
  organizationId: null,
  organizationName: null,
  accounts: [],
  opportunities: [],
  leads: [],
  summary: {
    totalAccounts: 0,
    totalLeads: 0,
    openLeads: 0,
    totalOpportunities: 0,
    openOpportunities: 0,
    closedWonAmount: 0,
    openPipelineAmount: 0,
    weightedPipelineAmount: 0,
    forecastThisQuarter: 0,
    staleOpportunities: 0,
    overdueCloseOpportunities: 0,
    avgDealSize: 0,
    winRate: null,
    stageBreakdown: [],
    ownerBreakdown: [],
    leadSourceBreakdown: [],
    topOpenOpportunities: [],
    topRisks: [],
  },
};

export const readSalesforceCrm = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const salesforcePath = path.join(dir, "salesforce-crm.json");
    if (!fs.existsSync(salesforcePath)) return DEFAULT_SALESFORCE_CRM_STORE;

    try {
      return JSON.parse(fs.readFileSync(salesforcePath, "utf-8"));
    } catch (error) {
      console.error("Failed to read salesforce-crm.json:", error);
      return DEFAULT_SALESFORCE_CRM_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("salesforce_crm_snapshots")
    .select("instance_url, organization_id, organization_name, synced_at, accounts, opportunities, leads, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Salesforce CRM snapshot: ${error.message}`);
  }

  if (!data) return DEFAULT_SALESFORCE_CRM_STORE;

  return {
    syncedAt: data.synced_at,
    instanceUrl: data.instance_url,
    organizationId: data.organization_id,
    organizationName: data.organization_name,
    accounts: data.accounts || [],
    opportunities: data.opportunities || [],
    leads: data.leads || [],
    summary: data.summary || DEFAULT_SALESFORCE_CRM_STORE.summary,
    content: data.content || {},
  };
};

export const writeSalesforceCrm = async ({
  instanceUrl,
  organizationId,
  organizationName,
  accounts,
  opportunities,
  leads,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    instanceUrl: instanceUrl || null,
    organizationId: organizationId || null,
    organizationName: organizationName || null,
    accounts: Array.isArray(accounts) ? accounts : [],
    opportunities: Array.isArray(opportunities) ? opportunities : [],
    leads: Array.isArray(leads) ? leads : [],
    summary: summary || DEFAULT_SALESFORCE_CRM_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const salesforcePath = path.join(dir, "salesforce-crm.json");
    fs.writeFileSync(salesforcePath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("salesforce_crm_snapshots").insert({
    instance_url: store.instanceUrl,
    organization_id: store.organizationId,
    organization_name: store.organizationName,
    synced_at: store.syncedAt,
    accounts: store.accounts,
    opportunities: store.opportunities,
    leads: store.leads,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Salesforce CRM snapshot: ${error.message}`);
  }

  return store;
};

// ==========================================
// STRIPE PAYMENTS / CUSTOMER / REVENUE STORE
// ==========================================

const DEFAULT_STRIPE_PAYMENTS_STORE = {
  syncedAt: null,
  accountId: null,
  accountName: null,
  customers: [],
  paymentIntents: [],
  subscriptions: [],
  invoices: [],
  balance: {},
  summary: {
    totalCustomers: 0,
    delinquentCustomers: 0,
    totalPaymentIntents: 0,
    successfulPayments: 0,
    failedPayments: 0,
    totalPaymentVolume: 0,
    availableBalance: 0,
    pendingBalance: 0,
    activeSubscriptions: 0,
    trialingSubscriptions: 0,
    canceledSubscriptions: 0,
    mrr: 0,
    openInvoices: 0,
    overdueInvoices: 0,
    paidInvoices: 0,
    totalInvoiceAmount: 0,
    paymentStatusBreakdown: [],
    subscriptionStatusBreakdown: [],
    invoiceStatusBreakdown: [],
    revenueByCurrency: [],
    topInvoices: [],
    topRisks: [],
  },
};

export const readStripePayments = async () => {
  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const stripePath = path.join(dir, "stripe-payments.json");
    if (!fs.existsSync(stripePath)) return DEFAULT_STRIPE_PAYMENTS_STORE;

    try {
      return JSON.parse(fs.readFileSync(stripePath, "utf-8"));
    } catch (error) {
      console.error("Failed to read stripe-payments.json:", error);
      return DEFAULT_STRIPE_PAYMENTS_STORE;
    }
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stripe_payments_snapshots")
    .select("account_id, account_name, synced_at, customers, payment_intents, subscriptions, invoices, balance, summary, content")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Stripe payments snapshot: ${error.message}`);
  }

  if (!data) return DEFAULT_STRIPE_PAYMENTS_STORE;

  return {
    syncedAt: data.synced_at,
    accountId: data.account_id,
    accountName: data.account_name,
    customers: data.customers || [],
    paymentIntents: data.payment_intents || [],
    subscriptions: data.subscriptions || [],
    invoices: data.invoices || [],
    balance: data.balance || {},
    summary: data.summary || DEFAULT_STRIPE_PAYMENTS_STORE.summary,
    content: data.content || {},
  };
};

export const writeStripePayments = async ({
  accountId,
  accountName,
  customers,
  paymentIntents,
  subscriptions,
  invoices,
  balance,
  summary,
}) => {
  const store = {
    syncedAt: new Date().toISOString(),
    accountId: accountId || null,
    accountName: accountName || null,
    customers: Array.isArray(customers) ? customers : [],
    paymentIntents: Array.isArray(paymentIntents) ? paymentIntents : [],
    subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
    invoices: Array.isArray(invoices) ? invoices : [],
    balance: balance || {},
    summary: summary || DEFAULT_STRIPE_PAYMENTS_STORE.summary,
  };

  if (!isSupabaseConfigured) {
    const dir = getLocalDataDir();
    const stripePath = path.join(dir, "stripe-payments.json");
    fs.writeFileSync(stripePath, JSON.stringify(store, null, 2), "utf-8");
    return store;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("stripe_payments_snapshots").insert({
    account_id: store.accountId,
    account_name: store.accountName,
    synced_at: store.syncedAt,
    customers: store.customers,
    payment_intents: store.paymentIntents,
    subscriptions: store.subscriptions,
    invoices: store.invoices,
    balance: store.balance,
    summary: store.summary,
    content: store,
  });

  if (error) {
    throw new Error(`Unable to save Stripe payments snapshot: ${error.message}`);
  }

  return store;
};
