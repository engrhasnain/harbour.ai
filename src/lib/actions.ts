// Things the Triple Harbour team can do from the console: reschedule, cancel, complete, reassign,
// move leads through stages, and reply inside a renter's or tenant's conversation.
import type { CalEvent, InvestorStage, LeadStage, ResourceId, Session, WorkOrder, WorkflowId } from "./types";
import { db, getSession, log, mail, overlaps, RESOURCES, scoreLead, type Slot } from "./store";
import { addDays, fmtDateTime, local, zoned } from "./time";

/** Open slots for a team (at most two per day), used when rescheduling. */
export function freeSlots(resource: ResourceId, minutes: number, count = 6, ignoreId?: string): Slot[] {
  const now = new Date();
  const t = local(now);
  const out: Slot[] = [];
  for (let i = 0; i < 21 && out.length < count; i++) {
    const d = addDays(t.y, t.m, t.d, i);
    if (d.dow === 0) continue;
    const [open, close] = resource === "leasing" ? (d.dow === 6 ? [10, 14] : [10, 19]) : d.dow === 6 ? [9, 13] : [8, 17];
    let perDay = 0;
    for (let h = open; h < close && perDay < 2 && out.length < count; h += resource === "leasing" ? 2 : 3) {
      const s = zoned(d.y, d.m, d.d, h, 0);
      const e = new Date(s.getTime() + minutes * 60000);
      if (s.getTime() < now.getTime() + 60 * 60000) continue;
      const end = local(e);
      if (end.h + end.min / 60 > close) continue;
      if (overlaps(resource, s, e, ignoreId)) continue;
      out.push({ start: s.toISOString(), end: e.toISOString() });
      perDay++;
    }
  }
  return out;
}

const workflowFor = (e: CalEvent): WorkflowId => (e.kind === "showing" ? "inquiry-to-showing" : "maintenance-dispatch");
const fail = (error: string) => ({ ok: false as const, error });

export function slotsForEvent(id: string) {
  const ev = db().events.find((e) => e.id === id);
  if (!ev) return [];
  const minutes = Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000);
  return freeSlots(ev.resource, Math.min(minutes, 240), 6, ev.id);
}

export function moveEvent(id: string, startIso: string) {
  const s = db();
  const ev = s.events.find((e) => e.id === id);
  if (!ev) return fail("Booking not found");
  const dur = new Date(ev.end).getTime() - new Date(ev.start).getTime();
  const start = new Date(startIso);
  const end = new Date(start.getTime() + dur);
  if (Number.isNaN(start.getTime()) || overlaps(ev.resource, start, end, ev.id)) return fail("That time is already taken");
  ev.start = start.toISOString();
  ev.end = end.toISOString();
  const wo = ev.workOrderId ? s.workOrders.find((w) => w.id === ev.workOrderId) : undefined;
  if (wo) wo.scheduledFor = ev.start;
  log(workflowFor(ev), `Rescheduled: ${ev.title}`, { actor: "staff", detail: `Moved to ${fmtDateTime(ev.start)} · ${wo ? "tenant" : "renter"} notified by text`, ref: { type: "event", id: ev.id } });
  return { ok: true as const };
}

export function cancelEvent(id: string) {
  const s = db();
  const ev = s.events.find((e) => e.id === id);
  if (!ev) return fail("Booking not found");
  s.events = s.events.filter((e) => e.id !== id);
  const lead = ev.leadId ? s.leads.find((l) => l.id === ev.leadId) : undefined;
  if (lead) {
    lead.stage = "qualified";
    lead.showingEventId = undefined;
    lead.summary = "Viewing cancelled by the team. Renter notified and offered new times.";
    lead.lastActivity = new Date().toISOString();
  }
  const wo = ev.workOrderId ? s.workOrders.find((w) => w.id === ev.workOrderId) : undefined;
  if (wo) {
    wo.status = "cancelled";
    wo.scheduledFor = undefined;
    wo.eventId = undefined;
  }
  log(workflowFor(ev), `Cancelled: ${ev.title}`, { actor: "staff", detail: wo ? "Tenant notified by text" : "Renter notified and offered new times" });
  return { ok: true as const };
}

export function completeEvent(id: string) {
  const s = db();
  const ev = s.events.find((e) => e.id === id);
  if (!ev) return fail("Booking not found");
  if (ev.workOrderId) return setWorkOrderStatus(ev.workOrderId, "completed");
  const lead = ev.leadId ? s.leads.find((l) => l.id === ev.leadId) : undefined;
  if (lead) {
    lead.stage = "showing_done";
    lead.summary = `Viewed #${ev.unitId?.slice(4)}. Application link sent automatically.`;
    lead.lastActivity = new Date().toISOString();
    log("inquiry-to-showing", `Viewing done: ${lead.name}. Application link sent`, { actor: "staff", detail: "Follow-up text queued for 2 hours later", ref: { type: "lead", id: lead.id } });
  }
  return { ok: true as const };
}

export function setWorkOrderStatus(id: string, status: WorkOrder["status"]) {
  const wo = db().workOrders.find((w) => w.id === id);
  if (!wo) return fail("Work order not found");
  if (status === "cancelled" && wo.eventId) return cancelEvent(wo.eventId);
  wo.status = status;
  const verb = status === "completed" ? "Completed" : status === "in_progress" ? "Crew on site" : "Reopened";
  log("maintenance-dispatch", `${verb}: ${wo.id} #${wo.unitId.slice(4)}, ${wo.issue}`, {
    actor: "staff",
    detail: status === "completed" ? "Tenant asked by text to confirm it's fixed" : "Tenant notified by text",
    ref: { type: "workorder", id: wo.id },
  });
  return { ok: true as const };
}

export function reassignWorkOrder(id: string, resource: ResourceId) {
  const s = db();
  const wo = s.workOrders.find((w) => w.id === id);
  const ev = wo?.eventId ? s.events.find((e) => e.id === wo.eventId) : undefined;
  if (!wo || !ev) return fail("Work order not found");
  if (wo.resource === resource) return { ok: true as const };
  const slot = freeSlots(resource, 120, 1)[0];
  if (!slot) return fail("No open time for that team in the next 3 weeks");
  Object.assign(ev, { resource, start: slot.start, end: slot.end });
  wo.resource = resource;
  wo.scheduledFor = slot.start;
  log("maintenance-dispatch", `Reassigned ${wo.id} to ${RESOURCES[resource].name}`, { actor: "staff", detail: `New time ${fmtDateTime(slot.start)} · tenant notified`, ref: { type: "workorder", id: wo.id } });
  return { ok: true as const };
}

const STAGE_LABEL: Partial<Record<LeadStage, string>> = {
  qualified: "Marked qualified",
  showing_done: "Viewing done",
  applied: "Application received",
  leased: "Lease signed",
  lost: "Marked as lost",
};

export function setLeadStage(id: string, stage: LeadStage) {
  const s = db();
  const lead = s.leads.find((l) => l.id === id);
  if (!lead) return fail("Lead not found");
  lead.stage = stage;
  lead.lastActivity = new Date().toISOString();
  lead.score = stage === "lost" ? Math.min(lead.score, 20) : stage === "leased" ? 100 : Math.max(lead.score, scoreLead(lead));
  lead.summary = `${STAGE_LABEL[stage] ?? "Updated"} by the team.`;
  if (stage === "leased" && lead.unitInterest) {
    const unit = s.units.find((u) => u.id === lead.unitInterest);
    if (unit && unit.status !== "leased") Object.assign(unit, { status: "leased", tenant: lead.name, availableFrom: undefined });
  }
  log("inquiry-to-showing", `${STAGE_LABEL[stage] ?? "Updated"}: ${lead.name ?? lead.id}`, {
    actor: "staff",
    detail: stage === "leased" ? "Suite marked leased · listing updated" : undefined,
    ref: { type: "lead", id: lead.id },
  });
  return { ok: true as const };
}

/** A team member replies inside a conversation; the renter or tenant sees it live in their chat. */
export function staffReply(target: { leadId?: string; workOrderId?: string; investorId?: string }, text: string) {
  const s = db();
  let sess: Session | undefined;
  let label = "";
  if (target.investorId) {
    const inv = s.investors.find((i) => i.id === target.investorId);
    if (!inv) return fail("Investor not found");
    sess = inv.sessionId ? s.sessions.get(inv.sessionId) : undefined;
    if (!sess) {
      sess = getSession(`staff-${inv.id}`, "investor", "investor-site");
      sess.investorId = inv.id;
      inv.sessionId = sess.id;
    }
    inv.lastActivity = new Date().toISOString();
    label = inv.name ?? inv.id;
  } else if (target.leadId) {
    const lead = s.leads.find((l) => l.id === target.leadId);
    if (!lead) return fail("Lead not found");
    sess = lead.sessionId ? s.sessions.get(lead.sessionId) : undefined;
    if (!sess) {
      sess = getSession(`staff-${lead.id}`, "prospect", lead.channel);
      sess.leadId = lead.id;
      lead.sessionId = sess.id;
    }
    lead.lastActivity = new Date().toISOString();
    label = lead.name ?? lead.id;
  } else if (target.workOrderId) {
    const wo = s.workOrders.find((w) => w.id === target.workOrderId);
    if (!wo) return fail("Work order not found");
    sess = [...s.sessions.values()].find((x) => x.workOrderIds.includes(wo.id));
    if (!sess) {
      sess = getSession(`staff-${wo.id}`, "tenant", wo.channel);
      sess.workOrderIds.push(wo.id);
    }
    label = `${wo.tenant} (#${wo.unitId.slice(4)})`;
  }
  if (!sess) return fail("No conversation found");
  sess.transcript.push({ role: "assistant", by: "staff", text, ts: new Date().toISOString() });
  (sess.staffNotes ??= []).push(text);
  const workflow: WorkflowId = sess.persona === "tenant" ? "maintenance-dispatch" : sess.persona === "investor" ? "investor-inquiry" : "inquiry-to-showing";
  log(workflow, `${sess.persona === "investor" ? "Rodrigo" : "Team"} replied to ${label}`, { actor: "staff", detail: `"${text.slice(0, 80)}"` });
  return { ok: true as const, sessionId: sess.id };
}

const INV_LABEL: Record<InvestorStage, string> = {
  new: "New inquiry",
  call_booked: "Intro call booked",
  docs_sent: "Offering documents sent via EMD",
  committed: "Committed",
  not_fit: "Not a fit",
};

export function setInvestorStage(id: string, stage: InvestorStage) {
  const inv = db().investors.find((i) => i.id === id);
  if (!inv) return fail("Investor not found");
  inv.stage = stage;
  inv.lastActivity = new Date().toISOString();
  log("investor-inquiry", `${INV_LABEL[stage]}: ${inv.name ?? inv.id}`, { actor: "staff", ref: { type: "investor", id } });
  return { ok: true as const };
}

export function markRead(id: string) {
  const m = db().emails.find((e) => e.id === id);
  if (!m) return fail("Email not found");
  for (const e of db().emails) if (e.threadId === m.threadId) e.unread = false;
  return { ok: true as const };
}

/** Team member replies in an email thread; if the thread belongs to a lead, it also lands in their conversation. */
export function emailReply(threadId: string, text: string) {
  const s = db();
  const thread = s.emails.filter((e) => e.threadId === threadId).sort((a, b) => a.ts.localeCompare(b.ts));
  if (!thread.length) return fail("Thread not found");
  const first = thread[0];
  const outsider = thread.find((e) => !e.fromEmail.endsWith("@tripleharbour.com"));
  const leadId = thread.find((e) => e.leadId)?.leadId;
  if (leadId) staffReply({ leadId }, text);
  mail({
    threadId,
    folder: first.folder,
    from: "Bonnie Doon Manor Leasing",
    fromEmail: "leasing@tripleharbour.com",
    to: outsider?.fromEmail ?? first.to,
    subject: first.subject.startsWith("Re:") ? first.subject : `Re: ${first.subject}`,
    body: text,
    leadId,
  });
  markRead(first.id);
  return { ok: true as const };
}

export function sessionForWorkOrder(id: string) {
  return [...db().sessions.values()].find((x) => x.workOrderIds.includes(id));
}
