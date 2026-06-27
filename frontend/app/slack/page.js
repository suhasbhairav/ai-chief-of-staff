"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function SlackPage() {
  const [activeTab, setActiveTab] = useState("agent"); // "agent" or the real Slack channel ID
  const [activeChannelName, setActiveChannelName] = useState("ChiefStaff AI");
  const [integrations, setIntegrations] = useState({});
  const [channels, setChannels] = useState([]);
  const [channelMessages, setChannelMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [dmMessages, setDmMessages] = useState([
    {
      id: "welcome",
      sender: "ChiefStaff AI",
      avatar: "👑",
      time: "Today",
      text: "Hey Richard! I'm Aegis from AICoS - AI Chief of Staff. I'm connected to your email, calendar, and Slack workspace channels. I've compiled your morning task brief.\n\n*How can I help you run the company today?*\n- 'What are my top priorities?'\n- 'Complete task-3'\n- 'Delegate task-1 to Jim'\n- 'Draft a response to Gavin Belson'",
      isAgent: true
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages, channelMessages, isTyping]);

  // Load channels and messages whenever active tab changes
  useEffect(() => {
    if (activeTab !== "agent") {
      fetchChannelMessages(activeTab);
      // Auto-poll messages every 6 seconds to keep it live
      const interval = setInterval(() => {
        fetchChannelMessages(activeTab, true);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchWorkspaceData = async () => {
    try {
      // 1. Fetch integrations
      const intRes = await fetch("/api/integrations");
      const intData = await intRes.json();
      setIntegrations(intData.integrations || {});

      // 2. If Slack is connected, fetch real channels
      if (intData.integrations?.slack?.connected) {
        const chanRes = await fetch("/api/slack/channels");
        const chanData = await chanRes.json();
        if (chanRes.ok && chanData.channels) {
          setChannels(chanData.channels);
          // Default to the first channel if there's one, otherwise stay on agent DM
          if (chanData.channels.length > 0) {
            // Keep on agent DM as default entry point
            setActiveTab("agent");
          }
        }
      }
      setLoading(false);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setLoading(false);
    }
  };

  const fetchChannelMessages = async (channelId, quiet = false) => {
    try {
      const res = await fetch(`/api/slack/channels/${channelId}/messages`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setChannelMessages(data.messages);
      }
    } catch (err) {
      console.error(`Failed to fetch messages for channel ${channelId}:`, err);
    }
  };

  const handleConnectSlack = async () => {
    setLoading(true);
    // If OAuth is supported redirect to authorize, otherwise let them connect manually
    const intRes = await fetch("/api/integrations");
    const intData = await intRes.json();
    if (intData.oauthSupported) {
      window.location.href = "/api/integrations/slack/authorize";
    } else {
      alert("Please open the Integrations Hub page in the sidebar and paste your Slack Bot User Token to connect.");
      window.location.href = "/integrations";
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText("");

    if (activeTab === "agent") {
      // Direct Message to AI agent
      const userMsg = {
        id: Math.random().toString(),
        sender: "Richard Hendricks",
        avatar: "🥪",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: textToSend
      };

      setDmMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const history = dmMessages.map((m) => ({
          sender: m.isAgent ? "agent" : "user",
          text: m.text
        }));

        const res = await fetch("/api/slack-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: textToSend, messagesHistory: history })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to communicate with Slack agent.");
        }

        setDmMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "ChiefStaff AI",
            avatar: "👑",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: data.text,
            isAgent: true
          }
        ]);

        if (data.actions && data.actions.length > 0) {
          data.actions.forEach((act) => {
            let alertText = "";
            if (act.type === "resolve") {
              alertText = `✓ AI Agent resolved task: "${act.taskId}"`;
            } else if (act.type === "delegate") {
              alertText = `➜ AI Agent delegated task: "${act.taskId}" to ${act.to}`;
            } else if (act.type === "add") {
              alertText = `✚ AI Agent added new task: "${act.task.title}"`;
            }
            
            setActionAlert(alertText);
            setTimeout(() => setActionAlert(null), 5000);
          });
        }
      } catch (err) {
        console.error(err);
        setDmMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: "ChiefStaff AI",
            avatar: "👑",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `Error communicating with Aegis core API: ${err.message}`,
            isAgent: true
          }
        ]);
      } finally {
        setIsTyping(false);
      }
    } else {
      // Post to active channel on Slack
      try {
        // Optimistically add message
        const tempMsg = {
          id: Math.random().toString(),
          sender: "Richard Hendricks (You)",
          avatar: "👤",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: textToSend
        };
        setChannelMessages((prev) => [...prev, tempMsg]);

        const res = await fetch(`/api/slack/channels/${activeTab}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSend })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to post message.");
        }

        // Re-fetch channel messages to align timestamps
        fetchChannelMessages(activeTab);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to post to Slack");
      }
    }
  };

  const handleTabChange = (tabId, tabName) => {
    setActiveTab(tabId);
    setActiveChannelName(tabName);
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const isSlackConnected = integrations.slack && integrations.slack.connected;

  return (
    <div className="h-[calc(100vh-10rem)] w-full rounded-2xl border border-[#27272a] bg-[#0c0c0e] overflow-hidden flex relative animate-in fade-in duration-300">
      
      {/* 1. Slack Onboarding Overlay if disconnected */}
      {!isSlackConnected && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 p-6 text-center backdrop-blur-md">
          <div className="max-w-md space-y-6 rounded-2xl border border-indigo-500/20 bg-[#121215] p-8 shadow-2xl">
            <span className="text-5xl">💬</span>
            <h2 className="text-xl font-semibold text-white">Connect Live Slack Workspace</h2>
            <p className="text-xs leading-relaxed text-zinc-400">
              Integrate Aegis AI Chief into your Slack workspace. 
              Deploy our background agent to read project threads, scan channels for task commitments, and manage your Master To-Do list live.
            </p>
            <button
              onClick={handleConnectSlack}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              🔌 Configure Slack Integration
            </button>
            <p className="text-[10px] text-zinc-600">
              Uses Slack OAuth, Web API, Events API, and signed request verification. No simulator messages are generated.
            </p>
          </div>
        </div>
      )}

      {/* Action Notification Toast */}
      {actionAlert && (
        <div className="absolute right-4 top-4 z-40 animate-bounce rounded-lg border border-emerald-500/30 bg-[#0e1610] px-4 py-3 text-xs text-emerald-400 shadow-lg flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {actionAlert}
        </div>
      )}

      {/* 2. Slack Workspace Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#202024] bg-[#09090b] flex flex-col justify-between">
        <div>
          {/* Workspace Title */}
          <div className="p-4 border-b border-[#202024] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-5 w-5 bg-indigo-500 rounded text-center text-xs font-semibold text-white flex items-center justify-center">S</span>
              <span className="font-semibold text-xs text-white tracking-tight truncate">
                {integrations.slack?.team_name || "Slack Workspace"}
              </span>
            </div>
            <span className="text-xs text-zinc-500">▼</span>
          </div>

          {/* Channels Navigation */}
          <nav className="p-3 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1">
              <div className="px-2 text-[10px] uppercase font-bold text-zinc-600 tracking-wider">Live Channels</div>
              {channels.length > 0 ? (
                channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleTabChange(channel.id, `#${channel.name}`)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center space-x-1.5 ${
                      activeTab === channel.id 
                        ? "bg-[#18181b] text-white font-medium" 
                        : "text-zinc-500 hover:bg-[#121214] hover:text-zinc-300"
                    }`}
                  >
                    <span className="text-zinc-600">#</span>
                    <span className="truncate">{channel.name}</span>
                  </button>
                ))
              ) : (
                <div className="px-2 py-1 text-[10px] text-zinc-600 italic">No channels joined yet</div>
              )}
            </div>

            <div className="space-y-1">
              <div className="px-2 text-[10px] uppercase font-bold text-zinc-600 tracking-wider">Direct Messages</div>
              <button
                onClick={() => handleTabChange("agent", "ChiefStaff AI")}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between ${
                  activeTab === "agent" 
                    ? "bg-[#18181b] text-white font-medium" 
                    : "text-zinc-500 hover:bg-[#121214] hover:text-zinc-300"
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <span className="text-emerald-500 text-[10px]">●</span>
                  <span className="truncate">ChiefStaff AI</span>
                  <span className="shrink-0 text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">App</span>
                </div>
              </button>
            </div>
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-[#202024] bg-[#09090b] flex items-center space-x-2">
          <span className="text-sm">👤</span>
          <div className="truncate">
            <div className="text-[11px] font-medium text-white leading-none truncate">CEO (Richard)</div>
            <div className="text-[9px] text-zinc-500 truncate mt-0.5">Workspace Connected</div>
          </div>
        </div>
      </aside>

      {/* 3. Slack Chat Workspace Frame */}
      <main className="flex-1 flex flex-col bg-[#0c0c0e]">
        {/* Chat Header */}
        <header className="px-5 py-3 border-b border-[#202024] flex items-center justify-between bg-[#0a0a0c]">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-white flex items-center space-x-1.5">
              <span>{activeTab === "agent" ? "👑" : "#"}</span>
              <span>{activeChannelName}</span>
            </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
              {activeTab === "agent" 
                ? "In-app command center backed by live Slack/Supabase context. DM the Slack app in Slack for real workspace replies." 
                : "Real-time feed linked directly to Slack channel APIs"}
            </p>
          </div>
          {activeTab === "agent" && (
            <Link
              href="/todo"
              className="text-[10px] font-semibold text-indigo-400 hover:underline hover:text-indigo-300"
            >
              📋 Open Master To-Do
            </Link>
          )}
        </header>

        {/* Chat Feed Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "agent" ? (
            // Direct Message with AI Agent
            dmMessages.map((msg) => (
              <div key={msg.id} className="flex items-start space-x-3 text-xs">
                <div className="h-8 w-8 rounded-md bg-[#18181b] border border-[#27272a] flex items-center justify-center text-sm shrink-0">
                  {msg.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-zinc-200">{msg.sender}</span>
                    {msg.isAgent && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-medium">App</span>
                    )}
                    <span className="text-[9px] text-zinc-500">{msg.time}</span>
                  </div>
                  <p className="mt-1 text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))
          ) : (
            // Channel Real Messages
            channelMessages.length > 0 ? (
              channelMessages.map((msg) => (
                <div key={msg.id} className="flex items-start space-x-3 text-xs">
                  <div className="h-8 w-8 rounded-md bg-[#18181b] border border-[#27272a] flex items-center justify-center text-sm shrink-0">
                    {msg.isAgent ? "👑" : "👤"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-zinc-200">
                        {msg.sender === integrations.slack?.bot_user_id ? "ChiefStaff AI" : msg.sender}
                      </span>
                      {msg.isAgent && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-medium">App</span>
                      )}
                      <span className="text-[9px] text-zinc-500">{msg.time}</span>
                    </div>
                    <p className="mt-1 text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600 italic">
                No messages found in this channel yet.
              </div>
            )
          )}
          
          {/* Typing indicator */}
          {activeTab === "agent" && isTyping && (
            <div className="flex items-start space-x-3 text-xs">
              <div className="h-8 w-8 rounded-md bg-[#18181b] border border-[#27272a] flex items-center justify-center text-sm shrink-0">
                👑
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-zinc-200">ChiefStaff AI</span>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded font-medium">App</span>
                  <span className="text-[9px] text-zinc-500">just now</span>
                </div>
                <div className="flex items-center space-x-1.5 mt-2 bg-[#121214] py-1 px-3 rounded-full border border-[#27272a] w-fit">
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Input box footer */}
        <footer className="p-4 border-t border-[#202024] bg-[#0c0c0e]">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeTab === "agent" 
                  ? "Message ChiefStaff AI (e.g. 'Complete task-3', 'Who owns wait-1?')"
                  : `Send message to ${activeChannelName}`
              }
              className="flex-1 bg-[#141416] border border-[#27272a] rounded-lg px-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
            >
              Send
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
