"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function IntegrationsPageContent() {
  const [integrations, setIntegrations] = useState({});
  const [oauthSupported, setOauthSupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [notionApiKey, setNotionApiKey] = useState("");
  const [notionDatabaseId, setNotionDatabaseId] = useState("");
  const [showNotionForm, setShowNotionForm] = useState(false);
  const [hubspotAccessToken, setHubspotAccessToken] = useState("");
  const [showHubspotForm, setShowHubspotForm] = useState(false);
  const [linearApiKey, setLinearApiKey] = useState("");
  const [showLinearForm, setShowLinearForm] = useState(false);
  const [clickupToken, setClickupToken] = useState("");
  const [clickupWorkspaceId, setClickupWorkspaceId] = useState("");
  const [showClickupForm, setShowClickupForm] = useState(false);
  const [jiraSiteUrl, setJiraSiteUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [jiraJql, setJiraJql] = useState("order by updated DESC");
  const [showJiraForm, setShowJiraForm] = useState(false);
  const [confluenceSiteUrl, setConfluenceSiteUrl] = useState("");
  const [confluenceEmail, setConfluenceEmail] = useState("");
  const [confluenceApiToken, setConfluenceApiToken] = useState("");
  const [confluenceCql, setConfluenceCql] = useState("type=page order by lastmodified desc");
  const [showConfluenceForm, setShowConfluenceForm] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepos, setGithubRepos] = useState("");
  const [showGithubForm, setShowGithubForm] = useState(false);
  const [asanaToken, setAsanaToken] = useState("");
  const [asanaWorkspaceGid, setAsanaWorkspaceGid] = useState("");
  const [asanaProjectGids, setAsanaProjectGids] = useState("");
  const [showAsanaForm, setShowAsanaForm] = useState(false);
  const [apiError, setApiError] = useState("");
  const [apiSuccess, setApiSuccess] = useState("");

  const searchParams = useSearchParams();

  const fetchIntegrationsData = () => {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data) => {
        setIntegrations(data.integrations || {});
        setOauthSupported(data.oauthSupported || false);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load integrations", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchIntegrationsData();
    
      const slackSuccess = searchParams.get("slack_success");
      const slackError = searchParams.get("slack_error");
      const clickupSuccess = searchParams.get("clickup_success");
      const clickupError = searchParams.get("clickup_error");

      if (slackSuccess) {
        setApiSuccess("Slack integrated successfully via OAuth!");
        setTimeout(() => setApiSuccess(""), 6000);
      } else if (slackError) {
        setApiError(`Slack integration failed: ${slackError}`);
        setTimeout(() => setApiError(""), 8000);
      } else if (clickupSuccess) {
        setApiSuccess("ClickUp integrated successfully via OAuth!");
        setTimeout(() => setApiSuccess(""), 6000);
      } else if (clickupError) {
        setApiError(`ClickUp integration failed: ${clickupError}`);
        setTimeout(() => setApiError(""), 8000);
      }
    });
  }, [searchParams]);

  const handleOAuthConnect = () => {
    // Redirect to local API OAuth initiator
    window.location.href = "/api/integrations/slack/authorize";
  };

  const handleManualTokenSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.startsWith("xoxb-")) {
      setApiError("Invalid token prefix. Bot tokens must start with 'xoxb-'.");
      return;
    }

    setConnectingId("slack");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slack: {
            bot_token: manualToken.trim()
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Slack bot token");
      }

      setIntegrations(data);
      setApiSuccess("Slack manually integrated and token verified successfully!");
      setManualToken("");
      setShowManualForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect token");
    } finally {
      setConnectingId(null);
    }
  };

  const handleNotionSubmit = async (e) => {
    e.preventDefault();
    if (!notionApiKey.trim().startsWith("secret_") && !notionApiKey.trim().startsWith("ntn_")) {
      setApiError("Invalid Notion secret. Use an Internal Integration Secret from Notion.");
      return;
    }
    if (!notionDatabaseId.trim()) {
      setApiError("Notion OKR database ID is required.");
      return;
    }

    setConnectingId("notion");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notion: {
            api_key: notionApiKey.trim(),
            database_id: notionDatabaseId.trim(),
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Notion connection");
      }

      setIntegrations(data);
      setApiSuccess("Notion OKR database connected successfully.");
      setNotionApiKey("");
      setNotionDatabaseId("");
      setShowNotionForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect Notion");
    } finally {
      setConnectingId(null);
    }
  };

  const handleHubSpotSubmit = async (e) => {
    e.preventDefault();
    if (!hubspotAccessToken.trim()) {
      setApiError("HubSpot Private App access token is required.");
      return;
    }

    setConnectingId("hubspot");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hubspot: {
            access_token: hubspotAccessToken.trim(),
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify HubSpot connection");
      }

      setIntegrations(data);
      setApiSuccess("HubSpot deal pipeline connected successfully.");
      setHubspotAccessToken("");
      setShowHubspotForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect HubSpot");
    } finally {
      setConnectingId(null);
    }
  };

  const handleLinearSubmit = async (e) => {
    e.preventDefault();
    if (!linearApiKey.trim()) {
      setApiError("Linear API key is required.");
      return;
    }

    setConnectingId("linear");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linear: {
            api_key: linearApiKey.trim(),
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Linear connection");
      }

      setIntegrations(data);
      setApiSuccess("Linear ticket overview connected successfully.");
      setLinearApiKey("");
      setShowLinearForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect Linear");
    } finally {
      setConnectingId(null);
    }
  };

  const handleClickUpOAuthConnect = () => {
    window.location.href = "/api/integrations/clickup/authorize";
  };

  const handleClickUpSubmit = async (e) => {
    e.preventDefault();
    if (!clickupToken.trim()) {
      setApiError("ClickUp personal token or OAuth token is required.");
      return;
    }

    setConnectingId("clickup");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickup: {
            api_token: clickupToken.trim(),
            workspace_id: clickupWorkspaceId.trim(),
          }
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify ClickUp connection");
      }

      setIntegrations(data);
      setApiSuccess("ClickUp workspace connected successfully.");
      setClickupToken("");
      setClickupWorkspaceId("");
      setShowClickupForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect ClickUp");
    } finally {
      setConnectingId(null);
    }
  };

  const handleJiraSubmit = async (e) => {
    e.preventDefault();
    if (!jiraSiteUrl.trim() || !jiraEmail.trim() || !jiraApiToken.trim()) {
      setApiError("Jira site URL, Atlassian email, and API token are required.");
      return;
    }

    setConnectingId("jira");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jira: {
            site_url: jiraSiteUrl.trim(),
            email: jiraEmail.trim(),
            api_token: jiraApiToken.trim(),
            jql: jiraJql.trim() || "order by updated DESC",
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Jira connection");
      }

      setIntegrations(data);
      setApiSuccess("Jira issue workspace connected successfully.");
      setJiraSiteUrl("");
      setJiraEmail("");
      setJiraApiToken("");
      setJiraJql("order by updated DESC");
      setShowJiraForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect Jira");
    } finally {
      setConnectingId(null);
    }
  };

  const handleConfluenceSubmit = async (e) => {
    e.preventDefault();
    if (!confluenceSiteUrl.trim() || !confluenceEmail.trim() || !confluenceApiToken.trim()) {
      setApiError("Confluence site URL, Atlassian email, and API token are required.");
      return;
    }

    setConnectingId("confluence");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confluence: {
            site_url: confluenceSiteUrl.trim(),
            email: confluenceEmail.trim(),
            api_token: confluenceApiToken.trim(),
            cql: confluenceCql.trim() || "type=page order by lastmodified desc",
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Confluence connection");
      }

      setIntegrations(data);
      setApiSuccess("Confluence knowledge workspace connected successfully.");
      setConfluenceSiteUrl("");
      setConfluenceEmail("");
      setConfluenceApiToken("");
      setConfluenceCql("type=page order by lastmodified desc");
      setShowConfluenceForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect Confluence");
    } finally {
      setConnectingId(null);
    }
  };

  const handleGitHubSubmit = async (e) => {
    e.preventDefault();
    if (!githubToken.trim()) {
      setApiError("GitHub token is required.");
      return;
    }

    setConnectingId("github");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          github: {
            access_token: githubToken.trim(),
            owner: githubOwner.trim(),
            repos: githubRepos.trim(),
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify GitHub connection");
      }

      setIntegrations(data);
      setApiSuccess("GitHub engineering workspace connected successfully.");
      setGithubToken("");
      setGithubOwner("");
      setGithubRepos("");
      setShowGithubForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect GitHub");
    } finally {
      setConnectingId(null);
    }
  };

  const handleAsanaSubmit = async (e) => {
    e.preventDefault();
    if (!asanaToken.trim()) {
      setApiError("Asana personal access token or OAuth token is required.");
      return;
    }

    setConnectingId("asana");
    setApiError("");
    setApiSuccess("");

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asana: {
            access_token: asanaToken.trim(),
            workspace_gid: asanaWorkspaceGid.trim(),
            project_gids: asanaProjectGids.trim(),
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify Asana connection");
      }

      setIntegrations(data);
      setApiSuccess("Asana work management workspace connected successfully.");
      setAsanaToken("");
      setAsanaWorkspaceGid("");
      setAsanaProjectGids("");
      setShowAsanaForm(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to connect Asana");
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (id) => {
    if (!confirm(`Are you sure you want to disconnect ${integrations[id]?.name}? This will sever all real-time webhooks and task sync services.`)) return;

    try {
      const updated = {
        ...integrations,
        [id]: { ...integrations[id], connected: false, bot_token: null }
      };

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      
      const data = await res.json();
      setIntegrations(data);
      setApiSuccess(`${integrations[id]?.name} disconnected successfully.`);
      setTimeout(() => setApiSuccess(""), 4000);
    } catch (e) {
      console.error("Failed to disconnect integration", e);
      setApiError("Disconnect failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const integrationDetails = {
    slack: {
      description: "Install the real Slack app. TAI Chief reads approved channels and DMs, harvests commitments, ranks P0/P1 work, and replies in Slack through Slack Web API and Events API.",
      color: "from-[#4a154b]/30 to-[#121214]",
      iconBg: "bg-[#4a154b]/20 text-[#e01e5a]",
    },
    gmail: {
      description: "Seamlessly parse inbound emails and calendars. TAI Chief monitors deadlines, drafts context-aware replies for review, and identifies commitments from meetings.",
      color: "from-red-500/10 to-[#121214]",
      iconBg: "bg-red-500/10 text-red-400",
    },
    notion: {
      description: "Sync live Product OKRs from a real Notion database, track owners, progress, risk, due dates, and objective health inside the Product dashboard.",
      color: "from-sky-500/15 to-[#121214]",
      iconBg: "bg-sky-500/10 text-sky-200",
    },
    hubspot: {
      description: "Sync the entire HubSpot deal pipeline for CEO-level revenue inspection: stage mix, weighted forecast, stale deals, owners, and top open opportunities.",
      color: "from-orange-500/15 to-[#121214]",
      iconBg: "bg-orange-500/10 text-orange-300",
    },
    linear: {
      description: "Sync Linear issues for a CEO-level execution view: open tickets, urgent work, overdue work, stale issues, team load, project risk, and delivery throughput.",
      color: "from-violet-500/15 to-[#121214]",
      iconBg: "bg-violet-500/10 text-violet-200",
    },
    clickup: {
      description: "Sync ClickUp Goals, tasks, and roadmap-style initiatives for teams running OKRs and delivery in ClickUp.",
      color: "from-emerald-500/15 to-[#121214]",
      iconBg: "bg-emerald-500/10 text-emerald-200",
    },
    jira: {
      description: "Sync Jira issues, projects, priorities, owners, overdue work, stale execution, roadmap epics, and CEO delivery risks.",
      color: "from-blue-500/15 to-[#121214]",
      iconBg: "bg-blue-500/10 text-blue-200",
    },
    confluence: {
      description: "Sync Confluence pages, spaces, roadmaps, policies, runbooks, owners, freshness, and executive knowledge coverage.",
      color: "from-cyan-500/15 to-[#121214]",
      iconBg: "bg-cyan-500/10 text-cyan-200",
    },
    github: {
      description: "Sync GitHub repositories, pull requests, issues, and bug queues for CEO-level engineering execution health.",
      color: "from-slate-500/15 to-[#121214]",
      iconBg: "bg-slate-500/10 text-slate-200",
    },
    asana: {
      description: "Sync Asana projects and tasks for CEO-level work management, overdue work, stale execution, owners, and delivery risk.",
      color: "from-rose-500/15 to-[#121214]",
      iconBg: "bg-rose-500/10 text-rose-200",
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="border-b border-[#27272a] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tool Integrations Hub</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-3xl">
          Connect your organization&apos;s primary data sources. TAI Chief syncs conversations, mail threads, tickets, repositories, docs, and deal data into a consolidated company brain.
        </p>
      </div>

      {/* Notifications Panel */}
      {apiError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-400">
          ⚠️ {apiError}
        </div>
      )}
      {apiSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-400">
          ✓ {apiSuccess}
        </div>
      )}

      {/* Connecting Loader Modal */}
      {connectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#0f0f12] p-8 text-center shadow-2xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
            <h3 className="text-md font-semibold text-white">Verifying API Credentials...</h3>
            <p className="text-xs text-zinc-500 mt-2">
              {connectingId === "notion"
                ? "Connecting with Notion API and checking database access..."
                : connectingId === "hubspot"
                  ? "Connecting with HubSpot CRM and validating deal scopes..."
                : connectingId === "linear"
                  ? "Connecting with Linear SDK and checking workspace access..."
                : connectingId === "clickup"
                  ? "Connecting with ClickUp API and checking workspace access..."
                : connectingId === "jira"
                  ? "Connecting with Jira Cloud and validating issue access..."
                : connectingId === "confluence"
                  ? "Connecting with Confluence Cloud and validating content access..."
                : connectingId === "github"
                  ? "Connecting with GitHub REST API and validating repository access..."
                : connectingId === "asana"
                  ? "Connecting with Asana REST API and validating workspace access..."
                : "Connecting with Slack API and checking scopes..."}
            </p>
          </div>
        </div>
      )}

      {/* Manual Configuration Modal Overlay */}
      {showManualForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Manual Slack Bot Token Setup</h3>
              <button 
                onClick={() => setShowManualForm(false)}
                className="text-zinc-500 hover:text-white text-md font-bold"
              >
                ×
              </button>
            </div>

            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-indigo-300">How to get a Bot token:</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to <a href="https://api.slack.com/apps" target="_blank" className="text-indigo-400 underline">Slack Apps Portal</a> and create an app.</li>
                <li>Under <strong>OAuth & Permissions</strong>, add Bot Token Scopes:
                  <code className="block bg-[#1a1a1f] p-1.5 rounded mt-1 text-[10px] text-zinc-300">
                    app_mentions:read, channels:history, channels:join, channels:read, chat:write, chat:write.public, groups:history, groups:read, im:history, im:read, im:write, mpim:history, mpim:read, team:read, users:read
                  </code>
                </li>
                <li>Install the app to your workspace and copy the <strong>Bot User OAuth Token</strong> (starts with <code className="text-indigo-300 font-semibold">xoxb-</code>).</li>
                <li>For live background capture, set Event Subscriptions to <code className="text-indigo-300">/api/slack/events</code> and add message/app mention events.</li>
              </ol>
            </div>

            <form onSubmit={handleManualTokenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Bot User OAuth Token</label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="xoxb-your-bot-token"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNotionForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect Notion OKR Database</h3>
              <button 
                onClick={() => setShowNotionForm(false)}
                className="text-zinc-500 hover:text-white text-md font-bold"
              >
                ×
              </button>
            </div>

            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-sky-300">Notion setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a Notion internal integration and copy the secret.</li>
                <li>Open your OKR database, click <strong>Share</strong>, and invite the integration.</li>
                <li>Copy the database ID from the database URL.</li>
                <li>Recommended properties: <code className="text-sky-300">Objective</code>, <code className="text-sky-300">Key Result</code>, <code className="text-sky-300">Owner</code>, <code className="text-sky-300">Status</code>, <code className="text-sky-300">Progress</code>, <code className="text-sky-300">Quarter</code>, <code className="text-sky-300">Due Date</code>.</li>
              </ol>
            </div>

            <form onSubmit={handleNotionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Internal Integration Secret</label>
                <input
                  type="password"
                  value={notionApiKey}
                  onChange={(e) => setNotionApiKey(e.target.value)}
                  placeholder="secret_... or ntn_..."
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">OKR Database ID</label>
                <input
                  type="text"
                  value={notionDatabaseId}
                  onChange={(e) => setNotionDatabaseId(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button
                  type="button"
                  onClick={() => setShowNotionForm(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHubspotForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect HubSpot Deal Pipeline</h3>
              <button 
                onClick={() => setShowHubspotForm(false)}
                className="text-zinc-500 hover:text-white text-md font-bold"
              >
                ×
              </button>
            </div>

            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-orange-300">HubSpot setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a HubSpot Private App in your HubSpot account.</li>
                <li>Add CRM read scopes for deals, pipelines, and owners.</li>
                <li>Copy the Private App access token and paste it below.</li>
                <li>After connecting, open <code className="text-orange-300">/pipeline</code> and click <strong>Sync HubSpot Deals</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleHubSpotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Private App Access Token</label>
                <input
                  type="password"
                  value={hubspotAccessToken}
                  onChange={(e) => setHubspotAccessToken(e.target.value)}
                  placeholder="pat-... or HubSpot private app token"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button
                  type="button"
                  onClick={() => setShowHubspotForm(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLinearForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect Linear Tickets</h3>
              <button 
                onClick={() => setShowLinearForm(false)}
                className="text-zinc-500 hover:text-white text-md font-bold"
              >
                ×
              </button>
            </div>

            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-violet-300">Linear setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a Linear personal API key from account security settings.</li>
                <li>Paste the key below. TAI Chief uses Linear&apos;s official npm SDK.</li>
                <li>After connecting, open <code className="text-violet-300">/tickets</code> and click <strong>Sync Linear Tickets</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleLinearSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Linear API Key</label>
                <input
                  type="password"
                  value={linearApiKey}
                  onChange={(e) => setLinearApiKey(e.target.value)}
                  placeholder="lin_api_... or Linear personal API key"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button
                  type="button"
                  onClick={() => setShowLinearForm(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClickupForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect ClickUp Workspace</h3>
              <button 
                onClick={() => setShowClickupForm(false)}
                className="text-zinc-500 hover:text-white text-md font-bold"
              >
                ×
              </button>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-emerald-300">ClickUp setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Generate a ClickUp personal API token from ClickUp Apps settings, or use OAuth if configured.</li>
                <li>Paste the token below. Personal tokens usually begin with <code className="text-emerald-300">pk_</code>.</li>
                <li>Workspace ID is optional. If omitted, TAI Chief uses the first authorized workspace.</li>
                <li>After connecting, open <code className="text-emerald-300">/clickup</code> and click <strong>Sync ClickUp</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleClickUpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Personal API Token or OAuth Token</label>
                <input
                  type="password"
                  value={clickupToken}
                  onChange={(e) => setClickupToken(e.target.value)}
                  placeholder="pk_... or ClickUp OAuth access token"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Workspace ID</label>
                <input
                  type="text"
                  value={clickupWorkspaceId}
                  onChange={(e) => setClickupWorkspaceId(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              
              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button
                  type="button"
                  onClick={() => setShowClickupForm(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJiraForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect Jira Cloud</h3>
              <button onClick={() => setShowJiraForm(false)} className="text-zinc-500 hover:text-white text-md font-bold">×</button>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-blue-300">Jira setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Use your Atlassian site URL, for example <code className="text-blue-300">https://company.atlassian.net</code>.</li>
                <li>Create an Atlassian API token from your account security settings.</li>
                <li>Paste your account email and token below.</li>
                <li>Optionally customize JQL. After connecting, open <code className="text-blue-300">/jira</code> and click <strong>Sync Jira</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleJiraSubmit} className="space-y-4">
              <input type="url" value={jiraSiteUrl} onChange={(e) => setJiraSiteUrl(e.target.value)} placeholder="https://company.atlassian.net" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
              <input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="you@company.com" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
              <input type="password" value={jiraApiToken} onChange={(e) => setJiraApiToken(e.target.value)} placeholder="Atlassian API token" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" required />
              <input type="text" value={jiraJql} onChange={(e) => setJiraJql(e.target.value)} placeholder="order by updated DESC" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />

              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button type="button" onClick={() => setShowJiraForm(false)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors">Verify & Connect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfluenceForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect Confluence Cloud</h3>
              <button onClick={() => setShowConfluenceForm(false)} className="text-zinc-500 hover:text-white text-md font-bold">×</button>
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-cyan-300">Confluence setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Use your Atlassian site URL, for example <code className="text-cyan-300">https://company.atlassian.net</code>.</li>
                <li>Create an Atlassian API token from your account security settings.</li>
                <li>Paste your account email and token below.</li>
                <li>Optionally customize CQL. After connecting, open <code className="text-cyan-300">/confluence</code> and click <strong>Sync Confluence</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleConfluenceSubmit} className="space-y-4">
              <input type="url" value={confluenceSiteUrl} onChange={(e) => setConfluenceSiteUrl(e.target.value)} placeholder="https://company.atlassian.net" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" required />
              <input type="email" value={confluenceEmail} onChange={(e) => setConfluenceEmail(e.target.value)} placeholder="you@company.com" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" required />
              <input type="password" value={confluenceApiToken} onChange={(e) => setConfluenceApiToken(e.target.value)} placeholder="Atlassian API token" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" required />
              <input type="text" value={confluenceCql} onChange={(e) => setConfluenceCql(e.target.value)} placeholder="type=page order by lastmodified desc" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />

              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button type="button" onClick={() => setShowConfluenceForm(false)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors">Verify & Connect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGithubForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect GitHub Engineering</h3>
              <button onClick={() => setShowGithubForm(false)} className="text-zinc-500 hover:text-white text-md font-bold">×</button>
            </div>

            <div className="rounded-lg border border-slate-500/20 bg-slate-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-slate-200">GitHub setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create a fine-grained GitHub personal access token or GitHub App token.</li>
                <li>Grant read access for repository metadata, issues, and pull requests.</li>
                <li>Owner is optional. Use it for an organization or user such as <code className="text-slate-200">acme-inc</code>.</li>
                <li>Repos is optional. Use comma-separated names like <code className="text-slate-200">web,api</code> or full names like <code className="text-slate-200">acme/web,acme/api</code>.</li>
                <li>After connecting, open <code className="text-slate-200">/github</code> and click <strong>Sync GitHub</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleGitHubSubmit} className="space-y-4">
              <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} placeholder="GitHub token" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" required />
              <input type="text" value={githubOwner} onChange={(e) => setGithubOwner(e.target.value)} placeholder="Owner or organization, optional" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />
              <input type="text" value={githubRepos} onChange={(e) => setGithubRepos(e.target.value)} placeholder="Comma-separated repos, optional" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" />

              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button type="button" onClick={() => setShowGithubForm(false)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-xs font-semibold text-white transition-colors">Verify & Connect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAsanaForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#27272a] bg-[#121215] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <h3 className="text-md font-semibold text-white">Connect Asana Work Management</h3>
              <button onClick={() => setShowAsanaForm(false)} className="text-zinc-500 hover:text-white text-md font-bold">×</button>
            </div>

            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-zinc-400 space-y-2">
              <h4 className="font-semibold text-rose-300">Asana setup</h4>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Create an Asana personal access token or OAuth token.</li>
                <li>Grant access to the workspaces, projects, and tasks you want TAI Chief to read.</li>
                <li>Workspace GID is optional. If omitted, TAI Chief uses the first authorized workspace.</li>
                <li>Project GIDs are optional. Use comma-separated project GIDs to limit sync scope.</li>
                <li>After connecting, open <code className="text-rose-300">/asana</code> and click <strong>Sync Asana</strong>.</li>
              </ol>
            </div>

            <form onSubmit={handleAsanaSubmit} className="space-y-4">
              <input type="password" value={asanaToken} onChange={(e) => setAsanaToken(e.target.value)} placeholder="Asana personal access token or OAuth token" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500" required />
              <input type="text" value={asanaWorkspaceGid} onChange={(e) => setAsanaWorkspaceGid(e.target.value)} placeholder="Workspace GID, optional" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500" />
              <input type="text" value={asanaProjectGids} onChange={(e) => setAsanaProjectGids(e.target.value)} placeholder="Comma-separated project GIDs, optional" className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500" />

              <div className="flex justify-end gap-3 border-t border-[#27272a] pt-4">
                <button type="button" onClick={() => setShowAsanaForm(false)} className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors">Verify & Connect</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(integrations).map(([id, info]) => {
          const detail = integrationDetails[id] || {
            description: "Connect to your strategic operational data sources.",
            color: "from-zinc-500/10 to-[#121214]",
            iconBg: "bg-zinc-500/10 text-zinc-300",
          };

          const isSlack = id === "slack";
          const isNotion = id === "notion";
          const isHubSpot = id === "hubspot";
          const isLinear = id === "linear";
          const isClickUp = id === "clickup";
          const isJira = id === "jira";
          const isConfluence = id === "confluence";
          const isGitHub = id === "github";
          const isAsana = id === "asana";

          return (
            <div
              key={id}
              className={`flex flex-col justify-between rounded-xl border bg-gradient-to-b p-6 shadow-sm transition-all duration-300 ${
                info.connected 
                  ? "border-emerald-500/30 shadow-emerald-500/5" 
                  : `border-[#27272a] hover:border-zinc-600`
              } ${detail.color}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${detail.iconBg}`}>
                    <span className="text-2xl">{info.icon}</span>
                  </div>
                  {info.connected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                      Disconnected
                    </span>
                  )}
                </div>
                
                <h3 className="text-lg font-medium text-white">{info.name}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{detail.description}</p>

                {info.connected && isSlack && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Workspace:</span> {info.team_name}</div>
                    <div><span className="text-zinc-600 font-semibold">Bot ID:</span> {info.bot_user_id}</div>
                  </div>
                )}

                {info.connected && isNotion && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Database:</span> {info.database_title || "OKR Database"}</div>
                    <div><span className="text-zinc-600 font-semibold">Database ID:</span> {info.database_id || "Configured in env"}</div>
                  </div>
                )}

                {info.connected && isHubSpot && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Portal:</span> {info.portal_id || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">Token:</span> {info.hasToken ? "Stored server-side" : "Connected"}</div>
                  </div>
                )}

                {info.connected && isLinear && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Workspace:</span> {info.organization_name || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_email || info.user_name || "Linear API key"}</div>
                  </div>
                )}

                {info.connected && isClickUp && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Workspace:</span> {info.workspace_name || info.workspace_id || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_name || "ClickUp token"}</div>
                  </div>
                )}

                {info.connected && isJira && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Site:</span> {info.site_url || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_name || info.email || "Jira API token"}</div>
                    <div><span className="text-zinc-600 font-semibold">JQL:</span> {info.jql || "order by updated DESC"}</div>
                  </div>
                )}

                {info.connected && isConfluence && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Site:</span> {info.site_url || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_name || info.email || "Confluence API token"}</div>
                    <div><span className="text-zinc-600 font-semibold">CQL:</span> {info.cql || "type=page order by lastmodified desc"}</div>
                  </div>
                )}

                {info.connected && isGitHub && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_name || info.user_login || "GitHub token"}</div>
                    <div><span className="text-zinc-600 font-semibold">Owner:</span> {info.owner || "All authorized repos"}</div>
                    <div><span className="text-zinc-600 font-semibold">Repos:</span> {info.repos || "Auto-discover"}</div>
                  </div>
                )}

                {info.connected && isAsana && (
                  <div className="mt-4 rounded-lg bg-zinc-900/40 p-3 border border-[#27272a] text-[11px] space-y-1 text-zinc-400">
                    <div><span className="text-zinc-600 font-semibold">Workspace:</span> {info.workspace_name || info.workspace_gid || "Configured in env"}</div>
                    <div><span className="text-zinc-600 font-semibold">User:</span> {info.user_email || info.user_name || "Asana token"}</div>
                    <div><span className="text-zinc-600 font-semibold">Projects:</span> {info.project_gids || "Auto-discover"}</div>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-[#27272a] pt-4">
                {info.connected ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">{info.name}: Active</span>
                    <button
                      onClick={() => handleDisconnect(id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    >
                      Disconnect Link
                    </button>
                  </div>
                ) : isSlack ? (
                  <div className="flex flex-col gap-2">
                    {oauthSupported ? (
                      <button
                        onClick={handleOAuthConnect}
                        className="flex w-full items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition-colors"
                      >
                        ⚡ Connect in One-Click
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowManualForm(true)}
                        className="flex w-full items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition-colors"
                      >
                        ⚡ Configure manually
                      </button>
                    )}
                    <button
                      onClick={() => setShowManualForm(true)}
                      className="text-center text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                    >
                      Or paste bot token manually
                    </button>
                  </div>
                ) : isNotion ? (
                  <button
                    onClick={() => setShowNotionForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect Notion OKRs
                  </button>
                ) : isHubSpot ? (
                  <button
                    onClick={() => setShowHubspotForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-orange-600 hover:bg-orange-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect HubSpot Deals
                  </button>
                ) : isLinear ? (
                  <button
                    onClick={() => setShowLinearForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect Linear Tickets
                  </button>
                ) : isClickUp ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleClickUpOAuthConnect}
                      className="flex w-full items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      Connect ClickUp OAuth
                    </button>
                    <button
                      onClick={() => setShowClickupForm(true)}
                      className="text-center text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                    >
                      Or paste personal token manually
                    </button>
                  </div>
                ) : isJira ? (
                  <button
                    onClick={() => setShowJiraForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect Jira Issues
                  </button>
                ) : isConfluence ? (
                  <button
                    onClick={() => setShowConfluenceForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-cyan-600 hover:bg-cyan-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect Confluence
                  </button>
                ) : isGitHub ? (
                  <button
                    onClick={() => setShowGithubForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-slate-600 hover:bg-slate-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect GitHub
                  </button>
                ) : isAsana ? (
                  <button
                    onClick={() => setShowAsanaForm(true)}
                    className="flex w-full items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-semibold text-white transition-colors"
                  >
                    Connect Asana
                  </button>
                ) : (
                  <div className="text-center text-xs text-zinc-500 italic py-2">
                    Coming soon for non-sandbox environments.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Notice */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
        <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
          <span>🔒</span> Data Control & Privacy
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          The application processes emails, calendar slots, and chat channels strictly to map tasks and priorities. 
          All metrics are loaded directly into RAM, and database snapshots are encrypted. It never trains public AI models on your data, nor sell it. 
          You can sever integrations or purge your workspace data at any time from this console.
        </p>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[70vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      }
    >
      <IntegrationsPageContent />
    </Suspense>
  );
}
