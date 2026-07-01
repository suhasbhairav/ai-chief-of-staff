import { NextResponse } from "next/server";
import { createBoardMemoRecord } from "@/lib/current-data-store";

export async function POST(request) {
  try {
    const memo = await request.json();

    if (!memo?.title) {
      return NextResponse.json(
        { error: "Board memo title is required." },
        { status: 400 }
      );
    }

    const record = await createBoardMemoRecord(memo);

    return NextResponse.json({
      id: record.id,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save board memo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
