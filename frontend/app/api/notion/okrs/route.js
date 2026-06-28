import { NextResponse } from "next/server";
import { readNotionOkrs, writeNotionOkrs } from "@/lib/current-data-store";
import {
  fetchNotionOkrs,
  getNotionConfig,
  summarizeOkrs,
} from "@/lib/notion/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readNotionOkrs(), getNotionConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.apiKey && config.databaseId),
      databaseId: config.databaseId || store.databaseId,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Notion OKRs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getNotionConfig();
    if (!config.apiKey || !config.databaseId) {
      return NextResponse.json(
        {
          error:
            "Notion is not configured. Add NOTION_API_KEY and NOTION_OKR_DATABASE_ID in Vercel or connect Notion in Integrations.",
        },
        { status: 400 }
      );
    }

    const okrs = await fetchNotionOkrs({
      apiKey: config.apiKey,
      databaseId: config.databaseId,
    });
    const summary = summarizeOkrs(okrs);
    const store = await writeNotionOkrs({
      databaseId: config.databaseId,
      okrs,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Notion OKRs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
