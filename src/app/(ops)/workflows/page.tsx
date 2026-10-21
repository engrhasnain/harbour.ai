"use client";
import { Bot, Calendar, FileText, Inbox, Mail, MessageSquare, Phone, PhoneMissed, Search, Send, ShieldCheck, UserCheck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { useSnapshot } from "@/components/useSnapshot";
import { WORKFLOWS } from "@/components/ui";
import { relTime } from "@/lib/time";
import type { WorkflowId } from "@/lib/types";

type Step = { icon: React.ElementType; label: string; ai?: boolean; human?: boolean };

const FLOWS: { id: WorkflowId; trigger: string; outcome: string; steps: Step[] }[] = [
  {
    id: "inquiry-to-showing",
    trigger: "New inquiry on Rentals.ca, Kijiji, Facebook, website chat, SMS or phone",
    outcome: "Qualified lead with a showing on the leasing calendar",
    steps: [
      { icon: Inbox, label: "Inquiry lands in any channel" },
      { icon: Bot, label: "AI replies in seconds, 24/7", ai: true },
      { icon: Search, label: "Checks live availability & rent", ai: true },
      { icon: UserCheck, label: "Qualifies: beds, move-in, pets, budget", ai: true },
      { icon: Calendar, label: "Books showing into leasing calendar", ai: true },
      { icon: Send, label: "SMS confirmation + 2h reminder" },
      { icon: Mail, label: "Post-showing follow-up + application link", ai: true },
    ],
  },
  {
    id: "missed-call",
    trigger: "Call to the leasing line goes unanswered",
    outcome: "Caller converted into a text conversation instead of a lost lead",
    steps: [
      { icon: PhoneMissed, label: "Missed call detected" },
      { icon: MessageSquare, label: "Text-back within 30 seconds", ai: true },
      { icon: Bot, label: "Continues as leasing conversation", ai: true },
      { icon: Calendar, label: "Showing booked or team escalation", ai: true },
    ],
  },
  {
    id: "maintenance-dispatch",
    trigger: "Tenant texts, calls or submits a portal request",
    outcome: "Work order on the right crew's calendar, tenant told when",
    steps: [
      { icon: Phone, label: "Request from tenant, any hour" },
      { icon: UserCheck, label: "Verifies tenant against rent roll", ai: true },
      { icon: ShieldCheck, label: "Safety check + urgency triage", ai: true },
      { icon: Wrench, label: "Opens work order, picks crew", ai: true },
      { icon: Calendar, label: "Books first open crew slot", ai: true },
      { icon: Send, label: "Tenant gets ETA + interim tip" },
    ],
  },
  {
    id: "property-report",
    trigger: "1st of every month, 6:00 AM",
    outcome: "Monthly property report ready for COO review",
    steps: [
      { icon: Search, label: "Pulls rent roll, arrears, work orders, leasing data" },
      { icon: Bot, label: "Drafts commentary & flags issues", ai: true },
      { icon: FileText, label: "Builds report (web + PDF)" },
      { icon: UserCheck, label: "COO reviews & approves", human: true },
      { icon: Send, label: "Sent to lender / partners" },
    ],
  },
  {
    id: "lp-report",
    trigger: "Quarter end",
    outcome: "LP update drafted for compliance review and distribution",
    steps: [
      { icon: Search, label: "Rolls up every property + capital events" },
      { icon: Bot, label: "Writes investor letter from the numbers only", ai: true },
      { icon: ShieldCheck, label: "EMD compliance review", human: true },
      { icon: Send, label: "Distributed to LPs" },
    ],
  },
  {
    id: "investor-inquiry",
    trigger: "A prospective investor asks a question on the website or by email",
    outcome: "Answered within compliance rules, intro call on Rodrigo's calendar",
    steps: [
      { icon: Inbox, label: "Question about the fund, any hour" },
      { icon: Bot, label: "Answers from fund facts only", ai: true },
      { icon: ShieldCheck, label: "Compliance guardrails: targets, no advice", ai: true },
      { icon: UserCheck, label: "Notes amount + accredited status", ai: true },
      { icon: Calendar, label: "Books intro call with Rodrigo", ai: true },
      { icon: Mail, label: "Rodrigo gets a briefing email" },
    ],
  },
];

const CONNECTORS = [
  ["Rentals.ca · Kijiji · FB Marketplace", "Inquiry emails & messages"],
  ["Existing leasing phone number", "Call forwarding + SMS"],
  ["Google Calendar / Outlook", "Leasing & crew calendars"],
  ["Rent roll (PM software or spreadsheet)", "Units, tenants, arrears"],
  ["Accounting (QuickBooks / Xero)", "Income & expenses for reports"],
  ["Email (Gmail / Microsoft 365)", "Confirmations & report delivery"],
];

export default function WorkflowsPage() {
  const { data } = useSnapshot();
  const runs = (id: WorkflowId) => (data?.activity ?? []).filter((a) => a.workflow === id);

  return (
    <>
      <PageHeader title="Automations" subtitle="Running on top of your existing phone line, calendars, rent roll and accounting" />
      <div className="space-y-6 p-6 lg:p-8">
        <section className="card p-5">
          <div className="mb-3 font-semibold text-navy-900">Connected systems</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {CONNECTORS.map(([name, what]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-sand-200 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-navy-900">{name}</div>
                  <div className="text-xs text-slate-500">{what}</div>
                </div>
                <span className="text-[11px] text-slate-400">demo</span>
              </div>
            ))}
          </div>
        </section>

        {FLOWS.map((f) => {
          const r = runs(f.id);
          const w = WORKFLOWS[f.id];
          return (
            <section key={f.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4" style={{ borderLeft: `4px solid ${w.color}` }}>
                <div>
                  <div className="font-semibold text-navy-900">{w.name}</div>
                  <div className="text-xs text-slate-500">
                    <span className="font-medium">When:</span> {f.trigger} · <span className="font-medium">Result:</span> {f.outcome}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right text-xs">
                  <div>
                    <div className="text-lg font-semibold text-navy-900">{r.length}</div>
                    <div className="text-slate-500">runs logged</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-navy-900">{r[0] ? relTime(r[0].ts) : "–"}</div>
                    <div className="text-slate-500">last run</div>
                  </div>
                  <span className="pill bg-emerald-100 text-emerald-800">● Active</span>
                </div>
              </div>
              <div className="flex flex-wrap items-stretch gap-2 px-5 py-4">
                {f.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`flex max-w-[170px] items-center gap-2 rounded-lg border px-3 py-2 text-xs ${s.ai ? "border-harbour-600/30 bg-harbour-50 text-navy-900" : s.human ? "border-amber-300 bg-amber-50 text-navy-900" : "border-sand-200 bg-white text-slate-700"}`}>
                      <s.icon size={14} className={`shrink-0 ${s.ai ? "text-harbour-600" : s.human ? "text-amber-700" : "text-slate-400"}`} />
                      {s.label}
                    </div>
                    {i < f.steps.length - 1 && <span className="text-slate-300">→</span>}
                  </div>
                ))}
              </div>
              {r.length > 0 && (
                <div className="border-t border-sand-100 bg-sand-50 px-5 py-3">
                  <div className="label mb-1.5">Recent runs</div>
                  <ul className="space-y-1">
                    {r.slice(0, 3).map((a) => (
                      <li key={a.id} className="flex gap-3 text-xs">
                        <span className="w-16 shrink-0 text-slate-400">{relTime(a.ts)}</span>
                        <span className="text-navy-900">{a.title}</span>
                        {a.detail && <span className="truncate text-slate-500">· {a.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
        <div className="flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-harbour-600/30 bg-harbour-50" /> AI step
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-amber-300 bg-amber-50" /> Human approval
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-sand-200 bg-white" /> Existing system
          </span>
        </div>
      </div>
    </>
  );
}
