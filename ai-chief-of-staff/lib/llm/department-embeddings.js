import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  normalizeModelText,
  wrapUntrustedData,
} from "@/lib/llm/guardrails";
import { createTextEmbedding } from "@/lib/llm/server";

const MAX_CHUNK_CHARS = 5500;

const stableSourceId = (snapshot) =>
  `${snapshot.departmentId}:${snapshot.uploadedAt || snapshot.filename || "current"}`;

const chunkText = (text, maxChars = MAX_CHUNK_CHARS) => {
  const normalized = normalizeModelText(text, 60000);
  const chunks = [];

  for (let index = 0; index < normalized.length; index += maxChars) {
    chunks.push(normalized.slice(index, index + maxChars));
  }

  return chunks.length ? chunks : [normalized];
};

const snapshotToSearchText = (snapshot) => {
  const sampleRows = (snapshot.records || []).slice(0, 40);
  const summary = {
    departmentId: snapshot.departmentId,
    departmentName: snapshot.departmentName,
    filename: snapshot.filename,
    uploadedAt: snapshot.uploadedAt,
    headers: snapshot.headers,
    recordCount: snapshot.recordCount,
    sampleRows,
  };

  return `Department operating data for ${snapshot.departmentName}.
Use this as factual evidence for CEO analysis.
${wrapUntrustedData("department-operating-snapshot", summary, 60000)}`;
};

export const createEmbedding = async (input) => {
  return createTextEmbedding(normalizeModelText(input, 60000));
};

export const upsertDepartmentEmbeddings = async (snapshot) => {
  if (!isSupabaseConfigured) return { skipped: true, reason: "Supabase is not configured." };

  const supabase = createSupabaseServerClient();
  const sourceId = stableSourceId(snapshot);
  const chunks = chunkText(snapshotToSearchText(snapshot));

  const rows = await Promise.all(
    chunks.map(async (content, chunkIndex) => ({
      department_id: snapshot.departmentId,
      department_name: snapshot.departmentName,
      source_type: "department_snapshot",
      source_id: sourceId,
      chunk_index: chunkIndex,
      content,
      metadata: {
        filename: snapshot.filename,
        uploadedAt: snapshot.uploadedAt,
        headers: snapshot.headers || [],
        recordCount: snapshot.recordCount || 0,
      },
      embedding: await createEmbedding(content),
    }))
  );

  const { error } = await supabase
    .from("department_embeddings")
    .upsert(rows, {
      onConflict: "department_id,source_type,source_id,chunk_index",
    });

  if (error) {
    throw new Error(`Unable to upsert department embeddings: ${error.message}`);
  }

  return { skipped: false, count: rows.length };
};

export const searchDepartmentEmbeddings = async ({
  query,
  departmentId,
  matchCount = 8,
}) => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is required for vector search.");
  }

  const supabase = createSupabaseServerClient();
  const queryEmbedding = await createEmbedding(query);
  const { data, error } = await supabase.rpc("match_department_embeddings", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    department_filter: departmentId && departmentId !== "all" ? departmentId : null,
  });

  if (error) {
    throw new Error(`Unable to search department embeddings: ${error.message}`);
  }

  return data || [];
};
