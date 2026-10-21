"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bot, Building2, CalendarClock, Moon, PhoneIncoming, Sparkles, Wrench } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { useSnapshot } from "@/components/useSnapshot";
import { Kpi, money, pct, WorkflowTag } from "@/components/ui";
import { fmtDateTime, fmtShortDate, relTime } from "@/lib/time";
import { RESOURCE_META } from "@/lib/resources";
import type { Activity } from "@/lib/types";
import { useRouter } from "next/navigation";

function activityHref(ref: Activity["ref"]): string | null {
  if (!ref) return null;
  if (ref.type === "lead") return `/leads?open=${ref.id}`;
  if (ref.type === "workorder") return `/maintenance?open=${ref.id}`;
  if (ref.type === "event") return "/calendar";
  if (ref.type === "investor") return "/investors";
  return `/reports/${ref.id}`;
}

interface SimResult {
  scenario: { persona: string; channel: string; message: string };
  reply: string;
  actions: { label: string; detail?: string }[];
}

export default function Overview() {
  const { data, refresh } = useSnapshot();
  const router = useRouter();
  const [sim, setSim] = useState<SimResult | null>(null);
  const [simBusy, setSimBusy] = useState<string | null>(null);

  async function simulate(kind: "prospect" | "tenant") {
    setSimBusy(kind);
    try {
      const res = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      setSim(await res.json());
      refresh();
    } finally {
      setSimBusy(null);
    }
  }

  if (!data) return <div className="p-8 text-sm text-slate-500">Loading operations…</div>;
  const k = data.kpis;
  const vacant = data.units.filter((u) => u.status !== "leased");
  const upcoming = data.events.filter((e) => new Date(e.end) > new Date()).slice(0, 7);
  const maxFunnel = Math.max(...k.funnel.map((f) => f.count), 1);

  return (
    <>
      <PageHeader
        title="Bonnie Doon Manor"
        subtitle={`9107 88 Ave NW, Edmonton · ${fmtDateTime(data.now)}`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => simulate("prospect")} disabled={!!simBusy} title="Demo: send a sample inquiry">
              <PhoneIncoming size={15} /> {simBusy === "prospect" ? "Sending…" : "Test inquiry"}
            </button>
            <button className="btn-ghost" onClick={() => simulate("tenant")} disabled={!!simBusy} title="Demo: send a sample maintenance request">
              <Wrench size={15} /> {simBusy === "tenant" ? "Sending…" : "Test maintenance request"}
            </button>
            <Link href="/listing" target="_blank" className="btn-primary">
              View listing <ArrowRight size={15} />
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6 lg:p-8">
        {sim && (
          <div className="card flash relative overflow-hidden border-harbour-600/30 p-4">
            <button onClick={() => setSim(null)} className="absolute right-3 top-2 text-slate-400 hover:text-slate-700">
              ×
            </button>
            <div className="label mb-2 flex items-center gap-1.5 text-harbour-600">
              <Sparkles size={12} /> Test {sim.scenario.persona === "tenant" ? "maintenance request" : "inquiry"} via {sim.scenario.channel}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-sand-100 p-3 text-sm text-navy-900">&ldquo;{sim.scenario.message}&rdquo;</div>
              <div className="rounded-lg border border-sand-200 p-3 text-sm whitespace-pre-wrap text-slate-700">{sim.reply}</div>
            </div>
            {sim.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sim.actions.map((a, i) => (
                  <span key={i} className="pill bg-harbour-50 text-harbour-600">
                    ✓ {a.label}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Occupancy" value={pct(k.occupancy)} sub={`${k.leased} of ${k.totalUnits} suites leased`} />
          <Kpi label="Vacancy cost" value={`${money(k.vacancyCostPerDay)}/day`} sub={`${k.totalUnits - k.leased} suites not earning`} />
          <Kpi label="Inquiries · 14d" value={String(k.inquiries14d)} sub={`${pct(k.afterHoursPct)} arrived after hours`} />
          <Kpi label="Median first reply" value={`${k.medianFirstResponseSec}s`} sub="all channels, incl. nights" />
          <Kpi label="Showings booked" value={String(k.showingsBooked14d)} sub={`${pct(k.inquiryToShowingPct)} inquiry → showing`} />
          <Kpi label="Open work orders" value={String(k.openWorkOrders)} sub="all scheduled" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="card flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3.5">
              <div className="flex items-center gap-2 font-semibold text-navy-900">
                <Bot size={16} className="text-slate-500" /> Activity
              </div>
              <span className="text-xs text-slate-400">Live</span>
            </div>
            <ul className="max-h-[520px] divide-y divide-sand-100 overflow-y-auto">
              {data.activity.slice(0, 40).map((a) => (
                <li
                  key={a.id}
                  onClick={() => {
                    const href = activityHref(a.ref);
                    if (href) router.push(href);
                  }}
                  className={`flex gap-3 px-5 py-3 ${activityHref(a.ref) ? "cursor-pointer hover:bg-sand-50" : ""} ${Date.now() - new Date(a.ts).getTime() < 15000 ? "flash" : ""}`}
                >
                  <div className="w-16 shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">{relTime(a.ts)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-navy-900">{a.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <WorkflowTag id={a.workflow} />
                      {a.detail && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          {/after hours/i.test(a.detail) && <Moon size={11} />}
                          {a.detail}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-6">
            <section className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="font-semibold text-navy-900">Leasing · last 14 days</div>
                <Link href="/leads" className="text-xs font-medium text-harbour-600 hover:underline">
                  Pipeline →
                </Link>
              </div>
              <div className="space-y-2.5">
                {k.funnel.map((f) => (
                  <div key={f.stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-600">{f.stage}</div>
                    <div className="h-6 flex-1 overflow-hidden rounded-md bg-sand-100">
                      <div className="flex h-full items-center rounded-md bg-navy-800 px-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(8, (f.count / maxFunnel) * 100)}%` }}>
                        {f.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-3 font-semibold text-navy-900">Vacant & upcoming</div>
              <div className="space-y-2.5">
                {vacant.map((u) => {
                  const interested = data.leads.filter((l) => l.unitInterest === u.id && !["lost", "leased"].includes(l.stage));
                  const booked = interested.filter((l) => l.stage === "showing_booked").length;
                  return (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-sand-200 p-3">
                      <div>
                        <div className="text-sm font-semibold text-navy-900">
                          Suite #{u.number} · {u.beds}-bed · {money(u.rent)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {u.status === "vacant" ? "Vacant, ready now" : `Turnover, ready ${u.availableFrom ? fmtShortDate(u.availableFrom) : "soon"}`} · losing {money(u.rent / 30.4)}/day
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-semibold text-harbour-600">{interested.length} active leads</div>
                        <div className="text-slate-500">{booked} showings booked</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-navy-900">
                  <CalendarClock size={16} /> Coming up
                </div>
                <Link href="/calendar" className="text-xs font-medium text-harbour-600 hover:underline">
                  Calendar →
                </Link>
              </div>
              <ul className="space-y-2">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: RESOURCE_META[e.resource].color }} />
                    <span className="w-36 shrink-0 text-xs tabular-nums text-slate-500">{fmtDateTime(e.start)}</span>
                    <span className="truncate text-navy-900">{e.title}</span>
                    {e.createdBy === "ai" && <span className="ml-auto shrink-0 text-[10px] text-slate-400">auto</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-center gap-2 font-semibold text-navy-900">
            <Building2 size={16} /> Portfolio
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {data.properties.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.city === p.address ? p.city : `${p.address}, ${p.city}`}</div>
                  </div>
                  <span className={`pill ${p.status === "operating" ? "bg-harbour-100 text-harbour-600" : p.status === "refinancing" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {p.status === "operating" ? "Operating" : p.status === "refinancing" ? "Refinance in progress" : "Realized"}
                  </span>
                </div>
                {p.acquisitionPrice && p.appraisedValue ? (
                  <div className="mt-4 flex items-end gap-4">
                    <div>
                      <div className="label">Bought</div>
                      <div className="font-semibold text-navy-900">{money(p.acquisitionPrice)}</div>
                    </div>
                    <ArrowRight size={14} className="mb-1 text-slate-400" />
                    <div>
                      <div className="label">Appraised</div>
                      <div className="font-semibold text-navy-900">{money(p.appraisedValue)}</div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="label">Uplift</div>
                      <div className="font-semibold text-emerald-700">+{pct((p.appraisedValue - p.acquisitionPrice) / p.acquisitionPrice)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-end gap-6">
                    <div>
                      <div className="label">Occupancy</div>
                      <div className="font-semibold text-navy-900">
                        {k.leased}/{k.totalUnits} · {pct(k.occupancy)}
                      </div>
                    </div>
                    <div>
                      <div className="label">Rent roll</div>
                      <div className="font-semibold text-navy-900">{money(data.units.filter((u) => u.status === "leased").reduce((a, u) => a + u.rent, 0))}/mo</div>
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{p.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
