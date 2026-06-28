import { NextResponse } from "next/server";
import { readConfluenceWorkspace, writeConfluenceWorkspace } from "@/lib/current-data-store";
import {
  fetchConfluencePages,
  fetchConfluenceSpaces,
  getConfluenceConfig,
  normalizeConfluencePages,
  normalizeConfluenceSpaces,
  summarizeConfluenceWorkspace,
} from "@/lib/atlassian/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([
      readConfluenceWorkspace(),
      getConfluenceConfig(),
    ]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.authHeader && config.siteUrl),
      fromEnv: config.fromEnv,
      siteUrl: config.siteUrl || store.siteUrl,
      cql: config.cql,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Confluence overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getConfluenceConfig();
    if (!config.siteUrl || !config.authHeader) {
      return NextResponse.json(
        {
          error:
            "Confluence is not configured. Add ATLASSIAN_SITE_URL, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN in Vercel or connect Confluence from Integrations.",
        },
        { status: 400 }
      );
    }

    const [rawSpaces, rawPages] = await Promise.all([
      fetchConfluenceSpaces({ siteUrl: config.siteUrl, authHeader: config.authHeader }),
      fetchConfluencePages({ siteUrl: config.siteUrl, authHeader: config.authHeader, cql: config.cql }),
    ]);
    const spaces = normalizeConfluenceSpaces(rawSpaces);
    const pages = normalizeConfluencePages(rawPages, config.siteUrl);
    const summary = summarizeConfluenceWorkspace({ pages, spaces });
    const store = await writeConfluenceWorkspace({
      siteUrl: config.siteUrl,
      pages,
      spaces,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      cql: config.cql,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Confluence overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
