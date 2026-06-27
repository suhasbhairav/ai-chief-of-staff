import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  disconnectSlackInstallation,
  readActiveSlackInstallation,
  saveSlackInstallation,
  tokenToPublicIntegration,
} from "@/lib/slack/server";
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
  notion: { connected: false, name: "Notion", icon: "📓" },
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
