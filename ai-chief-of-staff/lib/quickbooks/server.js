import { readIntegrations } from "@/lib/current-data-store";

const clean = (value) => String(value || "").trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const countBy = (items, getKey) => {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

const getBaseUrl = (environment) =>
  environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";

export const getQuickBooksConfig = async () => {
  const integrations = await readIntegrations();
  const quickbooks = integrations.quickbooks || {};
  const environment =
    clean(process.env.QUICKBOOKS_ENVIRONMENT) ||
    clean(quickbooks.environment) ||
    "sandbox";

  return {
    accessToken: clean(process.env.QUICKBOOKS_ACCESS_TOKEN) || quickbooks.access_token,
    refreshToken: clean(process.env.QUICKBOOKS_REFRESH_TOKEN) || quickbooks.refresh_token,
    clientId: clean(process.env.QUICKBOOKS_CLIENT_ID) || quickbooks.client_id,
    clientSecret: clean(process.env.QUICKBOOKS_CLIENT_SECRET) || quickbooks.client_secret,
    realmId: clean(process.env.QUICKBOOKS_REALM_ID) || clean(quickbooks.realm_id),
    environment,
    minorVersion: clean(process.env.QUICKBOOKS_MINOR_VERSION) || clean(quickbooks.minor_version) || "75",
    fromEnv: Boolean(process.env.QUICKBOOKS_ACCESS_TOKEN || process.env.QUICKBOOKS_REFRESH_TOKEN),
    integration: quickbooks,
  };
};

export const refreshQuickBooksAccessToken = async ({ clientId, clientSecret, refreshToken }) => {
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `QuickBooks token refresh failed with ${response.status}`);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresIn: payload.expires_in,
  };
};

export const resolveQuickBooksAccessToken = async (config) => {
  if (config.accessToken) return config.accessToken;
  const refreshed = await refreshQuickBooksAccessToken(config);
  return refreshed?.accessToken || "";
};

const qboApi = async ({ accessToken, realmId, environment, minorVersion, path, params }) => {
  const url = new URL(`${getBaseUrl(environment)}/v3/company/${realmId}${path}`);
  if (minorVersion) url.searchParams.set("minorversion", minorVersion);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const fault = payload.Fault?.Error?.map((error) => error.Message || error.Detail).join(" ");
    throw new Error(fault || payload.message || `QuickBooks API ${path} failed with ${response.status}`);
  }

  return payload;
};

export const validateQuickBooksCredentials = async ({
  accessToken,
  refreshToken,
  clientId,
  clientSecret,
  realmId,
  environment,
  minorVersion,
}) => {
  const token =
    accessToken ||
    (await resolveQuickBooksAccessToken({ refreshToken, clientId, clientSecret }));
  if (!token) {
    throw new Error("QuickBooks access token or refresh token credentials are required.");
  }
  if (!realmId) {
    throw new Error("QuickBooks realm ID is required.");
  }

  const payload = await qboApi({
    accessToken: token,
    realmId,
    environment,
    minorVersion,
    path: `/companyinfo/${realmId}`,
  });
  const info = payload.CompanyInfo || {};
  return {
    accessToken: token,
    realmId,
    companyName: info.CompanyName || info.LegalName || "QuickBooks Company",
    country: info.Country || "",
    email: info.Email?.Address || "",
  };
};

export const fetchQuickBooksCompanyInfo = async (config) => {
  const accessToken = await resolveQuickBooksAccessToken(config);
  const payload = await qboApi({
    accessToken,
    realmId: config.realmId,
    environment: config.environment,
    minorVersion: config.minorVersion,
    path: `/companyinfo/${config.realmId}`,
  });
  return payload.CompanyInfo || {};
};

export const fetchQuickBooksAccounts = async (config) => {
  const accessToken = await resolveQuickBooksAccessToken(config);
  const payload = await qboApi({
    accessToken,
    realmId: config.realmId,
    environment: config.environment,
    minorVersion: config.minorVersion,
    path: "/query",
    params: {
      query: "select * from Account maxresults 1000",
    },
  });
  return payload.QueryResponse?.Account || [];
};

export const fetchQuickBooksReport = async (config, reportName) => {
  const accessToken = await resolveQuickBooksAccessToken(config);
  return qboApi({
    accessToken,
    realmId: config.realmId,
    environment: config.environment,
    minorVersion: config.minorVersion,
    path: `/reports/${reportName}`,
    params: {
      accounting_method: "Accrual",
      summarize_column_by: "Month",
    },
  });
};

const extractReportValue = (report, matcher) => {
  const rows = report?.Rows?.Row || [];
  const stack = [...rows];
  while (stack.length) {
    const row = stack.shift();
    const label = row?.Header?.ColData?.[0]?.value || row?.ColData?.[0]?.value || "";
    if (matcher(label)) {
      const colData = row?.Summary?.ColData || row?.ColData || [];
      const values = colData.slice(1).map((col) => toNumber(col.value));
      return values.reduce((sum, value) => sum + value, 0);
    }
    if (row?.Rows?.Row) stack.push(...row.Rows.Row);
  }
  return 0;
};

export const normalizeQuickBooksAccounts = (accounts) =>
  accounts.map((account) => ({
    id: account.Id,
    name: account.Name || "Unnamed account",
    fullyQualifiedName: account.FullyQualifiedName || account.Name || "Unnamed account",
    active: account.Active !== false,
    classification: account.Classification || "Unknown",
    accountType: account.AccountType || "Unknown",
    accountSubType: account.AccountSubType || "Unknown",
    currentBalance: toNumber(account.CurrentBalance),
    currentBalanceWithSubAccounts: toNumber(account.CurrentBalanceWithSubAccounts),
    currency: account.CurrencyRef?.value || "USD",
  }));

export const summarizeQuickBooksAccounting = ({ accounts, reports }) => {
  const activeAccounts = accounts.filter((account) => account.active);
  const sumBy = (predicate) =>
    activeAccounts
      .filter(predicate)
      .reduce((sum, account) => sum + account.currentBalanceWithSubAccounts, 0);

  const arBalance = sumBy((account) => /accounts receivable/i.test(account.accountType));
  const apBalance = sumBy((account) => /accounts payable/i.test(account.accountType));
  const incomeBalance = sumBy((account) => /income|revenue/i.test(account.classification));
  const expenseBalance = sumBy((account) => /expense/i.test(account.classification));
  const assetBalance = sumBy((account) => /asset/i.test(account.classification));
  const liabilityBalance = sumBy((account) => /liabilit/i.test(account.classification));
  const equityBalance = sumBy((account) => /equity/i.test(account.classification));
  const cashBalance = sumBy((account) => /bank/i.test(account.accountType));
  const netIncome =
    extractReportValue(reports.profitAndLoss, (label) => /net income|net earnings|profit/i.test(label)) ||
    incomeBalance - expenseBalance;

  const topRisks = [
    arBalance > cashBalance * 0.4
      ? {
          id: "ar-concentration",
          title: "Accounts receivable is high relative to cash",
          value: arBalance,
          riskType: "Working capital",
        }
      : null,
    apBalance > cashBalance * 0.35
      ? {
          id: "ap-pressure",
          title: "Accounts payable pressure is material relative to cash",
          value: apBalance,
          riskType: "Liquidity",
        }
      : null,
    netIncome < 0
      ? {
          id: "negative-net-income",
          title: "Net income is negative in the latest QuickBooks report",
          value: netIncome,
          riskType: "Profitability",
        }
      : null,
  ].filter(Boolean);

  return {
    totalAccounts: accounts.length,
    activeAccounts: activeAccounts.length,
    bankAccounts: activeAccounts.filter((account) => /bank/i.test(account.accountType)).length,
    arBalance,
    apBalance,
    incomeBalance,
    expenseBalance,
    assetBalance,
    liabilityBalance,
    equityBalance,
    netIncome,
    cashBalance,
    accountTypeBreakdown: countBy(activeAccounts, (account) => account.accountType),
    balanceBreakdown: [
      { name: "Assets", count: Math.round(assetBalance) },
      { name: "Liabilities", count: Math.round(Math.abs(liabilityBalance)) },
      { name: "Equity", count: Math.round(Math.abs(equityBalance)) },
      { name: "Income", count: Math.round(Math.abs(incomeBalance)) },
      { name: "Expenses", count: Math.round(Math.abs(expenseBalance)) },
    ],
    topAccounts: [...activeAccounts]
      .sort((a, b) => Math.abs(b.currentBalanceWithSubAccounts) - Math.abs(a.currentBalanceWithSubAccounts))
      .slice(0, 15),
    topRisks,
  };
};
