import { NextResponse } from "next/server";
import { readXeroAccounting, writeXeroAccounting } from "@/lib/current-data-store";
import {
  fetchXeroAccounts,
  fetchXeroBankTransactions,
  fetchXeroContacts,
  fetchXeroInvoices,
  fetchXeroOrganisation,
  getXeroConfig,
  normalizeXeroAccounts,
  normalizeXeroBankTransactions,
  normalizeXeroContacts,
  normalizeXeroInvoices,
  resolveXeroAccessToken,
  summarizeXeroAccounting,
  validateXeroCredentials,
} from "@/lib/xero/server";

export async function GET() {
  try {
    const [store, config] = await Promise.all([readXeroAccounting(), getXeroConfig()]);
    return NextResponse.json({
      ...store,
      connected: Boolean(config.tenantId && (config.accessToken || config.refreshToken)),
      fromEnv: config.fromEnv,
      tenantId: config.tenantId || store.tenantId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Xero overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getXeroConfig();
    const accessToken = await resolveXeroAccessToken(config);
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "Xero is not configured. Add XERO_ACCESS_TOKEN or refresh-token credentials in Vercel, connect OAuth, or paste a token in Integrations.",
        },
        { status: 400 }
      );
    }

    const tenant = await validateXeroCredentials({
      accessToken,
      tenantId: config.tenantId,
    });
    const runtimeConfig = { ...config, accessToken, tenantId: tenant.tenantId };
    const [organisation, rawAccounts, rawContacts, rawInvoices, rawBankTransactions] =
      await Promise.all([
        fetchXeroOrganisation(runtimeConfig),
        fetchXeroAccounts(runtimeConfig),
        fetchXeroContacts(runtimeConfig),
        fetchXeroInvoices(runtimeConfig),
        fetchXeroBankTransactions(runtimeConfig).catch((error) => ({ error: error.message, items: [] })),
      ]);

    const accounts = normalizeXeroAccounts(rawAccounts);
    const contacts = normalizeXeroContacts(rawContacts);
    const invoices = normalizeXeroInvoices(rawInvoices);
    const bankTransactions = Array.isArray(rawBankTransactions)
      ? normalizeXeroBankTransactions(rawBankTransactions)
      : [];
    const summary = summarizeXeroAccounting({
      accounts,
      contacts,
      invoices,
      bankTransactions,
    });

    const store = await writeXeroAccounting({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      organisation,
      accounts,
      contacts,
      invoices,
      bankTransactions,
      summary,
    });

    return NextResponse.json({
      ...store,
      connected: true,
      fromEnv: config.fromEnv,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync Xero overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
