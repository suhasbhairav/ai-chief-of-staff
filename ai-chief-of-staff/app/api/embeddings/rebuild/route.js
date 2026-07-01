import { NextResponse } from "next/server";
import { readOrganizationSummary } from "@/lib/current-data-store";
import { upsertDepartmentEmbeddings } from "@/lib/llm/department-embeddings";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const departmentId = body.departmentId || "all";
    const summary = await readOrganizationSummary();
    const snapshots = Object.values(summary.departments || {}).filter(
      (snapshot) => departmentId === "all" || snapshot.departmentId === departmentId
    );

    if (!snapshots.length) {
      return NextResponse.json({
        rebuilt: 0,
        message: "No department snapshots found to embed.",
      });
    }

    const results = [];
    for (const snapshot of snapshots) {
      results.push({
        departmentId: snapshot.departmentId,
        ...(await upsertDepartmentEmbeddings(snapshot)),
      });
    }

    return NextResponse.json({
      rebuilt: results.reduce((sum, result) => sum + (result.count || 0), 0),
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to rebuild embeddings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
