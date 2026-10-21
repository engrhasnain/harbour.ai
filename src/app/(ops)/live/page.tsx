"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Mail, RotateCcw, Sheet } from "lucide-react";
import { PhoneChat } from "@/components/PhoneChat";
import { useConversation } from "@/components/useConversation";
import { useSnapshot } from "@/components/useSnapshot";
import { RESOURCE_META } from "@/lib/resources";
import { fmtDateTime, fmtShortDate, relTime } from "@/lib/time";
import type { Persona } from "@/lib/types";

const SCRIPTS: Record<"prospect" | "tenant", { label: string; who: string; prompts: string[] }> = {
  prospect: {
    label: "A renter",
    who: "Someone who saw the listing on Kijiji, texting at night",
    prompts: ["Hi, is the 2 bedroom still available?", "We have a cat, is that ok?", "Moving Nov 15. Can we see it Thursday?", "The first one works", "Priya Patel 780-555-0143"],
  },
  tenant: {
    label: "A tenant",
    who: "Chloe in suite 204, texting about a problem",
    prompts: ["Hi, water is dripping from my bathroom ceiling. Chloe Lavoie, suite 204", "Thank you!"],
  },
};

export default function LivePage() {
  return (
    <Suspense>
      <Live />
    </Suspense>
  );
}

function Live() {
  const [who, setWho] = useState<"prospect" | "tenant">("prospect");
  const as = useSearchParams().get("as");
  useEffect(() => {
    if (as === "tenant" || as === "prospect") setWho(as);
  }, [as]);
  const { data, refresh } = useSnapshot(2000);
  const convo = useConversation({ persona: who as Persona, channel: "sms", onTurn: refresh });
  const since = useRef(Date.now());
  const [used, setUsed] = useState<string[]>([]);

  useEffect(() => {
    since.current = Date.now();
    setUsed([]);
  }, [who, convo.sessionId]);

  const isNew = (iso: string) => new Date(iso).getTime() >= since.current - 1000;
  const emails = (data?.emails ?? []).filter((e) => e.folder !== "reports").slice(0, 5);
  const upcoming = useMemo(() => (data?.events ?? []).filter((e) => new Date(e.end) > new Date() && e.resource !== "rodrigo").slice(0, 7), [data]);
  const leads = (data?.leads ?? []).slice(0, 6);
  const orders = [...(data?.workOrders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const script = SCRIPTS[who];

  function say(text: string) {
    setUsed((u) => [...u, text]);
    convo.send(text);
  }

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Live demo</h1>
          <p className="mt-0.5 text-sm text-slate-500">Text the building&apos;s number like a renter or tenant would. Watch the team&apos;s inbox, calendar and sheet update on the right.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-sand-200 bg-white p-0.5 text-sm">
            {(Object.keys(SCRIPTS) as ("prospect" | "tenant")[]).map((k) => (
              <button key={k} onClick={() => setWho(k)} className={`rounded-md px-3 py-1.5 ${who === k ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-sand-100"}`}>
                {SCRIPTS[k].label} texts
              </button>
            ))}
          </div>
          <button onClick={() => convo.reset()} className="btn-ghost" title="Start a new conversation">
            <RotateCcw size={14} /> New
          </button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div>
          <PhoneChat contact="Bonnie Doon Manor" number="(780) 257-7059" bubbles={convo.bubbles} typing={convo.typing} busy={convo.busy} onSend={(t) => convo.send(t)} persona={who} />
          <div className="mx-auto mt-5 w-[340px]">
            <div className="text-xs text-slate-500">{script.who}. Tap to send, or type your own:</div>
            <div className="mt-2 flex flex-col gap-1.5">
              {script.prompts.map((p) => (
                <button
                  key={p}
                  disabled={convo.busy}
                  onClick={() => say(p)}
                  className={`rounded-lg border px-3 py-2 text-left text-[13px] transition disabled:opacity-50 ${used.includes(p) ? "border-sand-200 bg-sand-50 text-slate-400" : "border-sand-200 bg-white text-navy-900 hover:border-navy-700"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel icon={<Mail size={15} />} title="Team inbox" app="leasing@tripleharbour.com" href="/inbox">
            <ul className="divide-y divide-sand-100">
              {emails.map((m) => (
                <li key={m.id}>
                  <Link href={`/inbox?open=${m.id}`} className={`flex items-baseline gap-3 px-4 py-2.5 hover:bg-sand-50 ${isNew(m.ts) ? "flash" : ""}`}>
                    <span className={`w-40 shrink-0 truncate text-sm ${m.unread ? "font-semibold text-navy-900" : "text-slate-600"}`}>{m.byAssistant ? "Leasing (auto-reply)" : m.from}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className={m.unread ? "font-semibold text-navy-900" : "text-slate-700"}>{m.subject}</span>
                      <span className="text-slate-400"> · {m.body.replace(/\s+/g, " ").slice(0, 80)}</span>
                    </span>
                    {isNew(m.ts) && <NewBadge />}
                    <span className="shrink-0 text-xs text-slate-400">{relTime(m.ts)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={<CalendarDays size={15} />} title="Calendar" app="Leasing & crew calendars" href="/calendar">
            <ul className="divide-y divide-sand-100">
              {upcoming.map((e) => (
                <li key={e.id} className={`flex items-center gap-3 px-4 py-2.5 ${bookedThisSession(e.id) ? "flash" : ""}`}>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: RESOURCE_META[e.resource].color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-navy-900">{e.title}</div>
                    <div className="text-xs text-slate-500">
                      {fmtDateTime(e.start)} · {RESOURCE_META[e.resource].short}
                    </div>
                  </div>
                  {bookedThisSession(e.id) && <NewBadge />}
                </li>
              ))}
            </ul>
          </Panel>

          {who === "prospect" ? (
            <Panel icon={<Sheet size={15} />} title="Leads sheet" app="Bonnie Doon leads" href="/leads">
              <SheetTable
                cols={["Name", "Phone", "Wants", "Move-in", "Stage", "Source"]}
                rows={leads.map((l) => ({
                  key: l.id,
                  fresh: isNew(l.createdAt) || isNew(l.lastActivity),
                  cells: [l.name ?? "(texting…)", l.phone ?? "", l.bedrooms ? `${l.bedrooms} bed` : "", l.moveIn ? fmtShortDate(l.moveIn) : "", l.stage.replace("_", " "), l.channel],
                }))}
              />
            </Panel>
          ) : (
            <Panel icon={<Sheet size={15} />} title="Work orders sheet" app="Bonnie Doon maintenance" href="/maintenance">
              <SheetTable
                cols={["Order", "Suite", "Issue", "Priority", "Booked", "Status"]}
                rows={orders.map((w) => ({
                  key: w.id,
                  fresh: isNew(w.createdAt),
                  cells: [w.id, `#${w.unitId.slice(4)}`, w.issue, w.urgency, w.scheduledFor ? fmtDateTime(w.scheduledFor) : "", w.status.replace("_", " ")],
                }))}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

// Seeded bookings use ids below E-700; anything above was booked since the demo started.
const bookedThisSession = (id: string) => Number(id.slice(2)) > 700;

function NewBadge() {
  return <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">New</span>;
}

function Panel({ icon, title, app, href, children }: { icon: React.ReactNode; title: string; app: string; href: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-sand-200 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
          <span className="text-slate-400">{icon}</span> {title}
          <span className="font-normal text-slate-400">· {app}</span>
        </div>
        <Link href={href} className="text-xs font-medium text-slate-500 hover:text-navy-900">
          Open →
        </Link>
      </div>
      {children}
    </section>
  );
}

function SheetTable({ cols, rows }: { cols: string[]; rows: { key: string; fresh: boolean; cells: string[] }[] }) {
  const letters = "ABCDEFGH";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse font-mono text-[12px]">
        <thead>
          <tr className="bg-[#f8f9fa] text-center text-[11px] text-slate-500">
            <th className="w-8 border border-[#e2e3e3]" />
            {cols.map((_, i) => (
              <th key={i} className="border border-[#e2e3e3] py-0.5 font-normal">
                {letters[i]}
              </th>
            ))}
          </tr>
          <tr>
            <td className="border border-[#e2e3e3] bg-[#f8f9fa] text-center text-[11px] text-slate-500">1</td>
            {cols.map((c) => (
              <td key={c} className="border border-[#e2e3e3] px-2 py-1 font-sans font-semibold text-navy-900">
                {c}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={r.fresh ? "bg-emerald-50" : ""}>
              <td className="border border-[#e2e3e3] bg-[#f8f9fa] text-center text-[11px] text-slate-500">{i + 2}</td>
              {r.cells.map((c, j) => (
                <td key={j} className="max-w-[220px] truncate border border-[#e2e3e3] px-2 py-1 font-sans text-slate-800">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
