"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Anchor, CalendarDays, ExternalLink, FileText, Inbox, Landmark, LayoutDashboard, RotateCcw, Smartphone, Users, Workflow, Wrench } from "lucide-react";
import { DemoGuide } from "./DemoGuide";

const SECTIONS: { title?: string; items: { href: string; label: string; icon: React.ElementType; external?: boolean }[] }[] = [
  {
    title: "See it work",
    items: [
      { href: "/live", label: "Live demo (text messages)", icon: Smartphone },
      { href: "/inbox", label: "Team inbox", icon: Inbox },
      { href: "/listing", label: "Listing page + chat", icon: ExternalLink, external: true },
    ],
  },
  {
    title: "Team console",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/investors", label: "Investors", icon: Landmark },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/workflows", label: "Automations", icon: Workflow },
    ],
  },
];
const ALL = SECTIONS.flatMap((s) => s.items).filter((i) => !i.external);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [engine, setEngine] = useState<{ mode: string; model?: string } | null>(null);

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => setEngine(s.engine))
      .catch(() => {});
  }, []);

  async function reset() {
    if (!confirm("Reset the demo to its starting state?")) return;
    await fetch("/api/reset", { method: "POST" });
    location.reload();
  }

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-950 text-slate-300 lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-harbour-600 text-white">
            <Anchor size={18} />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight text-white">Harbour Ops</div>
            <div className="text-[11px] text-slate-400">Triple Harbour Capital</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{sec.title}</div>
              {sec.items.map(({ href, label, icon: Icon, external }) => (
                <Link
                  key={href}
                  href={href}
                  target={external ? "_blank" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${!external && isActive(href) ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon size={16} className={!external && isActive(href) ? "text-harbour-500" : ""} />
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-white/10 p-4 text-xs">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${engine?.mode === "claude" ? "bg-emerald-400" : "bg-amber-400"}`} />
            <span className="text-slate-400">{engine ? (engine.mode === "claude" ? `Assistant: ${engine.model}` : "Assistant: offline mode") : "Connecting…"}</span>
          </div>
          <button onClick={reset} className="flex items-center gap-2 text-slate-400 hover:text-white">
            <RotateCcw size={13} /> Reset demo data
          </button>
          <div className="text-[11px] text-slate-500">
            AI layer by <span className="font-semibold text-slate-300">Zenthic</span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <nav className="no-print flex gap-1 overflow-x-auto bg-navy-950 px-3 py-2 lg:hidden">
          {ALL.map(({ href, label }) => (
            <Link key={href} href={href} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs ${isActive(href) ? "bg-white/15 text-white" : "text-slate-300"}`}>
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </main>
      <DemoGuide />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-end justify-between gap-4 border-b border-sand-200 bg-white/60 px-6 py-5 backdrop-blur lg:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
