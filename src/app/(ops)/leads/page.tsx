"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Moon } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { useSnapshot } from "@/components/useSnapshot";
import { act } from "@/components/act";
import { Conversation, Drawer, Reschedule, Section, useToast } from "@/components/ops";
import { ChannelBadge, money, ScoreBar, StagePill } from "@/components/ui";
import { fmtDateTime, fmtShortDate, relTime } from "@/lib/time";
import type { CalEvent, Lead, LeadStage } from "@/lib/types";

const FILTERS: { id: "all" | LeadStage; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "showing_booked", label: "Viewing booked" },
  { id: "showing_done", label: "Viewed" },
  { id: "applied", label: "Applied" },
  { id: "leased", label: "Leased" },
  { id: "lost", label: "Lost" },
];

const STAGE_STEPS: { id: LeadStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "qualified", label: "Qualified" },
  { id: "showing_booked", label: "Viewing booked" },
  { id: "showing_done", label: "Viewed" },
  { id: "applied", label: "Applied" },
  { id: "leased", label: "Leased" },
];

export default function LeadsPage() {
  const { data, refresh } = useSnapshot();
  const [filter, setFilter] = useState<"all" | LeadStage>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  // Deep link from the dashboard activity feed: /leads?open=L-1042
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) setOpenId(id);
  }, []);

  const leads = useMemo(() => (data?.leads ?? []).filter((l) => filter === "all" || l.stage === filter), [data, filter]);
  const open = data?.leads.find((l) => l.id === openId) ?? null;
  const showing = open?.showingEventId ? data?.events.find((e) => e.id === open.showingEventId) : undefined;

  return (
    <>
      <PageHeader title="Leads" subtitle="Inquiries from listing sites, website chat, text and phone. Click a lead to work it." />
      <div className="p-6 lg:p-8">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f.id ? "bg-navy-900 text-white" : "border border-sand-200 bg-white text-slate-600 hover:bg-sand-100"}`}
            >
              {f.label}
              {data && <span className="ml-1 opacity-60">{f.id === "all" ? data.leads.length : data.leads.filter((l) => l.stage === f.id).length}</span>}
            </button>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left">
                {["Lead", "Source", "Came in", "Stage", "Score", "Wants", "Move-in", "Latest"].map((h) => (
                  <th key={h} className="label px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {leads.map((l) => (
                <tr key={l.id} onClick={() => setOpenId(l.id)} className={`cursor-pointer hover:bg-sand-50 ${Date.now() - new Date(l.lastActivity).getTime() < 15000 ? "flash" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy-900">{l.name ?? "Unknown (chatting)"}</div>
                    <div className="text-xs text-slate-500">{l.phone ?? l.email ?? l.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={l.channel} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      {l.afterHours && <Moon size={11} className="text-indigo-500" />}
                      {relTime(l.createdAt)}
                    </div>
                    <div className="text-slate-400">replied in {l.firstResponseSec || "<10"}s</div>
                  </td>
                  <td className="px-4 py-3">
                    <StagePill stage={l.stage} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar score={l.score} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {l.bedrooms ? `${l.bedrooms}-bed` : "–"}
                    {l.unitInterest && <span className="text-slate-400"> · #{l.unitInterest.slice(4)}</span>}
                    {l.pets && l.pets !== "none" && <div className="text-slate-400">{l.pets}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{l.moveIn ? fmtShortDate(l.moveIn) : "–"}</td>
                  <td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <LeadDrawer
          lead={open}
          showing={showing}
          onClose={() => setOpenId(null)}
          onChanged={(msg) => {
            toast(msg);
            refresh();
          }}
          onError={(msg) => toast(msg, true)}
        />
      )}
      {toastNode}
    </>
  );
}

function LeadDrawer({ lead, showing, onClose, onChanged, onError }: { lead: Lead; showing?: CalEvent; onClose: () => void; onChanged: (m: string) => void; onError: (m: string) => void }) {
  const [rescheduling, setRescheduling] = useState(false);
  const rent = lead.bedrooms === 2 ? 1465 : 1300;
  const first = lead.name?.split(" ")[0] ?? "them";

  async function run(body: Record<string, unknown>, msg: string) {
    try {
      await act(body);
      onChanged(msg);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  const facts: [string, string][] = [
    ["Phone", lead.phone ?? "–"],
    ["Email", lead.email ?? "–"],
    ["Looking for", lead.bedrooms ? `${lead.bedrooms} bedroom${lead.unitInterest ? ` (#${lead.unitInterest.slice(4)})` : ""}` : "–"],
    ["Move-in", lead.moveIn ? fmtShortDate(lead.moveIn) : "–"],
    ["Occupants", lead.occupants ? String(lead.occupants) : "–"],
    ["Pets", lead.pets ?? "–"],
    ["Budget", lead.budget ? money(lead.budget) : "–"],
    ["Income", lead.incomeMonthly ? `${money(lead.incomeMonthly)}/mo · ${lead.incomeMonthly >= rent * 2.5 ? "meets 2.5x" : "below 2.5x"}` : "Not shared"],
  ];

  const stepIdx = STAGE_STEPS.findIndex((s) => s.id === lead.stage);

  return (
    <Drawer
      onClose={onClose}
      title={lead.name ?? "Unknown prospect"}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <StagePill stage={lead.stage} />
          <ChannelBadge channel={lead.channel} />
          <span>came in {relTime(lead.createdAt)}</span>
        </div>
      }
    >
      <Section title="Stage">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => s.id !== lead.stage && run({ kind: "lead.stage", id: lead.id, stage: s.id }, `${lead.name ?? "Lead"} moved to ${s.label}`)}
              className={`rounded-full px-3 py-1 text-xs ${
                s.id === lead.stage ? "bg-navy-900 text-white" : i < stepIdx && lead.stage !== "lost" ? "bg-sand-100 text-slate-600" : "border border-sand-200 text-slate-600 hover:bg-sand-100"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={() => lead.stage !== "lost" && run({ kind: "lead.stage", id: lead.id, stage: "lost" }, `${lead.name ?? "Lead"} marked as lost`)}
            className={`rounded-full px-3 py-1 text-xs ${lead.stage === "lost" ? "bg-rose-600 text-white" : "border border-sand-200 text-rose-700 hover:bg-rose-50"}`}
          >
            Lost
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">{lead.summary}</p>
      </Section>

      {showing && (
        <Section title="Viewing">
          <div className="flex items-center gap-2 text-sm text-navy-900">
            <CalendarClock size={15} className="text-slate-400" />
            {fmtDateTime(showing.start)} · Suite #{showing.unitId?.slice(4)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => run({ kind: "event.complete", id: showing.id }, `Viewing done. Application link sent to ${first}`)}>
              Mark viewed
            </button>
            <button className="btn-ghost" onClick={() => setRescheduling((r) => !r)}>
              {rescheduling ? "Close" : "Reschedule"}
            </button>
            <button className="btn-ghost text-rose-700" onClick={() => run({ kind: "event.cancel", id: showing.id }, `Viewing cancelled. ${first} notified`)}>
              Cancel viewing
            </button>
          </div>
          {rescheduling && (
            <div className="mt-4">
              <div className="mb-2 text-xs text-slate-500">Open viewing times:</div>
              <Reschedule
                eventId={showing.id}
                onDone={(label) => {
                  setRescheduling(false);
                  onChanged(`Viewing moved to ${label}. ${first} notified`);
                }}
              />
            </div>
          )}
        </Section>
      )}

      <Section title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-sm text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={`Conversation with ${first}`}>
        <Conversation
          sessionId={lead.sessionId}
          who={lead.name ?? "Renter"}
          placeholder={`Reply to ${first} as the leasing team…`}
          empty="This lead came in before the demo started. Send a message to pick up the conversation."
          reply={async (text) => {
            const r = await act<{ sessionId: string }>({ kind: "reply", leadId: lead.id, text });
            onChanged(`Sent to ${first}`);
            return r.sessionId;
          }}
        />
      </Section>
    </Drawer>
  );
}
