"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignOutButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

const DEPARTMENTS = [
  { id: "executive", name: "Executive / Office of the CEO", icon: "👑" },
  { id: "finance", name: "Finance & Treasury", icon: "💵" },
  { id: "hr", name: "Human Resources", icon: "👥" },
  { id: "legal", name: "Legal & Compliance", icon: "⚖️" },
  { id: "it", name: "Information Technology", icon: "💻" },
  { id: "operations", name: "Operations & Supply Chain", icon: "⚙️" },
  { id: "sales", name: "Sales & Revenue", icon: "📈" },
  { id: "marketing", name: "Marketing & Comm", icon: "📣" },
  { id: "product", name: "Product Management", icon: "📦" },
  { id: "rd", name: "R&D & Innovation", icon: "🧪" },
  { id: "customer-service", name: "Customer Support", icon: "🤝" },
  { id: "risk", name: "Risk & Internal Audit", icon: "🛡️" },
  { id: "strategy", name: "Corporate Strategy", icon: "🎯" },
];

const PRIMARY_NAV_ITEMS = [
  {
    id: "assistant",
    name: "CEO Chat",
    href: "/assistant",
    icon: "✨",
  },
  {
    id: "pipeline",
    name: "Deal Pipeline",
    href: "/pipeline",
    icon: "🧲",
  },
  {
    id: "digital-twin",
    name: "Digital Twin",
    href: "/digital-twin",
    icon: "🧭",
  },
  {
    id: "tickets",
    name: "Ticket Overview",
    href: "/tickets",
    icon: "🎫",
  },
  {
    id: "todo",
    name: "Master To-Do",
    href: "/todo",
    icon: "📋",
  },
];

const INTEGRATION_NAV_ITEMS = [
  {
    id: "clickup",
    name: "ClickUp Overview",
    href: "/clickup",
    icon: "☑️",
  },
  {
    id: "jira",
    name: "Jira Overview",
    href: "/jira",
    icon: "🔷",
  },
  {
    id: "confluence",
    name: "Confluence Knowledge",
    href: "/confluence",
    icon: "📘",
  },
  {
    id: "github",
    name: "GitHub PRs & Bugs",
    href: "/github",
    icon: "🐙",
  },
  {
    id: "asana",
    name: "Asana Work",
    href: "/asana",
    icon: "🔴",
  },
  {
    id: "mailchimp",
    name: "Mailchimp Marketing",
    href: "/mailchimp",
    icon: "📬",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Accounting",
    href: "/quickbooks",
    icon: "📗",
  },
  {
    id: "salesforce",
    name: "Salesforce CRM",
    href: "/salesforce",
    icon: "☁️",
  },
  {
    id: "stripe",
    name: "Stripe Payments",
    href: "/stripe",
    icon: "💳",
  },
  {
    id: "slack",
    name: "Slack Workspace",
    href: "/slack",
    icon: "💬",
  },
  {
    id: "integrations",
    name: "Integrations Hub",
    href: "/integrations",
    icon: "🔌",
  },
];

export default function RootLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const integrationsMenuRef = useRef(null);
  const isHome = pathname === "/";
  const activeIntegration = INTEGRATION_NAV_ITEMS.find((item) => pathname === item.href);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        integrationsMenuRef.current &&
        !integrationsMenuRef.current.contains(event.target)
      ) {
        setIntegrationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <html lang="en">
      <body className="flex h-screen bg-[#09090b] text-[#f4f4f5] antialiased">
        <ClerkProvider>
          <>
            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle department navigation"
              className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#27272a] bg-[#121214] text-zinc-400 shadow-lg md:hidden hover:bg-[#18181b]"
            >
              {sidebarOpen ? "×" : "☰"}
            </button>

            {sidebarOpen && (
              <button
                aria-label="Close navigation"
                className="fixed inset-0 z-30 bg-black/60 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar Container */}
            <aside
              className={`
          fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col overflow-y-auto border-r border-[#27272a] bg-[#09090b] p-4 transition-transform duration-200 ease-in-out md:static md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
            >
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className={`mb-6 flex items-center rounded-md px-2 py-1.5 transition-colors hover:bg-[#121214] ${
                  isHome ? "bg-[#121214]" : ""
                }`}
              >
                <div className="mr-2.5 h-6 w-6 rounded-md bg-indigo-500"></div>
                <span className="font-semibold tracking-tight text-sm text-zinc-200">
                  TAI Chief
                </span>
              </Link>

              <nav className="flex-1 space-y-6">
                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    AI Agent Co-Pilot
                  </div>
                  {PRIMARY_NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm border border-indigo-500/50"
                            : "text-zinc-400 hover:bg-[#121214] hover:text-zinc-200"
                        }`}
                      >
                        <span className="mr-2 text-sm">{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}

                  <div className="md:hidden">
                    {INTEGRATION_NAV_ITEMS.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-indigo-600 text-white shadow-sm border border-indigo-500/50"
                              : "text-zinc-400 hover:bg-[#121214] hover:text-zinc-200"
                          }`}
                        >
                          <span className="mr-2 text-sm">{item.icon}</span>
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Departments
                  </div>
                  {DEPARTMENTS.map((dept) => {
                    const isActive = pathname === `/departments/${dept.id}`;
                    return (
                      <Link
                        key={dept.id}
                        href={`/departments/${dept.id}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-[#18181b] text-white shadow-sm border border-[#27272a]"
                            : "text-zinc-400 hover:bg-[#121214] hover:text-zinc-200"
                        }`}
                      >
                        <span className="mr-2 text-sm">{dept.icon}</span>
                        <span className="truncate">{dept.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              <div className="mt-6 border-t border-[#27272a] pt-4">
                <Show when="signed-out">
                  <div className="grid grid-cols-2 gap-2">
                    <SignInButton mode="modal">
                      <button className="rounded-md border border-indigo-500/50 bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="rounded-md border border-[#27272a] bg-[#121214] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-[#18181b]">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </div>
                </Show>

                <Show when="signed-in">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-[#27272a] bg-[#121214] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserButton afterSignOutUrl="/sign-in" />
                      <span className="truncate text-xs font-medium text-zinc-300">
                        Account
                      </span>
                    </div>
                    <SignOutButton>
                      <button className="rounded-md border border-[#3f3f46] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-red-500/60 hover:text-red-200">
                        Sign Out
                      </button>
                    </SignOutButton>
                  </div>
                </Show>
              </div>
            </aside>

            {/* Main Workspace Frame */}
            <main className="flex-1 overflow-y-auto bg-[#0c0c0e] px-4 pb-6 pt-16 md:px-8 md:py-6">
              <div className="mx-auto max-w-6xl">
                <div className="mb-6 hidden items-center justify-between border-b border-[#27272a] pb-4 md:flex">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Workspace
                  </div>

                  <div className="relative" ref={integrationsMenuRef}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={integrationsOpen}
                      onClick={() => setIntegrationsOpen((open) => !open)}
                      className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${
                        activeIntegration
                          ? "border-indigo-500/50 bg-indigo-600 text-white shadow-sm"
                          : "border-[#27272a] bg-[#121214] text-zinc-200 hover:bg-[#18181b]"
                      }`}
                    >
                      <span>{activeIntegration?.icon || "🔌"}</span>
                      <span>{activeIntegration?.name || "Integrations"}</span>
                      <span className="text-[10px] text-current/70">
                        {integrationsOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {integrationsOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-12 z-50 w-64 rounded-md border border-[#27272a] bg-[#09090b] p-2 shadow-2xl shadow-black/40"
                      >
                        {INTEGRATION_NAV_ITEMS.map((item) => {
                          const isActive = pathname === item.href;
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              role="menuitem"
                              onClick={() => setIntegrationsOpen(false)}
                              className={`flex items-center rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "text-zinc-400 hover:bg-[#121214] hover:text-zinc-200"
                              }`}
                            >
                              <span className="mr-2 text-sm">{item.icon}</span>
                              <span className="truncate">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {children}
              </div>
            </main>
          </>
        </ClerkProvider>
      </body>
    </html>
  );
}
