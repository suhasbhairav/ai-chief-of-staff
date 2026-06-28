import { NextResponse } from "next/server";
import { readLinearTickets, writeLinearTickets } from "@/lib/current-data-store";
import {
  fetchLinearIssues,
  getLinearConfig,
  normalizeLinearIssues,
  summarizeLinearIssues,
  validateLinearToken,
} from "@/lib/linear/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readLinearTickets(), getLinearConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.apiKey),
      fromEnv: config.fromEnv,
      organizationName: config.integration?.organization_name || store.organizationName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Linear tickets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getLinearConfig();
    if (!config.apiKey) {
      return NextResponse.json(
        {
          error:
            "Linear is not configured. Add LINEAR_API_KEY in Vercel or connect Linear in Integrations.",
        },
        { status: 400 }
      );
    }

    const [account, rawIssues] = await Promise.all([
      validateLinearToken(config.apiKey),
      fetchLinearIssues(config.apiKey),
    ]);
    const issues = await normalizeLinearIssues(rawIssues);
    const summary = summarizeLinearIssues(issues);
    const store = await writeLinearTickets({
      organizationId: account.organizationId || config.integration?.organization_id,
      organizationName: account.organizationName || config.integration?.organization_name,
      issues,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Linear tickets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
