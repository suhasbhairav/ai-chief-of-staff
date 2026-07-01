"use client";

import React, { useMemo, useRef, useState } from "react";

const DEPARTMENTS = [
  { id: "all", name: "All Departments", shortName: "Org-wide", tone: "from-cyan-400 to-violet-500" },
  { id: "executive", name: "Executive", shortName: "CEO", tone: "from-amber-300 to-rose-500" },
  { id: "finance", name: "Finance & Treasury", shortName: "Finance", tone: "from-emerald-300 to-teal-600" },
  { id: "sales", name: "Sales & Revenue", shortName: "Sales", tone: "from-blue-300 to-indigo-600" },
  { id: "marketing", name: "Marketing & Comm", shortName: "Marketing", tone: "from-fuchsia-300 to-pink-600" },
  { id: "product", name: "Product Management", shortName: "Product", tone: "from-sky-300 to-blue-600" },
  { id: "operations", name: "Operations & Supply Chain", shortName: "Ops", tone: "from-lime-300 to-emerald-600" },
  { id: "customer-service", name: "Customer Support", shortName: "Support", tone: "from-orange-300 to-red-500" },
  { id: "hr", name: "Human Resources", shortName: "HR", tone: "from-violet-300 to-purple-600" },
  { id: "legal", name: "Legal & Compliance", shortName: "Legal", tone: "from-stone-200 to-zinc-500" },
  { id: "it", name: "Information Technology", shortName: "IT", tone: "from-cyan-300 to-blue-600" },
  { id: "risk", name: "Risk & Internal Audit", shortName: "Risk", tone: "from-red-300 to-rose-700" },
  { id: "strategy", name: "Corporate Strategy", shortName: "Strategy", tone: "from-yellow-200 to-orange-500" },
  { id: "rd", name: "R&D & Innovation", shortName: "R&D", tone: "from-indigo-300 to-violet-600" },
];

const STARTER_PROMPTS = [
  "What should I worry about this week as CEO?",
  "Summarize the biggest cross-functional risks.",
  "What should go into the next board memo?",
  "Compare GTM efficiency with product and support health.",
];

const initialMessages = [
  {
    role: "assistant",
    content:
      "Ask me about any department, company risk, board narrative, operating priority, or metric tradeoff. I will retrieve the relevant Supabase vector context first, then use the configured LLM only when you send a question.",
    sources: [],
  },
];

const formatSimilarity = (value) => {
  if (typeof value !== "number") return "n/a";
  return `${Math.round(value * 100)}%`;
};

export default function AssistantPage() {
  const [departmentId, setDepartmentId] = useState("all");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef(null);

  const selectedDepartment = useMemo(
    () => DEPARTMENTS.find((department) => department.id === departmentId) || DEPARTMENTS[0],
    [departmentId]
  );

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const latestSources = latestAssistant?.sources || [];

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage = { role: "user", content: trimmed, sources: [] };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setStatus("Planning retrieval and searching operating context...");

    try {
      const response = await fetch("/api/ceo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          departmentId,
          messages: nextMessages.slice(-8),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "CEO assistant failed to respond.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer,
          plan: payload.plan,
          retrievalError: payload.retrievalError,
          sources: payload.sources || [],
        },
      ]);
      setStatus(payload.retrievalError || "Answer generated from the latest operating context.");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong while asking the CEO assistant.",
          sources: [],
          isError: true,
        },
      ]);
      setStatus("Assistant request failed.");
    } finally {
      setIsSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const rebuildEmbeddings = async () => {
    if (isRebuilding) return;
    setIsRebuilding(true);
    setStatus(`Rebuilding vector memory for ${selectedDepartment.name}...`);

    try {
      const response = await fetch("/api/embeddings/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Embedding rebuild failed.");
      }

      setStatus(
        payload.rebuilt
          ? `Vector memory refreshed with ${payload.rebuilt} embedded chunks.`
          : payload.message || "No snapshots were available to embed."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Embedding rebuild failed.");
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] space-y-5">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-[#101013] shadow-2xl">
        <div className={`h-1.5 bg-gradient-to-r ${selectedDepartment.tone}`} />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-6">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
              Supabase vector memory + guarded LLM reasoning
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              CEO Chat Assistant
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Chat across company data, drill into departments, retrieve the right embedded evidence from Supabase, and turn it into executive action.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Operating Lens
            </label>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="h-11 rounded-md border border-zinc-700 bg-[#15151a] px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            >
              {DEPARTMENTS.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={rebuildEmbeddings}
              disabled={isRebuilding}
              className="h-11 rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRebuilding ? "Rebuilding Memory..." : "Rebuild Vector Memory"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-h-[36rem] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#101013]">
          <div className="border-b border-zinc-800 p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="rounded-full border border-zinc-700 bg-[#15151a] px-3 py-1.5 text-left text-xs font-medium text-zinc-300 transition hover:border-cyan-400 hover:text-white disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-lg border px-4 py-3 text-sm leading-6 shadow-lg sm:max-w-[78%] ${
                    message.role === "user"
                      ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-50"
                      : message.isError
                        ? "border-red-400/30 bg-red-500/10 text-red-100"
                        : "border-white/10 bg-[#17171c] text-zinc-100"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.plan && (
                    <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-2 text-xs text-zinc-400">
                      Retrieval: {message.plan.needsRetrieval ? "used" : "skipped"} - Lens:{" "}
                      {message.plan.departmentId} - {message.plan.reason}
                    </div>
                  )}
                  {message.retrievalError && (
                    <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-xs text-amber-100">
                      {message.retrievalError}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-white/10 bg-[#17171c] px-4 py-3 text-sm text-zinc-300">
                  Searching vector context and drafting executive synthesis...
                </div>
              </div>
            )}
          </div>

          <form
            className="border-t border-zinc-800 p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder={`Ask about ${selectedDepartment.shortName} priorities, risks, board narrative, metrics...`}
                className="min-h-12 flex-1 resize-none rounded-md border border-zinc-700 bg-[#15151a] px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className={`h-12 rounded-md bg-gradient-to-r px-6 text-sm font-semibold text-white shadow-lg transition ${selectedDepartment.tone} hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:self-end`}
              >
                {isSending ? "Thinking..." : "Ask CEO Agent"}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              No analysis runs on page load. The configured LLM is called only when you ask or rebuild embeddings.
            </p>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Agent Status</h2>
              <span className={`h-2.5 w-2.5 rounded-full ${isSending || isRebuilding ? "bg-amber-300" : "bg-emerald-400"}`} />
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              {status || "Ready. Select a department lens, then ask a CEO-level question."}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#101013] p-4">
            <h2 className="text-sm font-semibold text-white">Retrieved Evidence</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Latest Supabase vector matches used by the assistant.
            </p>
            <div className="mt-4 space-y-3">
              {latestSources.length ? (
                latestSources.map((source, index) => (
                  <div key={`${source.sourceId}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                          {source.departmentName || source.departmentId}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Similarity {formatSimilarity(source.similarity)}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[0.65rem] text-zinc-400">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-5 text-xs leading-5 text-zinc-400">
                      {source.snippet}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                  Ask a data-backed question after uploading department CSVs and rebuilding vector memory.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
