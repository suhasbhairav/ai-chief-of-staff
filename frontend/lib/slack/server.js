import crypto from "crypto";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const SLACK_BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:join",
  "channels:read",
  "chat:write",
  "chat:write.public",
  "groups:history",
  "groups:read",
  "im:history",
  "im:read",
  "im:write",
  "mpim:history",
  "mpim:read",
  "team:read",
  "users:read",
];

export const getSlackCredentials = () => ({
  clientId: process.env.SLACK_CLIENT_ID?.trim(),
  clientSecret: process.env.SLACK_CLIENT_SECRET?.trim(),
  signingSecret: process.env.SLACK_SIGNING_SECRET?.trim(),
});

export const getAppUrl = (request) => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  return `${protocol}://${host}`;
};

export const createSlackOAuthState = () => crypto.randomBytes(24).toString("hex");

export const verifySlackSignature = (rawBody, headers, signingSecret) => {
  if (!signingSecret) return false;

  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expectedSignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const slackApi = async (method, token, payload = {}, options = {}) => {
  const httpMethod = options.httpMethod || "POST";
  const isGet = httpMethod === "GET";
  const url = new URL(`https://slack.com/api/${method}`);

  if (isGet) {
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    method: httpMethod,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isGet ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    },
    body: isGet ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();

  if (!data.ok) {
    const error = new Error(data.error || `Slack ${method} failed`);
    error.slack = data;
    throw error;
  }

  return data;
};

export const tokenToPublicIntegration = (installation) => ({
  connected: Boolean(installation?.is_active),
  name: "Slack",
  icon: "💬",
  team_id: installation?.team_id,
  team_name: installation?.team_name || "Connected Workspace",
  enterprise_id: installation?.enterprise_id,
  enterprise_name: installation?.enterprise_name,
  app_id: installation?.app_id,
  bot_user_id: installation?.bot_user_id,
  scope: installation?.scope,
  integratedAt: installation?.installed_at,
});

export const readActiveSlackInstallation = async () => {
  if (!isSupabaseConfigured) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("slack_installations")
    .select("*")
    .eq("is_active", true)
    .order("installed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read Slack installation: ${error.message}`);
  }

  return data;
};

export const saveSlackInstallation = async (oauthData) => {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is required for live Slack token storage.");
  }

  const supabase = createSupabaseServerClient();
  const row = {
    team_id: oauthData.team?.id || oauthData.team_id,
    team_name: oauthData.team?.name || oauthData.team_name,
    enterprise_id: oauthData.enterprise?.id || null,
    enterprise_name: oauthData.enterprise?.name || null,
    app_id: oauthData.app_id,
    bot_user_id: oauthData.bot_user_id || oauthData.user_id,
    bot_access_token: oauthData.access_token || oauthData.bot_access_token,
    scope: oauthData.scope,
    authed_user_id: oauthData.authed_user?.id || null,
    is_active: true,
    installed_at: new Date().toISOString(),
    content: oauthData,
  };

  if (!row.team_id || !row.bot_access_token) {
    throw new Error("Slack installation response did not include team_id or bot token.");
  }

  const { data, error } = await supabase
    .from("slack_installations")
    .upsert(row, { onConflict: "team_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to save Slack installation: ${error.message}`);
  }

  return data;
};

export const disconnectSlackInstallation = async () => {
  if (!isSupabaseConfigured) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("slack_installations")
    .update({ is_active: false })
    .eq("is_active", true);

  if (error) {
    throw new Error(`Unable to disconnect Slack installation: ${error.message}`);
  }
};

export const recordSlackEvent = async (payload) => {
  if (!isSupabaseConfigured || !payload?.event) return;

  const event = payload.event;
  const supabase = createSupabaseServerClient();
  await supabase.from("slack_events").upsert(
    {
      team_id: payload.team_id,
      event_id: payload.event_id,
      event_type: event.type,
      channel_id: event.channel,
      user_id: event.user,
      event_ts: event.ts || event.event_ts,
      text: event.text,
      handled: true,
      content: payload,
    },
    { onConflict: "event_id" }
  );
};

export const saveSlackMessageSnapshots = async ({ teamId, channelId, channelName, messages }) => {
  if (!isSupabaseConfigured || !messages?.length) return;

  const supabase = createSupabaseServerClient();
  await supabase.from("slack_message_snapshots").upsert(
    messages
      .filter((message) => message.ts)
      .map((message) => ({
        team_id: teamId,
        channel_id: channelId,
        channel_name: channelName,
        message_ts: message.ts,
        user_id: message.user,
        text: message.text || "",
        content: message,
      })),
    { onConflict: "channel_id,message_ts" }
  );
};
