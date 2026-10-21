import type Anthropic from "@anthropic-ai/sdk";
import type { Persona, Session, ToolAction, Urgency } from "./types";
import { bookInvestorCall, bookShowing, createWorkOrder, db, escalate, investorCallSlots, showingSlots, upsertInvestorForSession, upsertLeadForSession } from "./store";
import { fmtDateTime, friendlyWhen, longWhen, monthDay, zoned } from "./time";

type Tool = Anthropic.Beta.BetaTool;

const searchUnits: Tool = {
  name: "search_units",
  description:
    "List suites at Bonnie Doon Manor that are available or coming available, with rent, size, features and availability date. Call this before quoting any rent or availability; never quote from memory.",
  input_schema: {
    type: "object",
    properties: {
      bedrooms: { type: "integer", enum: [1, 2], description: "Filter by bedroom count" },
      max_rent: { type: "number", description: "Maximum monthly rent in CAD" },
    },
  },
};

const getShowingSlots: Tool = {
  name: "get_showing_slots",
  description:
    "Get open showing times on the leasing team's calendar (Edmonton time). Returns slots with an exact start_iso. Offer two or three of them in plain language; when booking, pass the start_iso back unchanged.",
  input_schema: {
    type: "object",
    properties: {
      days_from_today: { type: "integer", description: "Start searching this many days from today (0 = today). Use it when the prospect names a later day." },
      days: { type: "integer", description: "How many days to search (default 4)" },
    },
  },
};

const bookShowingTool: Tool = {
  name: "book_showing",
  description:
    "Book a showing on the leasing calendar. Only call after the prospect has picked a specific slot and given their name and a phone number. Sends SMS confirmation and a reminder automatically.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      phone: { type: "string" },
      email: { type: "string" },
      unit_id: { type: "string", description: "Unit id from search_units, e.g. BDM-104" },
      start_iso: { type: "string", description: "Exact start_iso from get_showing_slots" },
      notes: { type: "string", description: "Anything the leasing agent should know (pets, partner attending, questions)" },
    },
    required: ["name", "phone", "unit_id", "start_iso"],
  },
};

const updateLead: Tool = {
  name: "update_lead",
  description:
    "Save what you have learned about the prospect to the CRM as soon as you learn it (contact details, bedrooms, budget, move-in date, occupants, pets, monthly household income). Call it whenever new details come up; partial updates are fine.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      phone: { type: "string" },
      email: { type: "string" },
      bedrooms: { type: "integer", enum: [1, 2] },
      budget: { type: "number", description: "Max monthly rent the prospect mentioned" },
      move_in_date: { type: "string", description: "YYYY-MM-DD" },
      occupants: { type: "integer" },
      pets: { type: "string", description: "e.g. '1 cat', 'small dog', 'none'" },
      income_monthly: { type: "number", description: "Gross monthly household income, only if the prospect volunteers it or agrees to share" },
      unit_interest: { type: "string", description: "Unit id, e.g. BDM-302" },
      summary: { type: "string", description: "One-line status for the leasing team" },
    },
  },
};

const verifyTenant: Tool = {
  name: "verify_tenant",
  description: "Check that a person is the tenant on file for a suite before opening a work order. Pass the suite number and the name they gave.",
  input_schema: {
    type: "object",
    properties: {
      unit_number: { type: "string", description: "Suite number, e.g. 205" },
      name: { type: "string" },
    },
    required: ["unit_number", "name"],
  },
};

const createWorkOrderTool: Tool = {
  name: "create_work_order",
  description:
    "Open a maintenance work order and book it straight into the right crew's calendar. Emergencies dispatch the on-call crew immediately; urgent within 24h; routine within 3 business days. Returns the booked time to tell the tenant.",
  input_schema: {
    type: "object",
    properties: {
      unit_number: { type: "string" },
      tenant_name: { type: "string" },
      phone: { type: "string" },
      category: { type: "string", enum: ["Plumbing", "Heating", "Electrical", "Appliance", "Doors & locks", "Pests", "Windows", "General"] },
      issue: { type: "string", description: "Short description in plain words, e.g. 'Kitchen sink leaking under cabinet'" },
      urgency: { type: "string", enum: ["emergency", "urgent", "routine"] },
      permission_to_enter: { type: "boolean", description: "May the crew enter if nobody is home?" },
    },
    required: ["unit_number", "tenant_name", "category", "issue", "urgency", "permission_to_enter"],
  },
};

const escalateTool: Tool = {
  name: "escalate_to_human",
  description:
    "Hand the conversation to the Triple Harbour team: legal or lease-dispute questions, rent negotiations, complaints, accessibility accommodation requests, anything you are unsure of, or when the person asks for a human.",
  input_schema: {
    type: "object",
    properties: {
      reason: { type: "string" },
      urgency: { type: "string", enum: ["normal", "high"] },
    },
    required: ["reason", "urgency"],
  },
};

const updateInvestor: Tool = {
  name: "update_investor",
  description: "Save what you learn about a prospective investor (name, email, phone, whether they are accredited, the amount they mentioned, and a one-line summary of what they asked). Call it whenever new details come up.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      accredited: { type: "string", enum: ["yes", "no", "unsure"] },
      amount: { type: "string", description: "In their words, e.g. 'around $100k'" },
      interest: { type: "string", description: "One line for Rodrigo: what they want to know" },
    },
  },
};

const getCallTimes: Tool = {
  name: "get_intro_call_times",
  description: "Open 30-minute intro call times on Rodrigo Parada's (CEO) calendar, Edmonton time. Offer two in a sentence; pass start_iso back unchanged when booking.",
  input_schema: { type: "object", properties: {} },
};

const bookIntroCall: Tool = {
  name: "book_intro_call",
  description: "Book a 30-minute intro call with Rodrigo. Needs the chosen start_iso, their name and email. Sends a calendar invite.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      start_iso: { type: "string" },
    },
    required: ["name", "email", "start_iso"],
  },
};

export function toolsFor(persona: Persona): Tool[] {
  if (persona === "investor") return [updateInvestor, getCallTimes, bookIntroCall, escalateTool];
  return persona === "prospect"
    ? [searchUnits, getShowingSlots, bookShowingTool, updateLead, escalateTool]
    : [verifyTenant, createWorkOrderTool, escalateTool];
}

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : undefined);

function dateToIso(v: unknown): string | undefined {
  const s = str(v);
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? zoned(+m[1], +m[2], +m[3], 0).toISOString() : undefined;
}

export interface ToolRun {
  content: string;
  isError: boolean;
  action: ToolAction;
}

export function runTool(sess: Session, name: string, input: Input): ToolRun {
  const ok = (data: unknown, label: string, detail?: string): ToolRun => ({ content: JSON.stringify(data), isError: false, action: { tool: name, label, ok: true, detail } });
  const fail = (error: string, label: string): ToolRun => ({ content: JSON.stringify({ error }), isError: true, action: { tool: name, label, ok: false, detail: error } });

  switch (name) {
    case "search_units": {
      const beds = num(input.bedrooms);
      const max = num(input.max_rent);
      const units = db()
        .units.filter((u) => u.status !== "leased")
        .filter((u) => !beds || u.beds === beds)
        .filter((u) => !max || u.rent <= max);
      const data = units.map((u) => ({
        unit_id: u.id,
        suite: `#${u.number}`,
        bedrooms: u.beds,
        sqft: u.sqft,
        rent: u.rent,
        status: u.status === "vacant" ? "vacant, ready now" : "renovation finishing",
        available_from: u.availableFrom && new Date(u.availableFrom).getTime() > Date.now() ? monthDay(u.availableFrom) : "now",
        features: u.features,
      }));
      return ok({ units: data, note: data.length ? undefined : "Nothing matches. Offer the waitlist or the closest alternative." }, "Checked live availability", `${data.length} suite(s) match`);
    }
    case "get_showing_slots": {
      const from = num(input.days_from_today) ?? 0;
      const days = Math.min(7, num(input.days) ?? 4);
      const slots = showingSlots({ fromDays: from, days, perDay: 3 }).slice(0, 9);
      return ok({ timezone: "America/Edmonton", slots: slots.map((s) => ({ start_iso: s.start, label: friendlyWhen(s.start), full_date: longWhen(s.start) })) }, "Read leasing calendar", `${slots.length} open slots`);
    }
    case "book_showing": {
      const name = str(input.name);
      const phone = str(input.phone);
      const unitId = str(input.unit_id);
      const start = str(input.start_iso);
      if (!name || !phone || !unitId || !start) return fail("name, phone, unit_id and start_iso are all required", "Booking failed");
      const r = bookShowing(sess, { name, phone, email: str(input.email), unitId, start, notes: str(input.notes) });
      if (!r.ok) return fail(r.error, "Slot unavailable");
      return ok(
        { booked: true, when: longWhen(r.event.start), suite: `#${r.unit.number}`, address: "9107 88 Ave NW, Edmonton", confirmation_sms_to: phone, reminder: "2 hours before" },
        "Booked showing on leasing calendar",
        `${fmtDateTime(r.event.start)} · #${r.unit.number}`,
      );
    }
    case "update_lead": {
      const lead = upsertLeadForSession(sess, {
        name: str(input.name),
        phone: str(input.phone),
        email: str(input.email),
        bedrooms: num(input.bedrooms),
        budget: num(input.budget),
        moveIn: dateToIso(input.move_in_date),
        occupants: num(input.occupants),
        pets: str(input.pets),
        incomeMonthly: num(input.income_monthly),
        unitInterest: str(input.unit_interest),
        summary: str(input.summary),
      });
      return ok({ saved: true, lead_id: lead.id, stage: lead.stage, score: lead.score }, "Updated CRM lead", `${lead.id} · score ${lead.score}`);
    }
    case "verify_tenant": {
      const n = str(input.unit_number)?.replace(/\D/g, "");
      const name = str(input.name) ?? "";
      const unit = db().units.find((u) => u.number === n);
      if (!unit) return fail(`No suite ${n} in this building`, "Tenant not found");
      if (!unit.tenant) return ok({ verified: false, reason: "Suite is currently vacant" }, "Verified tenant", "suite vacant");
      const last = unit.tenant.split(" ").pop()!.toLowerCase();
      const verified = name.toLowerCase().includes(last);
      // Demo: accept unknown names too, but flag them for the team.
      return ok(
        { verified: true, matched_on_file: verified, suite: unit.number, note: verified ? undefined : "Name does not match the lease holder; proceed (occupant or guest) and mention it in the issue." },
        "Verified tenant",
        `#${unit.number}${verified ? " · match" : " · occupant (flagged)"}`,
      );
    }
    case "create_work_order": {
      const urgency = str(input.urgency) as Urgency | undefined;
      const unit = str(input.unit_number);
      const tenant = str(input.tenant_name);
      const issue = str(input.issue);
      if (!unit || !tenant || !issue || !urgency || !["emergency", "urgent", "routine"].includes(urgency)) return fail("unit_number, tenant_name, issue and a valid urgency are required", "Work order failed");
      const r = createWorkOrder(sess, {
        unitId: unit,
        tenant,
        phone: str(input.phone),
        category: str(input.category) ?? "General",
        issue,
        urgency,
        permissionToEnter: input.permission_to_enter === true,
        channel: sess.channel,
      });
      if (!r.ok) return fail(r.error, "Work order failed");
      return ok(
        { work_order: r.workOrder.id, crew: r.crewName, scheduled_for: friendlyWhen(r.event.start), arrival_iso: r.event.start, urgency, tenant_notified_by_sms: true },
        `Opened ${r.workOrder.id} and booked crew`,
        `${r.crewName} · ${fmtDateTime(r.event.start)}`,
      );
    }
    case "update_investor": {
      const acc = str(input.accredited);
      const inv = upsertInvestorForSession(sess, {
        name: str(input.name),
        email: str(input.email),
        phone: str(input.phone),
        accredited: acc === "yes" || acc === "no" || acc === "unsure" ? acc : undefined,
        amount: str(input.amount),
        interest: str(input.interest),
      });
      return ok({ saved: true, investor_id: inv.id }, "Updated investor pipeline", inv.id);
    }
    case "get_intro_call_times": {
      const slots = investorCallSlots(4);
      return ok({ timezone: "America/Edmonton", slots: slots.map((s) => ({ start_iso: s.start, label: friendlyWhen(s.start), full_date: longWhen(s.start) })) }, "Read Rodrigo's calendar", `${slots.length} open times`);
    }
    case "book_intro_call": {
      const name = str(input.name);
      const email = str(input.email);
      const start = str(input.start_iso);
      if (!name || !email || !start) return fail("name, email and start_iso are required", "Booking failed");
      const r = bookInvestorCall(sess, { name, email, phone: str(input.phone), start });
      if (!r.ok) return fail(r.error, "Time unavailable");
      return ok({ booked: true, when: longWhen(r.event.start), with: "Rodrigo Parada, CEO", invite_sent_to: email }, "Booked intro call with Rodrigo", fmtDateTime(r.event.start));
    }
    case "escalate_to_human": {
      const reason = str(input.reason) ?? "Requested by person";
      escalate(sess, reason, input.urgency === "high" ? "high" : "normal");
      return ok({ escalated: true, expected_response: input.urgency === "high" ? "within 15 minutes" : "next business morning" }, "Escalated to team", reason);
    }
    default:
      return fail(`Unknown tool ${name}`, "Unknown tool");
  }
}
