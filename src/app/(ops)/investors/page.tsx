"use client";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { ChatPanel } from "@/components/ChatPanel";
import { useSnapshot } from "@/components/useSnapshot";
import { act } from "@/components/act";
import { Conversation, Drawer, Section, useToast } from "@/components/ops";
import { fmtDateTime, relTime } from "@/lib/time";
import type { CalEvent, InvestorLead, InvestorStage } from "@/lib/types";

const STAGES: { id: InvestorStage; label: string; cls: string }[] = [
  { id: "new", label: "New", cls: "bg-slate-100 text-slate-700" },
  { id: "call_booked", label: "Call booked", cls: "bg-blue-50 text-blue-700" },
  { id: "docs_sent", label: "Docs sent via EMD", cls: "bg-amber-50 text-amber-800" },
  { id: "committed", label: "Committed", cls: "bg-emerald-50 text-emerald-800" },
  { id: "not_fit", label: "Not a fit", cls: "bg-rose-50 text-rose-700" },
];
const stageOf = (s: InvestorStage) => STAGES.find((x) => x.id === s)!;

export default function InvestorsPage() {
  const { data, refresh } = useSnapshot();
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const investors = useMemo(() => data?.investors ?? [], [data]);
  const calls = useMemo(() => (data?.events ?? []).filter((e) => e.resource === "rodrigo" && new Date(e.end) > new Date()), [data]);
  const open = investors.find((i) => i.id === openId) ?? null;

  return (
    <>
      <PageHeader title="Investors" subtitle="Questions from prospective investors, answered within the compliance rules, with intro calls booked on Rodrigo's calendar" />
      <div className="grid gap-6 p-6 lg:p-8 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="label mb-2">Try it as a prospective investor</div>
          <ChatPanel
            persona="investor"
            channel="investor-site"
            title="Triple Harbour Capital"
            subtitle="Investor questions · replies instantly"
            greeting="Hi! I can answer questions about THC Value-Add 1 LP, our track record and how investing works, or set up a call with Rodrigo, our CEO. What would you like to know?"
            suggestions={["What returns do you target?", "What's your track record?", "Is there a minimum investment?", "Can I book a call with Rodrigo?"]}
            className="h-[600px]"
            onTurn={refresh}
          />
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-sand-200 bg-white p-3 text-xs text-slate-600">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            Built-in guardrails: returns are always described as targets, no personal tax or investment advice, no minimums quoted outside the offering documents, accredited-investor rules respected.
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-sand-200 bg-sand-200 md:grid-cols-4">
            {[
              ["Inquiries", String(investors.length)],
              ["Calls booked", String(investors.filter((i) => i.stage === "call_booked").length)],
              ["Docs sent", String(investors.filter((i) => i.stage === "docs_sent").length)],
              ["Answered after hours", "100%"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="mt-0.5 text-xl font-semibold text-navy-900">{v}</div>
              </div>
            ))}
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-sand-200 px-5 py-3.5 font-semibold text-navy-900">Investor pipeline</div>
            <ul className="divide-y divide-sand-100">
              {investors.map((inv) => {
                const call = calls.find((c) => c.id === inv.callEventId);
                const st = stageOf(inv.stage);
                return (
                  <li key={inv.id}>
                    <button onClick={() => setOpenId(inv.id)} className={`group flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-sand-50 ${Date.now() - new Date(inv.lastActivity).getTime() < 15000 ? "flash" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy-900">{inv.name ?? "Website visitor (chatting)"}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-slate-500">{inv.interest}</div>
                        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
                          <span>{inv.source}</span>
                          {inv.amount && <span>Mentioned {inv.amount}</span>}
                          <span>Accredited: {inv.accredited ?? "not asked"}</span>
                          {call && (
                            <span className="flex items-center gap-1 text-blue-700">
                              <CalendarClock size={12} /> {fmtDateTime(call.start)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{relTime(inv.lastActivity)}</span>
                      <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-sand-200 px-5 py-3.5 font-semibold text-navy-900">Rodrigo&apos;s upcoming intro calls</div>
            {calls.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500">No calls booked yet.</div>
            ) : (
              <ul className="divide-y divide-sand-100">
                {calls.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="h-8 w-1 rounded-full bg-blue-600" />
                    <div className="flex-1">
                      <div className="text-navy-900">{c.title}</div>
                      <div className="text-xs text-slate-500">{c.notes}</div>
                    </div>
                    <span className="text-slate-600">{fmtDateTime(c.start)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {open && (
        <InvestorDrawer
          inv={open}
          call={calls.find((c) => c.id === open.callEventId)}
          onClose={() => setOpenId(null)}
          onChanged={(m) => {
            toast(m);
            refresh();
          }}
          onError={(m) => toast(m, true)}
        />
      )}
      {toastNode}
    </>
  );
}

function InvestorDrawer({ inv, call, onClose, onChanged, onError }: { inv: InvestorLead; call?: CalEvent; onClose: () => void; onChanged: (m: string) => void; onError: (m: string) => void }) {
  const first = inv.name?.split(" ")[0] ?? "them";
  async function setStage(stage: InvestorStage) {
    try {
      await act({ kind: "inv.stage", id: inv.id, investorStage: stage });
      onChanged(`${inv.name ?? "Investor"}: ${stageOf(stage).label}`);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <Drawer
      onClose={onClose}
      title={inv.name ?? "Website visitor"}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stageOf(inv.stage).cls}`}>{stageOf(inv.stage).label}</span>
          <span>
            {inv.source} · {relTime(inv.createdAt)}
          </span>
        </div>
      }
    >
      <Section title="Stage">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button key={s.id} onClick={() => s.id !== inv.stage && setStage(s.id)} className={`rounded-full px-3 py-1 text-xs ${s.id === inv.stage ? "bg-navy-900 text-white" : "border border-sand-200 text-slate-600 hover:bg-sand-100"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">{inv.interest}</p>
      </Section>
      <Section title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["Email", inv.email ?? "–"],
            ["Phone", inv.phone ?? "–"],
            ["Amount mentioned", inv.amount ?? "–"],
            ["Accredited", inv.accredited ?? "Not asked yet"],
            ["Intro call", call ? fmtDateTime(call.start) : "Not booked"],
            ["Source", inv.source],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title={`Conversation with ${first}`}>
        <Conversation
          sessionId={inv.sessionId}
          who={inv.name ?? "Investor"}
          placeholder={`Reply to ${first} as Rodrigo…`}
          empty="This inquiry came in before the demo started. Send a message to pick it up."
          reply={async (text) => {
            const r = await act<{ sessionId: string }>({ kind: "reply", investorId: inv.id, text });
            onChanged(`Sent to ${first}`);
            return r.sessionId;
          }}
        />
      </Section>
    </Drawer>
  );
}
