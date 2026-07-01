import { NextResponse } from "next/server";
import { readSalesforceCrm, writeSalesforceCrm } from "@/lib/current-data-store";
import {
  fetchSalesforceAccounts,
  fetchSalesforceLeads,
  fetchSalesforceOpportunities,
  getSalesforceConfig,
  normalizeSalesforceAccounts,
  normalizeSalesforceLeads,
  normalizeSalesforceOpportunities,
  summarizeSalesforceCrm,
  validateSalesforceToken,
} from "@/lib/salesforce/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readSalesforceCrm(), getSalesforceConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.instanceUrl && config.accessToken),
      fromEnv: config.fromEnv,
      instanceUrl: config.instanceUrl || store.instanceUrl,
      apiVersion: config.apiVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Salesforce overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getSalesforceConfig();
    if (!config.instanceUrl || !config.accessToken) {
      return NextResponse.json(
        {
          error:
            "Salesforce is not configured. Add SALESFORCE_INSTANCE_URL and SALESFORCE_ACCESS_TOKEN in Vercel, or connect Salesforce from Integrations.",
        },
        { status: 400 }
      );
    }

    const [org, rawAccounts, rawOpportunities, rawLeads] = await Promise.all([
      validateSalesforceToken(config),
      fetchSalesforceAccounts(config),
      fetchSalesforceOpportunities(config),
      fetchSalesforceLeads(config),
    ]);

    const accounts = normalizeSalesforceAccounts(rawAccounts);
    const opportunities = normalizeSalesforceOpportunities(rawOpportunities);
    const leads = normalizeSalesforceLeads(rawLeads);
    const summary = summarizeSalesforceCrm({ accounts, opportunities, leads });

    const store = await writeSalesforceCrm({
      instanceUrl: config.instanceUrl,
      organizationId: org.organizationId,
      organizationName: org.organizationName,
      accounts,
      opportunities,
      leads,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
      apiVersion: config.apiVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Salesforce overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
