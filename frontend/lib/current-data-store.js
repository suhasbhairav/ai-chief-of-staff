import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = createSupabaseServerClient();
  const normalized = normalizeDepartmentSnapshot(snapshot);
  const { periodStart, periodEnd } = getPeriodBounds(
    normalized.records,
    normalized.headers
  );

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
