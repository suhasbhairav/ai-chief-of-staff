import { NextResponse } from "next/server";
import { readMiroBoards, writeMiroBoards } from "@/lib/current-data-store";
import {
  fetchMiroBoards,
  getMiroConfig,
  normalizeMiroBoards,
  summarizeMiroBoards,
} from "@/lib/miro/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readMiroBoards(), getMiroConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.token),
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Miro boards.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getMiroConfig();
    if (!config.token) {
      return NextResponse.json(
        {
          error:
            "Miro is not configured. Add MIRO_ACCESS_TOKEN in Vercel, connect OAuth, or paste an access token in Integrations.",
        },
        { status: 400 }
      );
    }

    const rawBoards = await fetchMiroBoards({ token: config.token, limit: 50 });
    const boards = normalizeMiroBoards(rawBoards);
    const summary = summarizeMiroBoards(boards);
    const store = await writeMiroBoards({
      accountName: config.integration?.first_board_name ? "Miro Workspace" : null,
      boards,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Miro boards.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
