"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronRight, DoorOpen, Home, User } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { ChatPanel } from "@/components/ChatPanel";
import { useSnapshot } from "@/components/useSnapshot";
import { act } from "@/components/act";
import { Conversation, Drawer, Reschedule, Section, useToast } from "@/components/ops";
import { fmtDateTime, relTime } from "@/lib/time";
import type { Channel, ResourceId, Urgency, WorkOrder } from "@/lib/types";

const WHO: Record<ResourceId, string> = {
  "crew-a": "Maintenance team",
  "crew-b": "Renovation crew",
  "vendor-plumbing": "On-call plumber",
  leasing: "Leasing team",
  rodrigo: "Rodrigo",
};

const VIA: Record<Channel, string> = {
  website: "website",
  "rentals.ca": "Rentals.ca",
  kijiji: "Kijiji",
  facebook: "Facebook",
  phone: "phone",
  sms: "text",
  "tenant-portal": "tenant portal",
  email: "email",
  "investor-site": "website",
};

const URGENCY: Record<Urgency, { bar: string; pill: string; label: string }> = {
  emergency: { bar: "bg-rose-500", pill: "bg-rose-50 text-rose-700 ring-rose-200", label: "Emergency" },
  urgent: { bar: "bg-amber-400", pill: "bg-amber-50 text-amber-800 ring-amber-200", label: "Urgent" },
  routine: { bar: "bg-slate-300", pill: "bg-slate-50 text-slate-600 ring-slate-200", label: "Routine" },
};

const STATUS: Record<WorkOrder["status"], { label: string; cls: string }> = {
  in_progress: { label: "Crew on site", cls: "text-rose-700" },
  scheduled: { label: "Scheduled", cls: "text-slate-600" },
  completed: { label: "Completed", cls: "text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "text-slate-400" },
};

type Filter = "open" | "emergency" | "all";

export default function MaintenancePage() {
  const { data, refresh } = useSnapshot();
  const [filter, setFilter] = useState<Filter>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  // Deep link from the dashboard activity feed: /maintenance?open=WO-2210
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("open");
    if (id) {
      setOpenId(id);
      setFilter("all");
    }
  }, []);

  const all = useMemo(() => data?.workOrders ?? [], [data]);
  const orders = useMemo(() => {
    const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter === "open") return sorted.filter((w) => w.status === "scheduled" || w.status === "in_progress");
    if (filter === "emergency") return sorted.filter((w) => w.urgency === "emergency");
    return sorted;
  }, [all, filter]);
  const selected = all.find((w) => w.id === openId) ?? null;

  const open = all.filter((w) => w.status === "scheduled" || w.status === "in_progress");
  const weekAhead = Date.now() + 7 * 86400_000;
  const stats: [string, string][] = [
    ["Open", String(open.length)],
    ["Emergencies", String(all.filter((w) => w.urgency === "emergency").length)],
    ["Booked this week", String(open.filter((w) => w.scheduledFor && new Date(w.scheduledFor).getTime() < weekAhead).length)],
    ["Completed", String(all.filter((w) => w.status === "completed").length)],
  ];

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Tenant requests by text, phone and portal" />
      <div className="grid gap-6 p-6 lg:p-8 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="label mb-2">Try it as a tenant</div>
          <ChatPanel
            persona="tenant"
            channel="tenant-portal"
            title="Bonnie Doon Manor Maintenance"
            subtitle="Text line · open 24/7"
            avatar="/bdm/exterior.jpg"
            greeting="Hi, this is the Bonnie Doon Manor maintenance line. What's going on in your suite?"
            suggestions={["Water is dripping from my bathroom ceiling. Chloe Lavoie, suite 204", "Hi it's Tom Haddad in 205, my fridge stopped cooling", "The kitchen tap in 306 keeps dripping"]}
            allowVoice
            className="h-[620px]"
            onTurn={refresh}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-sand-200 bg-sand-200 md:grid-cols-4">
            {stats.map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <div className="text-xs text-slate-500">{k}</div>
                <div className="mt-0.5 text-xl font-semibold text-navy-900">{v}</div>
              </div>
            ))}
          </div>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-3.5">
              <div className="font-semibold text-navy-900">Work orders</div>
              <div className="flex rounded-md border border-sand-200 p-0.5 text-xs">
                {(
                  [
                    ["open", "Open"],
                    ["emergency", "Emergencies"],
                    ["all", "All"],
                  ] as [Filter, string][]
                ).map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)} className={`rounded px-3 py-1 ${filter === id ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-sand-100"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-sand-100 bg-sand-50 px-5 py-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Emergency: on-call sent right away
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Urgent: within 24 hours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" /> Routine: within 3 business days
              </span>
            </div>

            {orders.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">Nothing here right now.</div>}

            <ul className="divide-y divide-sand-100">
              {orders.map((w) => {
                const u = URGENCY[w.urgency];
                const fresh = Date.now() - new Date(w.createdAt).getTime() < 20000;
                return (
                  <li key={w.id}>
                    <button onClick={() => setOpenId(w.id)} className={`group relative flex w-full gap-4 py-4 pl-6 pr-4 text-left hover:bg-sand-50 ${fresh ? "flash" : ""}`}>
                      <span className={`absolute inset-y-3 left-0 w-1 rounded-r ${u.bar}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-navy-900">{w.issue}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${u.pill}`}>{u.label}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <User size={13} /> Suite #{w.unitId.slice(4)} · {w.tenant}
                          </span>
                          <span>{w.category}</span>
                          <span>via {VIA[w.channel]}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                          <span className="flex items-center gap-1.5 text-navy-900">
                            <CalendarClock size={14} className="text-slate-400" />
                            {w.scheduledFor ? fmtDateTime(w.scheduledFor) : "Not scheduled"}
                          </span>
                          <span className="text-slate-600">{WHO[w.resource]}</span>
                          <span className="flex items-center gap-1 text-slate-500">
                            {w.permissionToEnter ? <DoorOpen size={13} /> : <Home size={13} />}
                            {w.permissionToEnter ? "Entry permitted" : "Tenant will be home"}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className={`font-medium ${STATUS[w.status].cls}`}>{STATUS[w.status].label}</div>
                        <div className="mt-1 whitespace-nowrap text-slate-400">{w.id}</div>
                        <div className="whitespace-nowrap text-slate-400">{relTime(w.createdAt)}</div>
                      </div>
                      <ChevronRight size={16} className="mt-1 shrink-0 self-center text-slate-300 group-hover:text-slate-500" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      {selected && (
        <WorkOrderDrawer
          wo={selected}
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

function WorkOrderDrawer({ wo, onClose, onChanged, onError }: { wo: WorkOrder; onClose: () => void; onChanged: (msg: string) => void; onError: (msg: string) => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const u = URGENCY[wo.urgency];
  const active = wo.status === "scheduled" || wo.status === "in_progress";

  useEffect(() => {
    act<{ sessionId: string | null }>({ kind: "wo.session", id: wo.id })
      .then((r) => setSessionId(r.sessionId))
      .catch(() => setSessionId(null));
  }, [wo.id]);

  async function run(body: Record<string, unknown>, msg: string) {
    try {
      await act(body);
      onChanged(msg);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <Drawer
      onClose={onClose}
      title={wo.issue}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${u.pill}`}>{u.label}</span>
          <span className={`font-medium ${STATUS[wo.status].cls}`}>{STATUS[wo.status].label}</span>
          <span>
            · {wo.id} · opened {relTime(wo.createdAt)}
          </span>
        </div>
      }
    >
      <Section title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ["Tenant", `${wo.tenant} · Suite #${wo.unitId.slice(4)}`],
            ["Category", wo.category],
            ["Reported via", VIA[wo.channel]],
            ["Entry", wo.permissionToEnter ? "Permission to enter" : "Tenant will be home"],
            ["Assigned to", WHO[wo.resource]],
            ["Scheduled", wo.scheduledFor ? fmtDateTime(wo.scheduledFor) : "Not scheduled"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {active && (
        <Section title="Actions">
          <div className="flex flex-wrap gap-2">
            {wo.status === "scheduled" && (
              <button className="btn-ghost" onClick={() => run({ kind: "wo.status", id: wo.id, status: "in_progress" }, "Marked as crew on site")}>
                Crew on site
              </button>
            )}
            <button className="btn-primary" onClick={() => run({ kind: "wo.status", id: wo.id, status: "completed" }, `${wo.id} completed. Tenant asked to confirm`)}>
              Mark complete
            </button>
            {wo.eventId && (
              <button className="btn-ghost" onClick={() => setRescheduling((r) => !r)}>
                {rescheduling ? "Close" : "Reschedule"}
              </button>
            )}
            <button className="btn-ghost text-rose-700" onClick={() => run({ kind: "wo.status", id: wo.id, status: "cancelled" }, `${wo.id} cancelled`)}>
              Cancel
            </button>
          </div>

          {rescheduling && wo.eventId && (
            <div className="mt-4">
              <div className="mb-2 text-xs text-slate-500">Open times for {WHO[wo.resource].toLowerCase()}:</div>
              <Reschedule
                eventId={wo.eventId}
                onDone={(label) => {
                  setRescheduling(false);
                  onChanged(`Moved to ${label}. Tenant notified`);
                }}
              />
            </div>
          )}

          <div className="mt-4">
            <div className="mb-1.5 text-xs text-slate-500">Assign to</div>
            <div className="flex flex-wrap gap-1.5">
              {(["crew-a", "crew-b", "vendor-plumbing"] as ResourceId[]).map((r) => (
                <button
                  key={r}
                  onClick={() => r !== wo.resource && run({ kind: "wo.reassign", id: wo.id, resource: r }, `Reassigned to ${WHO[r]}`)}
                  className={`rounded-full px-3 py-1 text-xs ${r === wo.resource ? "bg-navy-900 text-white" : "border border-sand-200 text-slate-700 hover:bg-sand-100"}`}
                >
                  {WHO[r]}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section title={`Conversation with ${wo.tenant.split(" ")[0]}`}>
        <Conversation
          sessionId={sessionId}
          who={wo.tenant}
          placeholder={`Text ${wo.tenant.split(" ")[0]}…`}
          empty="This request came in before the demo started. Send a message to start a thread."
          reply={async (text) => {
            const r = await act<{ sessionId: string }>({ kind: "reply", workOrderId: wo.id, text });
            onChanged("Message sent");
            return r.sessionId;
          }}
        />
      </Section>
    </Drawer>
  );
}
