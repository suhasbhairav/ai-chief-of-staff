import { NextResponse } from "next/server";
import { readHubSpotDeals, writeHubSpotDeals } from "@/lib/current-data-store";
import {
  fetchHubSpotDeals,
  fetchHubSpotOwners,
  fetchHubSpotPipelines,
  getHubSpotConfig,
  normalizeHubSpotDeals,
  summarizeHubSpotDeals,
  validateHubSpotToken,
} from "@/lib/hubspot/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readHubSpotDeals(), getHubSpotConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.accessToken),
      fromEnv: config.fromEnv,
      portalId: config.integration?.portal_id || store.portalId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read HubSpot deals.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getHubSpotConfig();
    if (!config.accessToken) {
      return NextResponse.json(
        {
          error:
            "HubSpot is not configured. Add HUBSPOT_ACCESS_TOKEN in Vercel or connect HubSpot in Integrations.",
        },
        { status: 400 }
      );
    }

    const [account, rawDeals, pipelines, owners] = await Promise.all([
      validateHubSpotToken(config.accessToken),
      fetchHubSpotDeals(config.accessToken),
      fetchHubSpotPipelines(config.accessToken),
      fetchHubSpotOwners(config.accessToken),
    ]);
    const deals = normalizeHubSpotDeals({ deals: rawDeals, pipelines, owners });
    const summary = summarizeHubSpotDeals(deals);
    const store = await writeHubSpotDeals({
      portalId: account.portalId || config.integration?.portal_id,
      deals,
      pipelines,
      owners,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync HubSpot deals.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
