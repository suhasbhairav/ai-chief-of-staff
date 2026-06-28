import { NextResponse } from "next/server";
import { readQuickBooksAccounting, writeQuickBooksAccounting } from "@/lib/current-data-store";
import {
  fetchQuickBooksAccounts,
  fetchQuickBooksCompanyInfo,
  fetchQuickBooksReport,
  getQuickBooksConfig,
  normalizeQuickBooksAccounts,
  resolveQuickBooksAccessToken,
  summarizeQuickBooksAccounting,
} from "@/lib/quickbooks/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readQuickBooksAccounting(), getQuickBooksConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.realmId && (config.accessToken || config.refreshToken)),
      fromEnv: config.fromEnv,
      realmId: config.realmId || store.realmId,
      environment: config.environment || store.environment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read QuickBooks overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getQuickBooksConfig();
    const accessToken = await resolveQuickBooksAccessToken(config);
    if (!config.realmId || !accessToken) {
      return NextResponse.json(
        {
          error:
            "QuickBooks is not configured. Add QUICKBOOKS_REALM_ID with QUICKBOOKS_ACCESS_TOKEN or refresh-token credentials in Vercel, or connect QuickBooks from Integrations.",
        },
        { status: 400 }
      );
    }

    const runtimeConfig = { ...config, accessToken };
    const [companyInfo, rawAccounts, profitAndLoss, balanceSheet, cashFlow] = await Promise.all([
      fetchQuickBooksCompanyInfo(runtimeConfig),
      fetchQuickBooksAccounts(runtimeConfig),
      fetchQuickBooksReport(runtimeConfig, "ProfitAndLoss").catch((error) => ({ error: error.message })),
      fetchQuickBooksReport(runtimeConfig, "BalanceSheet").catch((error) => ({ error: error.message })),
      fetchQuickBooksReport(runtimeConfig, "CashFlow").catch((error) => ({ error: error.message })),
    ]);

    const accounts = normalizeQuickBooksAccounts(rawAccounts);
    const reports = {
      profitAndLoss,
      balanceSheet,
      cashFlow,
    };
    const summary = summarizeQuickBooksAccounting({ accounts, reports });

    const store = await writeQuickBooksAccounting({
      realmId: config.realmId,
      companyName: companyInfo.CompanyName || companyInfo.LegalName,
      environment: config.environment,
      accounts,
      reports,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync QuickBooks overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
