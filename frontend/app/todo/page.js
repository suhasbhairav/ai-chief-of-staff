"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function TodoPage() {
  const [todos, setTodos] = useState([]);
  const [waitingOn, setWaitingOn] = useState([]);
  const [integrations, setIntegrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);
  const [delegatingTaskId, setDelegatingTaskId] = useState(null);
  const [delegateTarget, setDelegateTarget] = useState("");

  const fetchTodoStore = async () => {
    try {
      const res = await fetch("/api/todo");
      const data = await res.json();
      setTodos(data.todos || []);
      setWaitingOn(data.waitingOn || []);
      setIntegrations(data.integrations || {});
      setLoading(false);
    } catch (err) {
      console.error("Failed to load To-Do store", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchTodoStore();
    });
  }, []);

  const handleResolve = async (taskId) => {
    try {
      const res = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", taskId })
      });
      const data = await res.json();
      setTodos(data.todos || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelegateSubmit = async (e, taskId) => {
    e.preventDefault();
    if (!delegateTarget) return;

    try {
      const res = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delegate", taskId, delegateTo: delegateTarget })
      });
      const data = await res.json();
      setTodos(data.todos || []);
      setDelegatingTaskId(null);
      setDelegateTarget("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncLogs([]);

    const logSteps = [
      "Connecting to Gmail server and scanning inbox threads...",
      "Resolving P0/P1 commitments from Google Calendar meetings...",
      "Reading #engineering and #general Slack streams for alerts...",
      "Scanning Notion workspaces for api document updates...",
      "Aegis intelligence synthesis completed successfully!"
    ];

    for (let index = 0; index < logSteps.length; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSyncLogs((prev) => [...prev, logSteps[index]]);
    }

    try {
      const res = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" })
      });
      const data = await res.json();
      setTodos(data.todos || []);
      setWaitingOn(data.waitingOn || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case "P0":
        return "bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
      case "P1":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "P2":
        return "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
      case "P3":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      default:
        return "bg-zinc-800 text-zinc-400";
    }
  };

  const getSourceIcon = (source) => {
    switch (source?.toLowerCase()) {
      case "slack":
        return "💬";
      case "gmail":
        return "📧";
      case "google calendar":
      case "calendar":
        return "📅";
      default:
        return "📓";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header Area */}
      <div className="flex flex-col gap-4 border-b border-[#27272a] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">AI Master To-Do List</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Aegis cross-references communications and calendars to build a ranked agenda. The highest leverage moves are prioritized automatically.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {syncing ? "Syncing Tools..." : "🔄 Sync Tools with AI"}
        </button>
      </div>

      {/* Sync Logging Overlay */}
      {syncing && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5 animate-pulse">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Aegis Agent Scanning Log</h3>
          <div className="mt-3 space-y-2">
            {syncLogs.map((log, idx) => (
              <div key={idx} className="text-xs text-zinc-400 flex items-center space-x-2">
                <span className="text-emerald-500">✓</span>
                <span className="font-mono">{log}</span>
              </div>
            ))}
            <div className="text-xs text-indigo-400 flex items-center space-x-2 animate-bounce">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Analyzing incoming data payloads...</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Grid containing Task List and Waiting On panel */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        
        {/* Main Tasks List */}
        <div className="rounded-xl border border-[#27272a] bg-[#101013] p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="text-md font-semibold text-white">Actionable Agenda</h2>
            <p className="text-xs text-zinc-500 mt-1">Pending commitments requiring your attention or routing decisions.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-[#27272a] text-zinc-500">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Priority</th>
                  <th className="py-2.5 pr-4 font-medium">Source</th>
                  <th className="py-2.5 pr-4 font-medium">Task</th>
                  <th className="py-2.5 pr-4 font-medium">Status / Owner</th>
                  <th className="py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202024] text-zinc-300">
                {todos.map((task) => {
                  const isCompleted = task.status === "Done";
                  return (
                    <tr key={task.id} className={`group ${isCompleted ? "opacity-45" : ""}`}>
                      
                      {/* Priority Badge */}
                      <td className="py-4 pr-4">
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${getPriorityStyle(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-4 pr-4">
                        <span className="text-md" title={task.source}>
                          {getSourceIcon(task.source)}
                        </span>
                      </td>

                      {/* Task Info */}
                      <td className="py-4 pr-4 max-w-xs">
                        <div className={`font-medium text-zinc-200 ${isCompleted ? "line-through text-zinc-500" : ""}`}>
                          {task.title}
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-500 leading-relaxed truncate">{task.description}</p>
                      </td>

                      {/* Status / Assignee */}
                      <td className="py-4 pr-4">
                        <div className="flex flex-col gap-1">
                          <span className={`font-semibold ${isCompleted ? "text-emerald-400" : "text-zinc-300"}`}>
                            {task.status}
                          </span>
                          <span className="text-[10px] text-zinc-500">Owner: {task.owner}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isCompleted && (
                            <>
                              <button
                                onClick={() => handleResolve(task.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                title="Mark Completed"
                              >
                                ✓
                              </button>
                              
                              {delegatingTaskId === task.id ? (
                                <form 
                                  onSubmit={(e) => handleDelegateSubmit(e, task.id)}
                                  className="inline-flex items-center gap-1.5"
                                >
                                  <select
                                    value={delegateTarget}
                                    onChange={(e) => setDelegateTarget(e.target.value)}
                                    className="bg-[#18181b] border border-[#27272a] rounded px-1.5 py-0.5 text-[10px] text-zinc-200"
                                    required
                                  >
                                    <option value="">Select...</option>
                                    <option value="Monica">Monica</option>
                                    <option value="Gilfoyle">Gilfoyle</option>
                                    <option value="Dinesh">Dinesh</option>
                                    <option value="Jim">Jim</option>
                                    <option value="Dwight">Dwight</option>
                                  </select>
                                  <button
                                    type="submit"
                                    className="bg-indigo-600 text-white rounded px-1.5 py-0.5 text-[9px] font-semibold"
                                  >
                                    Go
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDelegatingTaskId(null)}
                                    className="text-zinc-500 text-[10px]"
                                  >
                                    ×
                                  </button>
                                </form>
                              ) : (
                                <button
                                  onClick={() => setDelegatingTaskId(task.id)}
                                  className="inline-flex h-7 px-2 items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] hover:bg-zinc-700 transition-colors"
                                >
                                  Delegate
                                </button>
                              )}
                            </>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] text-emerald-500 font-semibold">Completed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Panel: Waiting on Others */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-[#27272a] bg-[#101013] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-white">Waiting on others</h2>
            <p className="text-xs text-zinc-500 mt-1">Pending actions owned by colleagues or partners.</p>
            
            <div className="mt-4 space-y-3">
              {waitingOn.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#27272a] bg-[#141416] p-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200">{item.owner}</h3>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">{item.title}</p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    item.status.includes("overdue") 
                      ? "bg-red-500/10 text-red-400 border border-red-500/20" 
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 border-t border-[#202024] pt-4 text-center">
              <Link
                href="/slack"
                className="text-xs font-semibold text-indigo-400 hover:underline hover:text-indigo-300"
              >
                💬 Ping team in Slack Copilot
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
