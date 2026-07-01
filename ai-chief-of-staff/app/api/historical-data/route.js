import { NextResponse } from "next/server";
import { readHistoricalImports } from "@/lib/current-data-store";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const history = await readHistoricalImports({ departmentId });

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      history,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read historical data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
