import { NextResponse } from "next/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getSlackCredentials, slackApi } from "@/lib/slack/server";
import { validateHubSpotToken } from "@/lib/hubspot/server";

const validateNotionDatabase = async ({ apiKey, databaseId }) => {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": "2022-06-28",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Notion database validation failed with ${response.status}`);
  }
  return data;
};

const sanitizeIntegrations = (integrations) => ({
  ...integrations,
  notion: integrations?.notion
    ? {
        ...integrations.notion,
        api_key: undefined,
        hasToken: Boolean(integrations.notion.api_key || process.env.NOTION_API_KEY),
        database_id: integrations.notion.database_id || process.env.NOTION_OKR_DATABASE_ID || "",
        connected: Boolean(
          integrations.notion.connected ||
            (process.env.NOTION_API_KEY && process.env.NOTION_OKR_DATABASE_ID)
        ),
      }
    : integrations?.notion,
  hubspot: integrations?.hubspot
    ? {
        ...integrations.hubspot,
        access_token: undefined,
        hasToken: Boolean(integrations.hubspot.access_token || process.env.HUBSPOT_ACCESS_TOKEN),
        connected: Boolean(
          integrations.hubspot.connected || process.env.HUBSPOT_ACCESS_TOKEN
        ),
      }
    : integrations?.hubspot,
});

export async function GET() {
  try {
    const integrations = await readIntegrations();
    const oauthSupported = Boolean(getSlackCredentials().clientId);
    return NextResponse.json({
      integrations: sanitizeIntegrations(integrations),
      oauthSupported,
      notionEnvConfigured: Boolean(process.env.NOTION_API_KEY && process.env.NOTION_OKR_DATABASE_ID),
      hubspotEnvConfigured: Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve integrations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const current = await readIntegrations();

    // If saving Slack details, verify token if provided
    if (payload.slack && payload.slack.bot_token) {
      try {
        const authTest = await slackApi("auth.test", payload.slack.bot_token);
        payload.slack = {
          connected: true,
          name: "Slack",
          icon: "💬",
          bot_token: payload.slack.bot_token,
          bot_user_id: authTest.user_id,
          team_name: authTest.team || "Connected Workspace",
          team_id: authTest.team_id,
          integratedAt: new Date().toISOString()
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Slack validation failed: ${error.message}. Ensure the token is a Bot User OAuth Token with the required scopes.` },
          { status: 400 }
        );
      }
    }

    if (payload.notion?.api_key && payload.notion?.database_id) {
      try {
        const database = await validateNotionDatabase({
          apiKey: payload.notion.api_key.trim(),
          databaseId: payload.notion.database_id.trim(),
        });
        payload.notion = {
          connected: true,
          name: "Notion OKRs",
          icon: "📓",
          api_key: payload.notion.api_key.trim(),
          database_id: payload.notion.database_id.trim(),
          database_title:
            database.title?.map((item) => item.plain_text).join("") || "OKR Database",
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Notion validation failed: ${error.message}. Share the OKR database with your Notion integration and verify the database ID.` },
          { status: 400 }
        );
      }
    } else if (payload.notion && payload.notion.connected === false) {
      payload.notion = {
        connected: false,
        name: "Notion OKRs",
        icon: "📓",
      };
    } else if (payload.notion && !payload.notion.api_key && current.notion?.api_key) {
      payload.notion = {
        ...current.notion,
        ...payload.notion,
        api_key: current.notion.api_key,
      };
    }

    if (payload.hubspot?.access_token) {
      try {
        const account = await validateHubSpotToken(payload.hubspot.access_token.trim());
        payload.hubspot = {
          connected: true,
          name: "HubSpot Deals",
          icon: "🧲",
          access_token: payload.hubspot.access_token.trim(),
          portal_id: account.portalId,
          account_type: account.accountType,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `HubSpot validation failed: ${error.message}. Use a Private App access token with CRM object read scopes.` },
          { status: 400 }
        );
      }
    } else if (payload.hubspot && payload.hubspot.connected === false) {
      payload.hubspot = {
        connected: false,
        name: "HubSpot Deals",
        icon: "🧲",
      };
    } else if (payload.hubspot && !payload.hubspot.access_token && current.hubspot?.access_token) {
      payload.hubspot = {
        ...current.hubspot,
        ...payload.hubspot,
        access_token: current.hubspot.access_token,
      };
    }
    
    // Merge or update
    const updated = { ...current, ...payload };
    const saved = await writeIntegrations(updated);
    
    return NextResponse.json(sanitizeIntegrations(saved));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to modify integrations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
