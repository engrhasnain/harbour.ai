import type {
  Activity,
  CalEvent,
  Channel,
  Email,
  InvestorLead,
  Kpis,
  Lead,
  LeadStage,
  Persona,
  Property,
  ResourceId,
  Session,
  Snapshot,
  Unit,
  Urgency,
  WorkOrder,
  WorkflowId,
} from "./types";
import { PROPERTIES, seedActivity, seedCalendar, seedLeads, seedUnits } from "./seed";
import { seedEmails, seedInvestors } from "./seed-extra";
import { addDays, fmtDateTime, isAfterHours, local, longWhen, monthDay, zoned } from "./time";
import { RESOURCE_META } from "./resources";

interface State {
  seededAt: string;
  properties: Property[];
  units: Unit[];
  leads: Lead[];
  events: CalEvent[];
  workOrders: WorkOrder[];
  activity: Activity[];
  emails: Email[];
  investors: InvestorLead[];
  sessions: Map<string, Session>;
  narratives: Record<string, { text: string; generatedAt: string; engine: string }>;
  counters: { lead: number; event: number; wo: number; act: number; mail: number; inv: number };
}

function build(): State {
  const now = new Date();
  const units = seedUnits(now);
  const { events, workOrders, leads } = seedCalendar(now, seedLeads(now));
  const investors = seedInvestors(now, events);
  return {
    seededAt: now.toISOString(),
    properties: PROPERTIES,
    units,
    leads,
    events,
    workOrders,
    activity: seedActivity(now, leads, workOrders),
    emails: seedEmails(now, leads, workOrders, investors, events),
    investors,
    sessions: new Map(),
    narratives: {},
    counters: { lead: 1100, event: 700, wo: 2300, act: 9500, mail: 500, inv: 400 },
  };
}

/** Put a message in the team inbox (what the assistant sends to, or on behalf of, the team). */
export function mail(e: Omit<Email, "id" | "ts" | "unread"> & { ts?: string }) {
  const m: Email = { ts: new Date().toISOString(), unread: true, ...e, id: nextId("mail", "M") };
  db().emails.unshift(m);
  return m;
}

// Survive Next.js hot reloads: keep the state on globalThis.
const g = globalThis as unknown as { __thState?: State };
export function db(): State {
  if (!g.__thState) g.__thState = build();
  return g.__thState;
}

export function resetDemo() {
  g.__thState = build();
}

export function nextId(kind: keyof State["counters"], prefix: string) {
  const s = db();
  s.counters[kind] += 1;
  return `${prefix}-${s.counters[kind]}`;
}

export function log(workflow: WorkflowId, title: string, opts: Partial<Omit<Activity, "id" | "workflow" | "title">> = {}) {
  const a: Activity = { id: nextId("act", "A"), ts: new Date().toISOString(), workflow, title, actor: "ai", ...opts };
  db().activity.unshift(a);
  return a;
}

// ---------- Sessions ----------

export function getSession(id: string, persona: Persona, channel: Channel): Session {
  const s = db();
  let sess = s.sessions.get(id);
  if (!sess) {
    sess = { id, persona, channel, createdAt: new Date().toISOString(), messages: [], transcript: [], workOrderIds: [], offline: {} };
    s.sessions.set(id, sess);
  }
  return sess;
}

// ---------- Leads ----------

const STAGE_ORDER: LeadStage[] = ["new", "qualified", "showing_booked", "showing_done", "applied", "leased"];

export function scoreLead(l: Lead): number {
  let score = 15;
  if (l.name) score += 5;
  if (l.phone || l.email) score += 15;
  if (l.bedrooms) score += 5;
  if (l.moveIn) {
    const days = (new Date(l.moveIn).getTime() - Date.now()) / 86400_000;
    score += days <= 45 ? 15 : days <= 90 ? 8 : 3;
  }
  const unit = l.unitInterest ? db().units.find((u) => u.id === l.unitInterest) : undefined;
  const rent = unit?.rent ?? (l.bedrooms === 2 ? 1465 : 1300);
  if (l.incomeMonthly) score += l.incomeMonthly >= rent * 2.5 ? 20 : 8;
  if (l.stage === "showing_booked") score += 20;
  return Math.min(100, score);
}

export function upsertLeadForSession(sess: Session, patch: Partial<Lead>): Lead {
  const s = db();
  let lead = sess.leadId ? s.leads.find((l) => l.id === sess.leadId) : undefined;
  if (!lead) {
    const now = new Date().toISOString();
    lead = {
      id: nextId("lead", "L"),
      createdAt: sess.createdAt,
      channel: sess.channel,
      stage: "new",
      score: 0,
      summary: "New inquiry, conversation in progress",
      sessionId: sess.id,
      afterHours: isAfterHours(sess.createdAt),
      firstResponseSec: 0,
      lastActivity: now,
    };
    s.leads.unshift(lead);
    sess.leadId = lead.id;
    log("inquiry-to-showing", `New inquiry via ${sess.channel}`, { ref: { type: "lead", id: lead.id }, detail: lead.afterHours ? "After hours: no staff online" : undefined });
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null && v !== "") (lead as unknown as Record<string, unknown>)[k] = v;
  }
  const qualifies = lead.stage === "new" && (lead.phone || lead.email) && lead.moveIn && lead.bedrooms;
  if (qualifies) lead.stage = "qualified";
  lead.score = scoreLead(lead);
  lead.lastActivity = new Date().toISOString();
  return lead;
}

// ---------- Scheduling ----------

const SHOWING_MIN = 30;

export function overlaps(resource: ResourceId, start: Date, end: Date, ignoreId?: string) {
  return db().events.some(
    (e) => e.resource === resource && e.id !== ignoreId && new Date(e.start) < end && new Date(e.end) > start,
  );
}

export interface Slot {
  start: string;
  end: string;
}

/** Open showing slots with the leasing team, spread across days. */
export function showingSlots(opts: { fromDays?: number; days?: number; perDay?: number; earliest?: Date } = {}): Slot[] {
  const now = new Date();
  const earliest = new Date(Math.max(now.getTime() + 2 * 3600_000, opts.earliest?.getTime() ?? 0));
  const t = local(now);
  const out: Slot[] = [];
  const days = opts.days ?? 5;
  for (let i = opts.fromDays ?? 0; i < (opts.fromDays ?? 0) + days + 2 && out.length < days * (opts.perDay ?? 3); i++) {
    const d = addDays(t.y, t.m, t.d, i);
    if (d.dow === 0) continue;
    const [open, close] = d.dow === 6 ? [10, 14] : [10, 19];
    const dayCandidates: Slot[] = [];
    for (let h = open; h < close; h++) {
      for (const m of [0, 30]) {
        if (h === close - 1 && m === 30 && d.dow === 6) continue;
        const s = zoned(d.y, d.m, d.d, h, m);
        const e = new Date(s.getTime() + SHOWING_MIN * 60000);
        if (s < earliest || overlaps("leasing", s, e)) continue;
        dayCandidates.push({ start: s.toISOString(), end: e.toISOString() });
      }
    }
    if (!dayCandidates.length) continue;
    // Offer a morning, midday and evening option rather than three consecutive half-hours.
    // Offer first, middle and last open times (e.g. 10:00, 14:30, 18:30) rather than consecutive half-hours.
    const n = dayCandidates.length;
    const idx = [...new Set([0, Math.floor(n / 2), n - 1])].slice(0, opts.perDay ?? 3);
    for (const k of idx) out.push(dayCandidates[k]);
  }
  return out;
}

export function isShowingSlotFree(startIso: string): boolean {
  const s = new Date(startIso);
  const e = new Date(s.getTime() + SHOWING_MIN * 60000);
  const p = local(s);
  if (Number.isNaN(s.getTime()) || s.getTime() < Date.now()) return false;
  if (p.dow === 0) return false;
  const [open, close] = p.dow === 6 ? [10, 14] : [10, 19];
  if (p.h < open || p.h >= close) return false;
  return !overlaps("leasing", s, e);
}

export function bookShowing(sess: Session, args: { name: string; phone: string; email?: string; unitId: string; start: string; notes?: string }) {
  const s = db();
  if (!isShowingSlotFree(args.start)) return { ok: false as const, error: "That time is no longer available. Fetch fresh slots and offer them." };
  const unit = s.units.find((u) => u.id === args.unitId);
  if (!unit || unit.status === "leased") return { ok: false as const, error: `Unit ${args.unitId} is not available to show.` };
  const lead = upsertLeadForSession(sess, { name: args.name, phone: args.phone, email: args.email, unitInterest: unit.id, bedrooms: unit.beds });
  const start = new Date(args.start);
  const ev: CalEvent = {
    id: nextId("event", "E"),
    resource: "leasing",
    start: start.toISOString(),
    end: new Date(start.getTime() + SHOWING_MIN * 60000).toISOString(),
    title: `Showing #${unit.number}: ${args.name}`,
    kind: "showing",
    propertyId: unit.propertyId,
    unitId: unit.id,
    leadId: lead.id,
    createdBy: "ai",
    notes: args.notes,
  };
  s.events.push(ev);
  lead.stage = "showing_booked";
  lead.showingEventId = ev.id;
  lead.score = scoreLead(lead);
  lead.summary = `Showing booked by AI for #${unit.number}${args.notes ? `. ${args.notes}` : ""}`;
  log("inquiry-to-showing", `Booked showing for ${args.name} (#${unit.number})`, { ref: { type: "event", id: ev.id }, detail: "Added to leasing calendar · SMS confirmation + 2h reminder queued" });
  mail({
    threadId: `A-${lead.id}`,
    folder: "alerts",
    from: "Bonnie Doon Manor Assistant",
    fromEmail: "assistant@tripleharbour.com",
    to: "leasing@tripleharbour.com",
    subject: `Viewing booked: ${args.name}, ${fmtDateTime(ev.start)}`,
    body: `${args.name} booked a viewing of suite #${unit.number} for ${longWhen(ev.start)}.\n\nPhone: ${args.phone}${lead.moveIn ? `\nMove-in: ${monthDay(lead.moveIn)}` : ""}${lead.pets ? `\nPets: ${lead.pets}` : ""}${args.notes ? `\nNotes: ${args.notes}` : ""}\n\nIt's on the leasing calendar and they've had a text confirmation. Came in via ${sess.channel}.`,
    leadId: lead.id,
    sessionId: sess.id,
    link: { label: "Open lead", href: `/leads?open=${lead.id}` },
  });
  return { ok: true as const, event: ev, lead, unit };
}

const CREW_HOURS = { start: 8, end: 17 };

function findCrewSlot(resource: ResourceId, from: Date, durationH: number, allowSaturday: boolean): Date {
  const t = local(from);
  for (let i = 0; i < 14; i++) {
    const d = addDays(t.y, t.m, t.d, i);
    if (d.dow === 0 || (d.dow === 6 && !allowSaturday)) continue;
    for (let h = CREW_HOURS.start; h + durationH <= CREW_HOURS.end; h++) {
      const s = zoned(d.y, d.m, d.d, h);
      const e = new Date(s.getTime() + durationH * 3600_000);
      if (s < from) continue;
      if (!overlaps(resource, s, e)) return s;
    }
  }
  return from;
}

export function createWorkOrder(
  sess: Session | null,
  args: { unitId: string; tenant: string; phone?: string; category: string; issue: string; urgency: Urgency; permissionToEnter: boolean; channel: Channel },
) {
  const s = db();
  const unit = s.units.find((u) => u.id === args.unitId || u.number === args.unitId.replace(/\D/g, ""));
  if (!unit) return { ok: false as const, error: `No suite ${args.unitId} at Bonnie Doon Manor. Ask the tenant to confirm their suite number.` };
  const now = new Date();
  const plumbing = /plumb|leak|water|flood|drain|toilet|sewer/i.test(`${args.category} ${args.issue}`);
  let resource: ResourceId = "crew-a";
  let start: Date;
  if (args.urgency === "emergency") {
    resource = plumbing ? "vendor-plumbing" : "crew-a";
    // Dispatch now, on-call: round up to the next quarter hour.
    start = new Date(Math.ceil((now.getTime() + 20 * 60000) / (15 * 60000)) * 15 * 60000);
  } else if (args.urgency === "urgent") {
    start = findCrewSlot("crew-a", new Date(now.getTime() + 60 * 60000), 2, true);
  } else {
    const t = local(now);
    const d = addDays(t.y, t.m, t.d, 1);
    start = findCrewSlot("crew-a", zoned(d.y, d.m, d.d, CREW_HOURS.start), 2, false);
  }
  const id = nextId("wo", "WO");
  const ev: CalEvent = {
    id: nextId("event", "E"),
    resource,
    start: start.toISOString(),
    end: new Date(start.getTime() + 2 * 3600_000).toISOString(),
    title: `${args.category} #${unit.number}: ${args.issue}`.slice(0, 90),
    kind: "work_order",
    propertyId: unit.propertyId,
    unitId: unit.id,
    workOrderId: id,
    createdBy: "ai",
    notes: args.permissionToEnter ? "Permission to enter granted" : "Tenant must be home",
  };
  s.events.push(ev);
  const wo: WorkOrder = {
    id,
    createdAt: now.toISOString(),
    propertyId: unit.propertyId,
    unitId: unit.id,
    tenant: args.tenant,
    phone: args.phone,
    category: args.category,
    issue: args.issue,
    urgency: args.urgency,
    status: args.urgency === "emergency" ? "in_progress" : "scheduled",
    resource,
    eventId: ev.id,
    scheduledFor: ev.start,
    permissionToEnter: args.permissionToEnter,
    channel: args.channel,
    createdBy: "ai",
  };
  s.workOrders.unshift(wo);
  if (sess) sess.workOrderIds.push(id);
  const crewName = RESOURCES[resource].name;
  log("maintenance-dispatch", `Triaged ${args.urgency} ${args.category.toLowerCase()} request from #${unit.number}`, {
    ref: { type: "workorder", id },
    detail: `${crewName} booked · tenant notified with ETA${args.urgency === "emergency" ? " · on-call paged" : ""}`,
  });
  mail({
    threadId: `A-${id}`,
    folder: "alerts",
    from: "Bonnie Doon Manor Assistant",
    fromEmail: "assistant@tripleharbour.com",
    to: "maintenance@tripleharbour.com",
    subject: `${args.urgency === "emergency" ? "EMERGENCY · " : ""}Work order ${id}: #${unit.number} ${args.issue}`,
    body: `${args.tenant} (suite #${unit.number}) reported: "${args.issue}".\n\nPriority: ${args.urgency}\nBooked: ${crewName}, ${longWhen(ev.start)}\nEntry: ${args.permissionToEnter ? "permission to enter" : "tenant will be home"}\n\n${args.urgency === "emergency" ? "The on-call crew was paged. " : ""}The tenant has been told when to expect someone.`,
    sessionId: sess?.id,
    link: { label: "Open work order", href: `/maintenance?open=${id}` },
  });
  return { ok: true as const, workOrder: wo, event: ev, unit, crewName };
}

export function escalate(sess: Session, reason: string, urgency: "normal" | "high") {
  const workflow: WorkflowId = sess.persona === "tenant" ? "maintenance-dispatch" : sess.persona === "investor" ? "investor-inquiry" : "inquiry-to-showing";
  log(workflow, `Escalated to team: ${reason}`, {
    detail: urgency === "high" ? "Paged on-call manager" : "Added to staff inbox with full transcript",
  });
  const lastFromThem = [...sess.transcript].reverse().find((m) => m.role === "user")?.text ?? "";
  mail({
    threadId: `X-${sess.id}`,
    folder: sess.persona === "investor" ? "investors" : "alerts",
    from: sess.persona === "investor" ? "Harbour Investor Desk" : "Bonnie Doon Manor Assistant",
    fromEmail: "assistant@tripleharbour.com",
    to: sess.persona === "investor" ? "rodrigo@tripleharbour.com" : sess.persona === "tenant" ? "maintenance@tripleharbour.com" : "leasing@tripleharbour.com",
    subject: `Needs a reply: ${reason}`.slice(0, 110),
    body: `The assistant didn't want to guess on this one.\n\nThey wrote: "${lastFromThem}"\n\nReply from the console and it shows up in their conversation right away.`,
    sessionId: sess.id,
    leadId: sess.leadId,
    link: sess.leadId ? { label: "Open lead", href: `/leads?open=${sess.leadId}` } : sess.persona === "investor" ? { label: "Open investors", href: "/investors" } : undefined,
  });
  return { ok: true };
}

export const RESOURCES = RESOURCE_META;

// ---------- Snapshot / KPIs ----------

export function kpis(): Kpis {
  const s = db();
  const units = s.units.filter((u) => u.propertyId === "bonnie-doon");
  const leased = units.filter((u) => u.status === "leased").length;
  const vacant = units.filter((u) => u.status !== "leased");
  const since = Date.now() - 14 * 86400_000;
  const recent = s.leads.filter((l) => new Date(l.createdAt).getTime() >= since);
  const reached = (l: Lead, st: LeadStage) => STAGE_ORDER.indexOf(l.stage) >= STAGE_ORDER.indexOf(st) && l.stage !== "lost";
  const showings = recent.filter((l) => reached(l, "showing_booked")).length;
  const responses = recent.map((l) => l.firstResponseSec || 6).sort((a, b) => a - b);
  return {
    occupancy: leased / units.length,
    leased,
    totalUnits: units.length,
    vacancyCostPerDay: Math.round(vacant.reduce((a, u) => a + u.rent, 0) / 30.4),
    inquiries14d: recent.length,
    afterHoursPct: recent.length ? recent.filter((l) => l.afterHours).length / recent.length : 0,
    medianFirstResponseSec: responses.length ? responses[Math.floor(responses.length / 2)] : 0,
    showingsBooked14d: showings,
    inquiryToShowingPct: recent.length ? showings / recent.length : 0,
    applications14d: recent.filter((l) => reached(l, "applied")).length,
    openWorkOrders: s.workOrders.filter((w) => w.status === "scheduled" || w.status === "in_progress").length,
    aiHandledPct: 0.94,
    funnel: [
      { stage: "Inquiries", count: recent.length },
      { stage: "Qualified", count: recent.filter((l) => reached(l, "qualified")).length },
      { stage: "Showings", count: showings },
      { stage: "Applications", count: recent.filter((l) => reached(l, "applied")).length },
      { stage: "Leases", count: recent.filter((l) => reached(l, "leased")).length },
    ],
  };
}

export function engineInfo(): Snapshot["engine"] {
  return process.env.ANTHROPIC_API_KEY
    ? { mode: "claude", model: process.env.CLAUDE_MODEL || "claude-opus-5-5" }
    : { mode: "offline" };
}

export function snapshot(): Snapshot {
  const s = db();
  return {
    now: new Date().toISOString(),
    engine: engineInfo(),
    properties: s.properties,
    units: s.units,
    leads: [...s.leads].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
    events: [...s.events].sort((a, b) => a.start.localeCompare(b.start)),
    workOrders: s.workOrders,
    activity: s.activity.slice(0, 80),
    emails: [...s.emails].sort((a, b) => b.ts.localeCompare(a.ts)),
    investors: [...s.investors].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
    kpis: kpis(),
  };
}

// ---------- Investors ----------

export function upsertInvestorForSession(sess: Session, patch: Partial<InvestorLead>): InvestorLead {
  const s = db();
  let inv = sess.investorId ? s.investors.find((i) => i.id === sess.investorId) : undefined;
  if (!inv) {
    inv = {
      id: nextId("inv", "INV"),
      createdAt: sess.createdAt,
      interest: "Asked about the fund",
      stage: "new",
      sessionId: sess.id,
      source: sess.channel === "investor-site" ? "Website" : sess.channel,
      lastActivity: new Date().toISOString(),
    };
    s.investors.unshift(inv);
    sess.investorId = inv.id;
    log("investor-inquiry", "New investor inquiry on the website", { ref: { type: "investor", id: inv.id } });
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null && v !== "") (inv as unknown as Record<string, unknown>)[k] = v;
  }
  inv.lastActivity = new Date().toISOString();
  // Keep the call notes on Rodrigo's calendar in step with what we learn after booking.
  const call = inv.callEventId ? s.events.find((e) => e.id === inv!.callEventId) : undefined;
  if (call) call.notes = `${inv.amount ?? "amount not shared"} · accredited: ${inv.accredited ?? "not asked"}`;
  return inv;
}

export function investorCallSlots(count = 4): Slot[] {
  const now = new Date();
  const t = local(now);
  const out: Slot[] = [];
  for (let i = 1; i < 14 && out.length < count; i++) {
    const d = addDays(t.y, t.m, t.d, i);
    if (d.dow === 0 || d.dow === 6) continue;
    for (const [h, m] of [
      [10, 0],
      [14, 0],
      [16, 30],
    ]) {
      const st = zoned(d.y, d.m, d.d, h, m);
      const en = new Date(st.getTime() + 30 * 60000);
      if (!overlaps("rodrigo", st, en) && out.filter((o) => local(o.start).d === d.d).length < 1) out.push({ start: st.toISOString(), end: en.toISOString() });
    }
  }
  return out.slice(0, count);
}

export function bookInvestorCall(sess: Session, args: { name: string; email: string; phone?: string; start: string; accredited?: InvestorLead["accredited"]; amount?: string; interest?: string }) {
  const s = db();
  const start = new Date(args.start);
  const end = new Date(start.getTime() + 30 * 60000);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() || overlaps("rodrigo", start, end)) return { ok: false as const, error: "That time is no longer open. Fetch fresh times." };
  const inv = upsertInvestorForSession(sess, { name: args.name, email: args.email, phone: args.phone, accredited: args.accredited, amount: args.amount, interest: args.interest });
  const ev: CalEvent = {
    id: nextId("event", "E"),
    resource: "rodrigo",
    start: start.toISOString(),
    end: end.toISOString(),
    title: `Investor intro call: ${args.name}`,
    kind: "investor_call",
    propertyId: "fund",
    createdBy: "ai",
    notes: `${inv.amount ?? "amount not shared"} · accredited: ${inv.accredited ?? "not asked"}`,
  };
  s.events.push(ev);
  inv.stage = "call_booked";
  inv.callEventId = ev.id;
  log("investor-inquiry", `Intro call booked with Rodrigo: ${args.name}`, { ref: { type: "investor", id: inv.id }, detail: `${fmtDateTime(ev.start)} · calendar invite sent` });
  mail({
    threadId: `I-${inv.id}`,
    folder: "investors",
    from: "Harbour Investor Desk",
    fromEmail: "assistant@tripleharbour.com",
    to: "rodrigo@tripleharbour.com",
    subject: `Intro call booked: ${args.name}, ${fmtDateTime(ev.start)}`,
    body: `${args.name} asked about the fund on the website and booked a 30-minute intro call with you for ${longWhen(ev.start)}.\n\nWhat they asked: ${inv.interest}\nAmount mentioned: ${inv.amount ?? "not shared"}\nAccredited: ${inv.accredited ?? "not asked"}\nEmail: ${args.email}${args.phone ? `\nPhone: ${args.phone}` : ""}\n\nThe call is on your calendar.`,
    sessionId: sess.id,
    link: { label: "Open investor pipeline", href: "/investors" },
  });
  return { ok: true as const, event: ev, investor: inv };
}
