import { readIntegrations } from "@/lib/current-data-store";

const clean = (value) => String(value || "").trim();

const getServerPrefixFromKey = (apiKey) => {
  const [, suffix] = clean(apiKey).split("-");
  return suffix || "";
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value) => Math.round(toNumber(value) * 1000) / 10;

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

export const getMailchimpConfig = async () => {
  const integrations = await readIntegrations();
  const mailchimp = integrations.mailchimp || {};
  const apiKey = clean(process.env.MAILCHIMP_API_KEY) || mailchimp.api_key;
  const serverPrefix =
    clean(process.env.MAILCHIMP_SERVER_PREFIX) ||
    clean(mailchimp.server_prefix) ||
    getServerPrefixFromKey(apiKey);

  return {
    apiKey,
    serverPrefix,
    fromEnv: Boolean(process.env.MAILCHIMP_API_KEY),
    integration: mailchimp,
  };
};

const mailchimpApi = async ({ apiKey, serverPrefix, path, params }) => {
  const dc = clean(serverPrefix) || getServerPrefixFromKey(apiKey);
  if (!dc) {
    throw new Error("Mailchimp server prefix is missing. Use the suffix after the dash in your API key, such as us21.");
  }

  const url = new URL(`https://${dc}.api.mailchimp.com/3.0${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`taichief:${apiKey}`).toString("base64")}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || payload.title || `Mailchimp API ${path} failed with ${response.status}`);
  }

  return payload;
};

export const validateMailchimpToken = async ({ apiKey, serverPrefix }) => {
  const account = await mailchimpApi({ apiKey, serverPrefix, path: "/" });
  return {
    accountId: account.account_id,
    accountName: account.account_name || account.login_name || "Mailchimp Account",
    email: account.email,
    role: account.role,
    serverPrefix: clean(serverPrefix) || getServerPrefixFromKey(apiKey),
  };
};

export const fetchMailchimpAudiences = async ({ apiKey, serverPrefix }) => {
  const payload = await mailchimpApi({
    apiKey,
    serverPrefix,
    path: "/lists",
    params: {
      count: 100,
      fields:
        "lists.id,lists.name,lists.date_created,lists.stats.member_count,lists.stats.unsubscribe_count,lists.stats.cleaned_count,lists.stats.member_count_since_send,lists.stats.unsubscribe_count_since_send,lists.stats.avg_sub_rate,lists.stats.avg_unsub_rate,total_items",
    },
  });
  return payload.lists || [];
};

export const fetchMailchimpCampaigns = async ({ apiKey, serverPrefix }) => {
  const payload = await mailchimpApi({
    apiKey,
    serverPrefix,
    path: "/campaigns",
    params: {
      count: 100,
      sort_field: "send_time",
      sort_dir: "DESC",
      fields:
        "campaigns.id,campaigns.web_id,campaigns.type,campaigns.status,campaigns.create_time,campaigns.send_time,campaigns.emails_sent,campaigns.recipients.list_id,campaigns.recipients.list_name,campaigns.settings.subject_line,campaigns.settings.title,campaigns.report_summary,total_items",
    },
  });
  return payload.campaigns || [];
};

export const fetchMailchimpReports = async ({ apiKey, serverPrefix }) => {
  const payload = await mailchimpApi({
    apiKey,
    serverPrefix,
    path: "/reports",
    params: {
      count: 100,
      fields:
        "reports.id,reports.campaign_title,reports.type,reports.list_id,reports.list_name,reports.subject_line,reports.send_time,reports.emails_sent,reports.opens,reports.clicks,reports.unsubscribed,reports.bounces,total_items",
    },
  });
  return payload.reports || [];
};

export const normalizeMailchimpAudiences = (audiences) =>
  audiences.map((audience) => {
    const stats = audience.stats || {};
    return {
      id: audience.id,
      name: audience.name || "Untitled audience",
      createdAt: audience.date_created || null,
      memberCount: toNumber(stats.member_count),
      unsubscribeCount: toNumber(stats.unsubscribe_count),
      cleanedCount: toNumber(stats.cleaned_count),
      memberCountSinceSend: toNumber(stats.member_count_since_send),
      unsubscribeCountSinceSend: toNumber(stats.unsubscribe_count_since_send),
      avgSubscribeRate: toNumber(stats.avg_sub_rate),
      avgUnsubscribeRate: toNumber(stats.avg_unsub_rate),
    };
  });

export const normalizeMailchimpCampaigns = (campaigns) =>
  campaigns.map((campaign) => {
    const report = campaign.report_summary || {};
    return {
      id: campaign.id,
      webId: campaign.web_id,
      type: campaign.type,
      status: campaign.status || "unknown",
      title: campaign.settings?.title || campaign.settings?.subject_line || "Untitled campaign",
      subjectLine: campaign.settings?.subject_line || "",
      createdAt: campaign.create_time || null,
      sentAt: campaign.send_time || null,
      emailsSent: toNumber(campaign.emails_sent),
      audienceId: campaign.recipients?.list_id || null,
      audienceName: campaign.recipients?.list_name || "Unknown audience",
      openRate: pct(report.open_rate),
      clickRate: pct(report.click_rate),
      subscriberClicks: toNumber(report.subscriber_clicks),
      uniqueOpens: toNumber(report.unique_opens),
    };
  });

export const normalizeMailchimpReports = (reports) =>
  reports.map((report) => {
    const opens = report.opens || {};
    const clicks = report.clicks || {};
    const bounces = report.bounces || {};
    return {
      id: report.id,
      title: report.campaign_title || report.subject_line || "Untitled report",
      type: report.type,
      audienceId: report.list_id,
      audienceName: report.list_name || "Unknown audience",
      subjectLine: report.subject_line || "",
      sentAt: report.send_time || null,
      emailsSent: toNumber(report.emails_sent),
      openRate: pct(opens.open_rate),
      clickRate: pct(clicks.click_rate),
      uniqueOpens: toNumber(opens.unique_opens),
      totalOpens: toNumber(opens.opens_total),
      uniqueClicks: toNumber(clicks.unique_clicks),
      totalClicks: toNumber(clicks.clicks_total),
      unsubscribed: toNumber(report.unsubscribed),
      hardBounces: toNumber(bounces.hard_bounces),
      softBounces: toNumber(bounces.soft_bounces),
      syntaxErrors: toNumber(bounces.syntax_errors),
    };
  });

export const summarizeMailchimpMarketing = ({ audiences, campaigns, reports }) => {
  const sentCampaigns = campaigns.filter((campaign) => campaign.status === "sent");
  const sentReports = reports.filter((report) => report.emailsSent > 0);
  const totalEmailsSent = sentReports.reduce((sum, report) => sum + report.emailsSent, 0);
  const totalOpens = sentReports.reduce((sum, report) => sum + report.uniqueOpens, 0);
  const totalClicks = sentReports.reduce((sum, report) => sum + report.uniqueClicks, 0);
  const totalUnsubscribes = sentReports.reduce((sum, report) => sum + report.unsubscribed, 0);
  const totalBounces = sentReports.reduce(
    (sum, report) => sum + report.hardBounces + report.softBounces + report.syntaxErrors,
    0
  );
  const avgOpenRate = sentReports.length
    ? Math.round(sentReports.reduce((sum, report) => sum + report.openRate, 0) / sentReports.length)
    : 0;
  const avgClickRate = sentReports.length
    ? Math.round(sentReports.reduce((sum, report) => sum + report.clickRate, 0) / sentReports.length)
    : 0;

  const riskyReports = sentReports
    .filter((report) => report.openRate < 20 || report.clickRate < 2 || report.unsubscribed > 20 || report.hardBounces + report.softBounces > 25)
    .map((report) => ({
      ...report,
      riskType:
        report.openRate < 20
          ? "Low open rate"
          : report.clickRate < 2
            ? "Low click rate"
            : report.unsubscribed > 20
              ? "High unsubscribes"
              : "High bounces",
    }))
    .slice(0, 15);

  return {
    totalAudiences: audiences.length,
    totalContacts: audiences.reduce((sum, audience) => sum + audience.memberCount, 0),
    subscribedContacts: audiences.reduce((sum, audience) => sum + audience.memberCount, 0),
    unsubscribedContacts: audiences.reduce((sum, audience) => sum + audience.unsubscribeCount, 0),
    cleanedContacts: audiences.reduce((sum, audience) => sum + audience.cleanedCount, 0),
    avgOpenRate,
    avgClickRate,
    totalCampaigns: campaigns.length,
    sentCampaigns: sentCampaigns.length,
    scheduledCampaigns: campaigns.filter((campaign) => campaign.status === "schedule").length,
    draftCampaigns: campaigns.filter((campaign) => campaign.status === "save").length,
    totalEmailsSent,
    totalOpens,
    totalClicks,
    totalUnsubscribes,
    totalBounces,
    audienceBreakdown: audiences
      .map((audience) => ({ name: audience.name, count: audience.memberCount }))
      .sort((a, b) => b.count - a.count),
    campaignStatusBreakdown: countBy(campaigns, (campaign) => campaign.status),
    campaignPerformance: sentReports
      .map((report) => ({
        name: report.title,
        openRate: report.openRate,
        clickRate: report.clickRate,
      }))
      .slice(0, 10),
    topRisks: riskyReports,
  };
};
