import { readIntegrations } from "@/lib/current-data-store";

const IDENTITY_BASE = "https://identity.xero.com";
const API_BASE = "https://api.xero.com";

const clean = (value) => String(value || "").trim();

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseXeroDate = (value) => {
  if (!value) return null;
  const match = String(value).match(/\/Date\((\d+)/);
  if (match) return new Date(Number(match[1])).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const isPast = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) && date < new Date();
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

export const getXeroCredentials = () => ({
  clientId: clean(process.env.XERO_CLIENT_ID),
  clientSecret: clean(process.env.XERO_CLIENT_SECRET),
});

export const createXeroOAuthState = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export const exchangeXeroOAuthCode = async ({ clientId, clientSecret, code, redirectUri }) => {
  const response = await fetch(`${IDENTITY_BASE}/connect/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Xero OAuth exchange failed with ${response.status}`);
  }

  return payload;
};

export const refreshXeroAccessToken = async ({ clientId, clientSecret, refreshToken }) => {
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch(`${IDENTITY_BASE}/connect/token`, {
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
    throw new Error(payload.error_description || payload.error || `Xero token refresh failed with ${response.status}`);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || refreshToken,
    expiresIn: payload.expires_in,
  };
};

export const getXeroConfig = async () => {
  const integrations = await readIntegrations();
  const xero = integrations.xero || {};

  return {
    accessToken: clean(process.env.XERO_ACCESS_TOKEN) || xero.access_token,
    refreshToken: clean(process.env.XERO_REFRESH_TOKEN) || xero.refresh_token,
    clientId: clean(process.env.XERO_CLIENT_ID) || xero.client_id,
    clientSecret: clean(process.env.XERO_CLIENT_SECRET) || xero.client_secret,
    tenantId: clean(process.env.XERO_TENANT_ID) || clean(xero.tenant_id),
    fromEnv: Boolean(process.env.XERO_ACCESS_TOKEN || process.env.XERO_REFRESH_TOKEN),
    integration: xero,
  };
};

export const resolveXeroAccessToken = async (config) => {
  if (config.accessToken) return config.accessToken;
  const refreshed = await refreshXeroAccessToken(config);
  return refreshed?.accessToken || "";
};

export const fetchXeroConnections = async (accessToken) => {
  const response = await fetch(`${API_BASE}/connections`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await response.json().catch(() => ([]));

  if (!response.ok) {
    throw new Error(payload.Detail || payload.Message || payload.error || `Xero connections failed with ${response.status}`);
  }

  return Array.isArray(payload) ? payload : [];
};

const xeroAccountingApi = async ({ accessToken, tenantId, path, params }) => {
  const url = new URL(`${API_BASE}/api.xro/2.0/${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.Detail || payload.Message || payload.error || `Xero Accounting API ${path} failed with ${response.status}`);
  }

  return payload;
};

export const validateXeroCredentials = async ({ accessToken, refreshToken, clientId, clientSecret, tenantId }) => {
  const token = accessToken || (await resolveXeroAccessToken({ refreshToken, clientId, clientSecret }));
  if (!token) throw new Error("Xero access token or refresh token credentials are required.");

  const connections = await fetchXeroConnections(token);
  const tenant =
    connections.find((connection) => connection.tenantId === tenantId) ||
    connections[0];

  if (!tenant?.tenantId) {
    throw new Error("No Xero tenant was found for this token.");
  }

  return {
    accessToken: token,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || tenant.organisationName || "Xero Organisation",
  };
};

export const fetchXeroOrganisation = async (config) => {
  const accessToken = await resolveXeroAccessToken(config);
  const payload = await xeroAccountingApi({
    accessToken,
    tenantId: config.tenantId,
    path: "Organisation",
  });
  return payload.Organisations?.[0] || {};
};

export const fetchXeroAccounts = async (config) => {
  const accessToken = await resolveXeroAccessToken(config);
  const payload = await xeroAccountingApi({
    accessToken,
    tenantId: config.tenantId,
    path: "Accounts",
  });
  return payload.Accounts || [];
};

export const fetchXeroContacts = async (config) => {
  const accessToken = await resolveXeroAccessToken(config);
  const payload = await xeroAccountingApi({
    accessToken,
    tenantId: config.tenantId,
    path: "Contacts",
    params: { page: 1 },
  });
  return payload.Contacts || [];
};

export const fetchXeroInvoices = async (config) => {
  const accessToken = await resolveXeroAccessToken(config);
  const payload = await xeroAccountingApi({
    accessToken,
    tenantId: config.tenantId,
    path: "Invoices",
    params: { page: 1, order: "UpdatedDateUTC DESC" },
  });
  return payload.Invoices || [];
};

export const fetchXeroBankTransactions = async (config) => {
  const accessToken = await resolveXeroAccessToken(config);
  const payload = await xeroAccountingApi({
    accessToken,
    tenantId: config.tenantId,
    path: "BankTransactions",
    params: { page: 1, order: "UpdatedDateUTC DESC" },
  });
  return payload.BankTransactions || [];
};

export const normalizeXeroAccounts = (accounts) =>
  accounts.map((account) => ({
    id: account.AccountID || account.Code,
    code: account.Code || "",
    name: account.Name || "Unnamed account",
    type: account.Type || "Unknown",
    class: account.Class || "Unknown",
    status: account.Status || "Unknown",
    bankAccountNumber: account.BankAccountNumber || "",
    reportingCodeName: account.ReportingCodeName || "",
    taxType: account.TaxType || "",
  }));

export const normalizeXeroContacts = (contacts) =>
  contacts.map((contact) => ({
    id: contact.ContactID,
    name: contact.Name || "Unnamed contact",
    email: contact.EmailAddress || "",
    status: contact.ContactStatus || "Unknown",
    isCustomer: Boolean(contact.IsCustomer),
    isSupplier: Boolean(contact.IsSupplier),
    updatedAt: parseXeroDate(contact.UpdatedDateUTC),
    balances: contact.Balances || {},
  }));

export const normalizeXeroInvoices = (invoices) =>
  invoices.map((invoice) => ({
    id: invoice.InvoiceID,
    number: invoice.InvoiceNumber || invoice.Reference || "Unnumbered",
    type: invoice.Type || "Unknown",
    status: invoice.Status || "Unknown",
    contactName: invoice.Contact?.Name || "Unknown contact",
    date: parseXeroDate(invoice.Date),
    dueDate: parseXeroDate(invoice.DueDate),
    updatedAt: parseXeroDate(invoice.UpdatedDateUTC),
    currency: invoice.CurrencyCode || "USD",
    total: toNumber(invoice.Total),
    amountDue: toNumber(invoice.AmountDue),
    amountPaid: toNumber(invoice.AmountPaid),
    isOverdue: toNumber(invoice.AmountDue) > 0 && isPast(parseXeroDate(invoice.DueDate)),
  }));

export const normalizeXeroBankTransactions = (transactions) =>
  transactions.map((transaction) => ({
    id: transaction.BankTransactionID,
    type: transaction.Type || "Unknown",
    status: transaction.Status || "Unknown",
    contactName: transaction.Contact?.Name || "Unknown contact",
    date: parseXeroDate(transaction.Date),
    updatedAt: parseXeroDate(transaction.UpdatedDateUTC),
    currency: transaction.CurrencyCode || "USD",
    total: toNumber(transaction.Total),
    reference: transaction.Reference || "",
  }));

export const summarizeXeroAccounting = ({ accounts, contacts, invoices, bankTransactions }) => {
  const activeAccounts = accounts.filter((account) => account.status !== "ARCHIVED");
  const receivableInvoices = invoices.filter((invoice) => invoice.type === "ACCREC");
  const payableInvoices = invoices.filter((invoice) => invoice.type === "ACCPAY");
  const openInvoices = invoices.filter((invoice) => toNumber(invoice.amountDue) > 0);
  const overdueInvoices = openInvoices.filter((invoice) => invoice.isOverdue);
  const bankTransactionVolume = bankTransactions.reduce((sum, item) => sum + Math.abs(item.total), 0);
  const accountsReceivable = receivableInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const accountsPayable = payableInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const topInvoices = [...openInvoices]
    .sort((a, b) => b.amountDue - a.amountDue)
    .slice(0, 15);

  const topRisks = [
    overdueInvoices.length
      ? {
          id: "overdue-invoices",
          title: "Overdue invoices require executive attention",
          value: overdueInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0),
          riskType: "Collections",
        }
      : null,
    accountsPayable > accountsReceivable && accountsPayable > 0
      ? {
          id: "payables-pressure",
          title: "Accounts payable exceeds visible receivables",
          value: accountsPayable,
          riskType: "Working capital",
        }
      : null,
    activeAccounts.filter((account) => /BANK/i.test(account.type)).length === 0
      ? {
          id: "no-bank-accounts",
          title: "No active bank accounts were visible in Xero sync",
          value: 0,
          riskType: "Data coverage",
        }
      : null,
  ].filter(Boolean);

  return {
    totalAccounts: accounts.length,
    bankAccounts: activeAccounts.filter((account) => /BANK/i.test(account.type)).length,
    totalContacts: contacts.length,
    customers: contacts.filter((contact) => contact.isCustomer).length,
    suppliers: contacts.filter((contact) => contact.isSupplier).length,
    openInvoices: openInvoices.length,
    overdueInvoices: overdueInvoices.length,
    paidInvoices: invoices.filter((invoice) => invoice.status === "PAID").length,
    accountsReceivable,
    accountsPayable,
    bankTransactionVolume,
    invoiceStatusBreakdown: countBy(invoices, (invoice) => invoice.status),
    contactTypeBreakdown: [
      { name: "Customers", count: contacts.filter((contact) => contact.isCustomer).length },
      { name: "Suppliers", count: contacts.filter((contact) => contact.isSupplier).length },
      { name: "Other", count: contacts.filter((contact) => !contact.isCustomer && !contact.isSupplier).length },
    ],
    accountTypeBreakdown: countBy(activeAccounts, (account) => account.type),
    topInvoices,
    topRisks,
  };
};
