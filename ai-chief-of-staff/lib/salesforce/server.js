import { readIntegrations } from "@/lib/current-data-store";

const clean = (value) => String(value || "").trim();

const stripTrailingSlash = (value) => clean(value).replace(/\/+$/, "");

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const daysBetween = (value, now = new Date()) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

const isBeforeToday = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const isThisQuarter = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === Math.floor(now.getMonth() / 3);
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

export const getSalesforceConfig = async () => {
  const integrations = await readIntegrations();
  const salesforce = integrations.salesforce || {};
  return {
    instanceUrl: stripTrailingSlash(process.env.SALESFORCE_INSTANCE_URL) || stripTrailingSlash(salesforce.instance_url),
    accessToken: clean(process.env.SALESFORCE_ACCESS_TOKEN) || salesforce.access_token,
    apiVersion: clean(process.env.SALESFORCE_API_VERSION) || clean(salesforce.api_version) || "v61.0",
    fromEnv: Boolean(process.env.SALESFORCE_ACCESS_TOKEN),
    integration: salesforce,
  };
};

const salesforceApi = async ({ instanceUrl, accessToken, apiVersion, path, params }) => {
  const url = new URL(`${stripTrailingSlash(instanceUrl)}/services/data/${apiVersion}${path}`);
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
    const message = Array.isArray(payload)
      ? payload.map((item) => item.message).join(" ")
      : payload.message || payload.error_description;
    throw new Error(message || `Salesforce API ${path} failed with ${response.status}`);
  }

  return payload;
};

const soql = async (config, query) =>
  salesforceApi({
    ...config,
    path: "/query",
    params: { q: query },
  }).then((payload) => payload.records || []);

export const validateSalesforceToken = async ({ instanceUrl, accessToken, apiVersion }) => {
  if (!instanceUrl || !accessToken) {
    throw new Error("Salesforce instance URL and access token are required.");
  }
  const records = await soql(
    { instanceUrl, accessToken, apiVersion },
    "SELECT Id, Name FROM Organization LIMIT 1"
  );
  const org = records[0] || {};
  return {
    organizationId: org.Id || null,
    organizationName: org.Name || "Salesforce Org",
  };
};

export const fetchSalesforceAccounts = (config) =>
  soql(
    config,
    "SELECT Id, Name, Type, Industry, AnnualRevenue, NumberOfEmployees, Owner.Name, LastModifiedDate, CreatedDate FROM Account ORDER BY LastModifiedDate DESC LIMIT 200"
  );

export const fetchSalesforceOpportunities = (config) =>
  soql(
    config,
    "SELECT Id, Name, StageName, Amount, Probability, CloseDate, IsClosed, IsWon, Type, LeadSource, ForecastCategoryName, Account.Name, Owner.Name, LastModifiedDate, CreatedDate FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 200"
  );

export const fetchSalesforceLeads = (config) =>
  soql(
    config,
    "SELECT Id, Name, Company, Status, Rating, LeadSource, AnnualRevenue, NumberOfEmployees, IsConverted, ConvertedDate, Owner.Name, LastModifiedDate, CreatedDate FROM Lead ORDER BY LastModifiedDate DESC LIMIT 200"
  );

export const normalizeSalesforceAccounts = (accounts) =>
  accounts.map((account) => ({
    id: account.Id,
    name: account.Name || "Unnamed account",
    type: account.Type || "Unknown",
    industry: account.Industry || "Unknown",
    annualRevenue: toNumber(account.AnnualRevenue),
    employees: toNumber(account.NumberOfEmployees),
    owner: account.Owner?.Name || "Unassigned",
    createdAt: account.CreatedDate || null,
    updatedAt: account.LastModifiedDate || null,
  }));

export const normalizeSalesforceOpportunities = (opportunities) =>
  opportunities.map((opportunity) => {
    const amount = toNumber(opportunity.Amount);
    const probability = toNumber(opportunity.Probability);
    const isOpen = !opportunity.IsClosed;
    const updatedDaysAgo = daysBetween(opportunity.LastModifiedDate);
    return {
      id: opportunity.Id,
      name: opportunity.Name || "Unnamed opportunity",
      accountName: opportunity.Account?.Name || "No account",
      stage: opportunity.StageName || "Unknown",
      amount,
      probability,
      weightedAmount: Math.round(amount * (probability / 100)),
      closeDate: opportunity.CloseDate || null,
      isClosed: Boolean(opportunity.IsClosed),
      isWon: Boolean(opportunity.IsWon),
      isOpen,
      isOverdue: isOpen && isBeforeToday(opportunity.CloseDate),
      isStale: isOpen && (updatedDaysAgo ?? 0) >= 14,
      type: opportunity.Type || "Unknown",
      leadSource: opportunity.LeadSource || "Unknown",
      forecastCategory: opportunity.ForecastCategoryName || "Unknown",
      owner: opportunity.Owner?.Name || "Unassigned",
      createdAt: opportunity.CreatedDate || null,
      updatedAt: opportunity.LastModifiedDate || null,
      updatedDaysAgo,
    };
  });

export const normalizeSalesforceLeads = (leads) =>
  leads.map((lead) => {
    const isOpen = !lead.IsConverted;
    const updatedDaysAgo = daysBetween(lead.LastModifiedDate);
    return {
      id: lead.Id,
      name: lead.Name || "Unnamed lead",
      company: lead.Company || "Unknown",
      status: lead.Status || "Unknown",
      rating: lead.Rating || "Unknown",
      leadSource: lead.LeadSource || "Unknown",
      annualRevenue: toNumber(lead.AnnualRevenue),
      employees: toNumber(lead.NumberOfEmployees),
      isConverted: Boolean(lead.IsConverted),
      convertedAt: lead.ConvertedDate || null,
      isOpen,
      isStale: isOpen && (updatedDaysAgo ?? 0) >= 14,
      owner: lead.Owner?.Name || "Unassigned",
      createdAt: lead.CreatedDate || null,
      updatedAt: lead.LastModifiedDate || null,
      updatedDaysAgo,
    };
  });

export const summarizeSalesforceCrm = ({ accounts, opportunities, leads }) => {
  const openOpps = opportunities.filter((opp) => opp.isOpen);
  const wonOpps = opportunities.filter((opp) => opp.isWon);
  const lostOpps = opportunities.filter((opp) => opp.isClosed && !opp.isWon);
  const openLeads = leads.filter((lead) => lead.isOpen);
  const openPipelineAmount = openOpps.reduce((sum, opp) => sum + opp.amount, 0);
  const weightedPipelineAmount = openOpps.reduce((sum, opp) => sum + opp.weightedAmount, 0);
  const forecastThisQuarter = openOpps
    .filter((opp) => isThisQuarter(opp.closeDate))
    .reduce((sum, opp) => sum + opp.weightedAmount, 0);
  const closedWonAmount = wonOpps.reduce((sum, opp) => sum + opp.amount, 0);
  const avgDealSize = openOpps.length ? Math.round(openPipelineAmount / openOpps.length) : 0;
  const winRate =
    wonOpps.length + lostOpps.length
      ? Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100)
      : null;

  const topRisks = [
    ...openOpps
      .filter((opp) => opp.isOverdue || opp.isStale || (opp.amount > avgDealSize * 2 && opp.probability < 50))
      .map((opp) => ({
        ...opp,
        riskType: opp.isOverdue ? "Overdue close date" : opp.isStale ? "Stale opportunity" : "Large low-confidence deal",
      })),
    ...openLeads
      .filter((lead) => lead.isStale)
      .map((lead) => ({
        ...lead,
        amount: lead.annualRevenue,
        riskType: "Stale lead",
      })),
  ].slice(0, 15);

  return {
    totalAccounts: accounts.length,
    totalLeads: leads.length,
    openLeads: openLeads.length,
    totalOpportunities: opportunities.length,
    openOpportunities: openOpps.length,
    closedWonAmount,
    openPipelineAmount,
    weightedPipelineAmount,
    forecastThisQuarter,
    staleOpportunities: openOpps.filter((opp) => opp.isStale).length,
    overdueCloseOpportunities: openOpps.filter((opp) => opp.isOverdue).length,
    avgDealSize,
    winRate,
    stageBreakdown: countBy(openOpps, (opp) => opp.stage),
    ownerBreakdown: countBy(openOpps, (opp) => opp.owner),
    leadSourceBreakdown: countBy(openLeads, (lead) => lead.leadSource),
    topOpenOpportunities: [...openOpps].sort((a, b) => b.amount - a.amount).slice(0, 15),
    topRisks,
  };
};
