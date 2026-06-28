import { NextResponse } from "next/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getSlackCredentials, slackApi } from "@/lib/slack/server";
import { validateHubSpotToken } from "@/lib/hubspot/server";
import { validateLinearToken } from "@/lib/linear/server";
import { createClickUpAuthHeader, validateClickUpToken } from "@/lib/clickup/server";
import {
  validateConfluenceCredentials,
  validateJiraCredentials,
} from "@/lib/atlassian/server";
import { validateGitHubToken } from "@/lib/github/server";
import { validateAsanaToken } from "@/lib/asana/server";

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
  linear: integrations?.linear
    ? {
        ...integrations.linear,
        api_key: undefined,
        hasToken: Boolean(integrations.linear.api_key || process.env.LINEAR_API_KEY),
        connected: Boolean(
          integrations.linear.connected || process.env.LINEAR_API_KEY
        ),
      }
    : integrations?.linear,
  clickup: integrations?.clickup
    ? {
        ...integrations.clickup,
        access_token: undefined,
        api_token: undefined,
        hasToken: Boolean(
          integrations.clickup.access_token ||
            integrations.clickup.api_token ||
            process.env.CLICKUP_API_TOKEN
        ),
        workspace_id: integrations.clickup.workspace_id || process.env.CLICKUP_WORKSPACE_ID || "",
        connected: Boolean(
          integrations.clickup.connected || process.env.CLICKUP_API_TOKEN
        ),
      }
    : integrations?.clickup,
  jira: integrations?.jira
    ? {
        ...integrations.jira,
        api_token: undefined,
        hasToken: Boolean(
          integrations.jira.api_token ||
            process.env.JIRA_API_TOKEN ||
            process.env.ATLASSIAN_API_TOKEN
        ),
        site_url:
          integrations.jira.site_url ||
          process.env.JIRA_SITE_URL ||
          process.env.ATLASSIAN_SITE_URL ||
          "",
        connected: Boolean(
          integrations.jira.connected ||
            ((process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN) &&
              (process.env.JIRA_SITE_URL || process.env.ATLASSIAN_SITE_URL) &&
              (process.env.JIRA_EMAIL || process.env.ATLASSIAN_EMAIL))
        ),
      }
    : integrations?.jira,
  confluence: integrations?.confluence
    ? {
        ...integrations.confluence,
        api_token: undefined,
        hasToken: Boolean(
          integrations.confluence.api_token ||
            process.env.CONFLUENCE_API_TOKEN ||
            process.env.ATLASSIAN_API_TOKEN
        ),
        site_url:
          integrations.confluence.site_url ||
          process.env.CONFLUENCE_SITE_URL ||
          process.env.ATLASSIAN_SITE_URL ||
          "",
        connected: Boolean(
          integrations.confluence.connected ||
            ((process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN) &&
              (process.env.CONFLUENCE_SITE_URL || process.env.ATLASSIAN_SITE_URL) &&
              (process.env.CONFLUENCE_EMAIL || process.env.ATLASSIAN_EMAIL))
        ),
      }
    : integrations?.confluence,
  github: integrations?.github
    ? {
        ...integrations.github,
        access_token: undefined,
        hasToken: Boolean(integrations.github.access_token || process.env.GITHUB_TOKEN),
        owner: integrations.github.owner || process.env.GITHUB_OWNER || "",
        repos: integrations.github.repos || process.env.GITHUB_REPOS || "",
        connected: Boolean(integrations.github.connected || process.env.GITHUB_TOKEN),
      }
    : integrations?.github,
  asana: integrations?.asana
    ? {
        ...integrations.asana,
        access_token: undefined,
        hasToken: Boolean(integrations.asana.access_token || process.env.ASANA_ACCESS_TOKEN),
        workspace_gid: integrations.asana.workspace_gid || process.env.ASANA_WORKSPACE_GID || "",
        project_gids: integrations.asana.project_gids || process.env.ASANA_PROJECT_GIDS || "",
        connected: Boolean(integrations.asana.connected || process.env.ASANA_ACCESS_TOKEN),
      }
    : integrations?.asana,
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
      linearEnvConfigured: Boolean(process.env.LINEAR_API_KEY),
      clickupEnvConfigured: Boolean(process.env.CLICKUP_API_TOKEN),
      jiraEnvConfigured: Boolean(
        (process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN) &&
          (process.env.JIRA_SITE_URL || process.env.ATLASSIAN_SITE_URL) &&
          (process.env.JIRA_EMAIL || process.env.ATLASSIAN_EMAIL)
      ),
      confluenceEnvConfigured: Boolean(
        (process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN) &&
          (process.env.CONFLUENCE_SITE_URL || process.env.ATLASSIAN_SITE_URL) &&
          (process.env.CONFLUENCE_EMAIL || process.env.ATLASSIAN_EMAIL)
      ),
      githubEnvConfigured: Boolean(process.env.GITHUB_TOKEN),
      asanaEnvConfigured: Boolean(process.env.ASANA_ACCESS_TOKEN),
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

    if (payload.linear?.api_key) {
      try {
        const account = await validateLinearToken(payload.linear.api_key.trim());
        payload.linear = {
          connected: true,
          name: "Linear Tickets",
          icon: "🎫",
          api_key: payload.linear.api_key.trim(),
          organization_id: account.organizationId,
          organization_name: account.organizationName,
          user_name: account.userName,
          user_email: account.userEmail,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Linear validation failed: ${error.message}. Use a Linear personal API key with workspace access.` },
          { status: 400 }
        );
      }
    } else if (payload.linear && payload.linear.connected === false) {
      payload.linear = {
        connected: false,
        name: "Linear Tickets",
        icon: "🎫",
      };
    } else if (payload.linear && !payload.linear.api_key && current.linear?.api_key) {
      payload.linear = {
        ...current.linear,
        ...payload.linear,
        api_key: current.linear.api_key,
      };
    }

    if (payload.clickup?.api_token || payload.clickup?.access_token) {
      const token = (payload.clickup.api_token || payload.clickup.access_token).trim();
      const validationToken = createClickUpAuthHeader(token, {
        oauth: Boolean(payload.clickup.access_token),
      });
      try {
        const account = await validateClickUpToken(validationToken);
        const workspaceId = payload.clickup.workspace_id || account.workspaceId;
        const workspace =
          account.workspaces.find((team) => String(team.id) === String(workspaceId)) ||
          account.workspaces[0];

        payload.clickup = {
          connected: true,
          name: "ClickUp Workspace",
          icon: "☑️",
          api_token: payload.clickup.api_token ? token : undefined,
          access_token: payload.clickup.access_token ? token : undefined,
          workspace_id: workspace?.id ? String(workspace.id) : workspaceId,
          workspace_name: workspace?.name || account.workspaceName,
          user_name: account.user?.username || account.user?.email,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `ClickUp validation failed: ${error.message}. Use a valid personal token or OAuth access token with workspace access.` },
          { status: 400 }
        );
      }
    } else if (payload.clickup && payload.clickup.connected === false) {
      payload.clickup = {
        connected: false,
        name: "ClickUp Workspace",
        icon: "☑️",
      };
    } else if (payload.clickup && !payload.clickup.api_token && !payload.clickup.access_token) {
      const preservedToken = current.clickup?.api_token || current.clickup?.access_token;
      if (preservedToken) {
        payload.clickup = {
          ...current.clickup,
          ...payload.clickup,
          api_token: current.clickup?.api_token,
          access_token: current.clickup?.access_token,
        };
      }
    }

    if (payload.jira?.api_token && payload.jira?.site_url && payload.jira?.email) {
      try {
        const account = await validateJiraCredentials({
          siteUrl: payload.jira.site_url.trim(),
          email: payload.jira.email.trim(),
          apiToken: payload.jira.api_token.trim(),
        });
        payload.jira = {
          connected: true,
          name: "Jira Issues",
          icon: "🔷",
          site_url: account.siteUrl,
          email: payload.jira.email.trim(),
          api_token: payload.jira.api_token.trim(),
          jql: payload.jira.jql?.trim() || "order by updated DESC",
          account_id: account.accountId,
          user_name: account.displayName,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Jira validation failed: ${error.message}. Use your Atlassian site URL, account email, and API token with Jira access.` },
          { status: 400 }
        );
      }
    } else if (payload.jira && payload.jira.connected === false) {
      payload.jira = {
        connected: false,
        name: "Jira Issues",
        icon: "🔷",
      };
    } else if (payload.jira && !payload.jira.api_token && current.jira?.api_token) {
      payload.jira = {
        ...current.jira,
        ...payload.jira,
        api_token: current.jira.api_token,
      };
    }

    if (payload.confluence?.api_token && payload.confluence?.site_url && payload.confluence?.email) {
      try {
        const account = await validateConfluenceCredentials({
          siteUrl: payload.confluence.site_url.trim(),
          email: payload.confluence.email.trim(),
          apiToken: payload.confluence.api_token.trim(),
        });
        payload.confluence = {
          connected: true,
          name: "Confluence Knowledge",
          icon: "📘",
          site_url: account.siteUrl,
          email: payload.confluence.email.trim(),
          api_token: payload.confluence.api_token.trim(),
          cql: payload.confluence.cql?.trim() || "type=page order by lastmodified desc",
          account_id: account.accountId,
          user_name: account.displayName,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Confluence validation failed: ${error.message}. Use your Atlassian site URL, account email, and API token with Confluence access.` },
          { status: 400 }
        );
      }
    } else if (payload.confluence && payload.confluence.connected === false) {
      payload.confluence = {
        connected: false,
        name: "Confluence Knowledge",
        icon: "📘",
      };
    } else if (payload.confluence && !payload.confluence.api_token && current.confluence?.api_token) {
      payload.confluence = {
        ...current.confluence,
        ...payload.confluence,
        api_token: current.confluence.api_token,
      };
    }

    if (payload.github?.access_token) {
      try {
        const account = await validateGitHubToken(payload.github.access_token.trim());
        payload.github = {
          connected: true,
          name: "GitHub Engineering",
          icon: "🐙",
          access_token: payload.github.access_token.trim(),
          owner: payload.github.owner?.trim() || "",
          repos: payload.github.repos?.trim() || "",
          user_login: account.login,
          user_name: account.name,
          user_url: account.htmlUrl,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `GitHub validation failed: ${error.message}. Use a GitHub token with repository metadata, issues, and pull request read permissions.` },
          { status: 400 }
        );
      }
    } else if (payload.github && payload.github.connected === false) {
      payload.github = {
        connected: false,
        name: "GitHub Engineering",
        icon: "🐙",
      };
    } else if (payload.github && !payload.github.access_token && current.github?.access_token) {
      payload.github = {
        ...current.github,
        ...payload.github,
        access_token: current.github.access_token,
      };
    }

    if (payload.asana?.access_token) {
      try {
        const account = await validateAsanaToken(payload.asana.access_token.trim());
        const workspaceGid = payload.asana.workspace_gid?.trim() || account.workspaces?.[0]?.gid || "";
        const workspace = account.workspaces?.find((item) => item.gid === workspaceGid);
        payload.asana = {
          connected: true,
          name: "Asana Work Management",
          icon: "🔴",
          access_token: payload.asana.access_token.trim(),
          workspace_gid: workspaceGid,
          workspace_name: workspace?.name || account.workspaces?.[0]?.name || "",
          project_gids: payload.asana.project_gids?.trim() || "",
          user_gid: account.gid,
          user_name: account.name,
          user_email: account.email,
          integratedAt: new Date().toISOString(),
        };
      } catch (error) {
        return NextResponse.json(
          { error: `Asana validation failed: ${error.message}. Use a valid Asana personal access token or OAuth token with workspace, project, and task read access.` },
          { status: 400 }
        );
      }
    } else if (payload.asana && payload.asana.connected === false) {
      payload.asana = {
        connected: false,
        name: "Asana Work Management",
        icon: "🔴",
      };
    } else if (payload.asana && !payload.asana.access_token && current.asana?.access_token) {
      payload.asana = {
        ...current.asana,
        ...payload.asana,
        access_token: current.asana.access_token,
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
