import { readIntegrations } from "@/lib/current-data-store";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "pipeline",
  "closedate",
  "createdate",
  "hs_lastmodifieddate",
  "hubspot_owner_id",
  "dealtype",
  "hs_forecast_amount",
  "hs_is_closed_won",
  "hs_is_closed",
  "hs_object_id",
];

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const daysBetween = (dateValue, now = new Date()) => {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86400000);
};

export const getHubSpotConfig = async () => {
  const integrations = await readIntegrations();
  const hubspot = integrations.hubspot || {};

  return {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN?.trim() || hubspot.access_token,
    fromEnv: Boolean(process.env.HUBSPOT_ACCESS_TOKEN?.trim()),
    integration: hubspot,
  };
};

export const hubSpotApi = async ({ endpoint, method = "GET", token, body }) => {
  const response = await fetch(`${HUBSPOT_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `HubSpot API ${endpoint} failed with ${response.status}`);
  }

  return data;
};

export const validateHubSpotToken = async (accessToken) => {
  const data = await hubSpotApi({
    endpoint: "/account-info/v3/details",
    token: accessToken,
  });

  return {
    portalId: data.portalId ? String(data.portalId) : null,
    accountType: data.accountType || data.timeZone || "HubSpot CRM",
    details: data,
  };
};

export const fetchHubSpotPipelines = async (accessToken) => {
  const data = await hubSpotApi({
    endpoint: "/crm/v3/pipelines/deals",
    token: accessToken,
  });

  return data.results || [];
};

export const fetchHubSpotOwners = async (accessToken) => {
  const data = await hubSpotApi({
    endpoint: "/crm/v3/owners/?limit=100&archived=false",
    token: accessToken,
  });

  return data.results || [];
};

export const fetchHubSpotDeals = async (accessToken) => {
  const deals = [];
  let after;

  do {
    const data = await hubSpotApi({
      endpoint: "/crm/v3/objects/deals/search",
      method: "POST",
      token: accessToken,
      body: {
        limit: 100,
        after,
        properties: DEAL_PROPERTIES,
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
      },
    });
    deals.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after && deals.length < 1000);

  return deals;
};

export const normalizeHubSpotDeals = ({ deals, pipelines, owners }) => {
  const stageById = new Map();
  const pipelineById = new Map();
  const ownerById = new Map();

  pipelines.forEach((pipeline) => {
    pipelineById.set(pipeline.id, pipeline);
    (pipeline.stages || []).forEach((stage) => {
      stageById.set(stage.id, {
        ...stage,
        pipelineId: pipeline.id,
        pipelineLabel: pipeline.label,
      });
    });
  });

  owners.forEach((owner) => {
    ownerById.set(String(owner.id), owner);
  });

  return deals.map((deal) => {
    const properties = deal.properties || {};
    const stage = stageById.get(properties.dealstage);
    const pipeline = pipelineById.get(properties.pipeline);
    const owner = ownerById.get(String(properties.hubspot_owner_id));
    const amount = toNumber(properties.amount);
    const probability = toNumber(stage?.metadata?.probability);
    const weightedAmount = amount * (probability > 1 ? probability / 100 : probability);
    const isClosed = properties.hs_is_closed === "true" || /closed/i.test(stage?.label || "");
    const isWon = properties.hs_is_closed_won === "true" || /won/i.test(stage?.label || "");
    const lastActivityDays = daysBetween(properties.hs_lastmodifieddate || properties.createdate);

    return {
      id: deal.id,
      name: properties.dealname || `Deal ${deal.id}`,
      amount,
      weightedAmount,
      probability: probability > 1 ? Math.round(probability) : Math.round(probability * 100),
      stageId: properties.dealstage,
      stage: stage?.label || properties.dealstage || "Unknown stage",
      pipelineId: properties.pipeline,
      pipeline: pipeline?.label || properties.pipeline || "Default pipeline",
      closeDate: properties.closedate || null,
      createdAt: properties.createdate || deal.createdAt,
      updatedAt: properties.hs_lastmodifieddate || deal.updatedAt,
      ownerId: properties.hubspot_owner_id || null,
      owner:
        owner?.firstName || owner?.lastName
          ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim()
          : owner?.email || "Unassigned",
      dealType: properties.dealtype || "",
      isClosed,
      isWon,
      isOpen: !isClosed,
      isStale: !isClosed && lastActivityDays !== null && lastActivityDays >= 30,
      lastActivityDays,
      url: `https://app.hubspot.com/contacts/${deal.portalId || ""}/deal/${deal.id}`,
    };
  });
};

const groupMoney = (items, key) => {
  const map = new Map();
  items.forEach((item) => {
    const label = item[key] || "Unknown";
    const existing = map.get(label) || {
      name: label,
      deals: 0,
      amount: 0,
      weightedAmount: 0,
    };
    existing.deals += 1;
    existing.amount += item.amount || 0;
    existing.weightedAmount += item.weightedAmount || 0;
    map.set(label, existing);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
};

export const summarizeHubSpotDeals = (deals) => {
  const now = new Date();
  const next90 = new Date(now.getTime() + 90 * 86400000);
  const openDeals = deals.filter((deal) => deal.isOpen);
  const wonDeals = deals.filter((deal) => deal.isWon);
  const closedDeals = deals.filter((deal) => deal.isClosed);
  const forecastDeals = openDeals.filter((deal) => {
    if (!deal.closeDate) return false;
    const closeDate = new Date(deal.closeDate);
    return !Number.isNaN(closeDate.getTime()) && closeDate >= now && closeDate <= next90;
  });

  const openPipelineAmount = openDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const weightedPipelineAmount = openDeals.reduce((sum, deal) => sum + deal.weightedAmount, 0);
  const closedWonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const forecastNext90Days = forecastDeals.reduce((sum, deal) => sum + deal.weightedAmount, 0);
  const staleDeals = openDeals.filter((deal) => deal.isStale).length;

  return {
    totalDeals: deals.length,
    openDeals: openDeals.length,
    openPipelineAmount,
    weightedPipelineAmount,
    closedWonAmount,
    staleDeals,
    forecastNext90Days,
    avgDealSize: openDeals.length ? Math.round(openPipelineAmount / openDeals.length) : 0,
    winRate: closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : null,
    stageBreakdown: groupMoney(openDeals, "stage"),
    pipelineBreakdown: groupMoney(openDeals, "pipeline"),
    topOpenDeals: [...openDeals].sort((a, b) => b.amount - a.amount).slice(0, 12),
    syncedAt: new Date().toISOString(),
  };
};
