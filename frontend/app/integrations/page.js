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

      if (slackSuccess) {
        setApiSuccess("Slack integrated successfully via OAuth!");
        setTimeout(() => setApiSuccess(""), 6000);
      } else if (slackError) {
        setApiError(`Slack integration failed: ${slackError}`);
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
      description: "Install the real Slack app. Aegis reads approved channels and DMs, harvests commitments, ranks P0/P1 work, and replies in Slack through Slack Web API and Events API.",
      color: "from-[#4a154b]/30 to-[#121214]",
      iconBg: "bg-[#4a154b]/20 text-[#e01e5a]",
    },
    gmail: {
      description: "Seamlessly parse inbound emails and calendars. Aegis monitors deadlines, drafts context-aware replies for review, and identifies commitments from meetings.",
      color: "from-red-500/10 to-[#121214]",
      iconBg: "bg-red-500/10 text-red-400",
    },
    notion: {
      description: "Sync live Product OKRs from a real Notion database, track owners, progress, risk, due dates, and objective health inside the Product dashboard.",
      color: "from-sky-500/15 to-[#121214]",
      iconBg: "bg-sky-500/10 text-sky-200",
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="border-b border-[#27272a] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tool Integrations Hub</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-3xl">
          Connect your organization&apos;s primary data sources. Aegis syncs conversations, mail threads, and calendars into a consolidated company brain to determine your highest-leverage move.
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
