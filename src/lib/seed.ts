import type { Activity, CalEvent, Channel, Lead, LeadStage, Property, Unit, WorkOrder } from "./types";
import { addDays, isAfterHours, local, zoned } from "./time";

// Deterministic PRNG so every reset produces the same demo world.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const PROPERTIES: Property[] = [
  {
    id: "bonnie-doon",
    name: "Bonnie Doon Manor",
    address: "9107 88 Ave NW",
    city: "Edmonton",
    status: "operating",
    unitCount: 20,
    summary: "20-suite concrete low-rise. Filled to 18 of 20 in a soft Edmonton market.",
    source: "Zenthic outreach + public listings",
  },
  {
    id: "mountain-manor",
    name: "Mountain Manor",
    address: "Alberta",
    city: "Alberta",
    status: "refinancing",
    acquisitionPrice: 1_170_000,
    appraisedValue: 1_800_000,
    summary: "Acquired at $1.17M, appraised at $1.8M. Refinance underway to return investor capital.",
    source: "tripleharbour.com",
  },
  {
    id: "alexo-phoenix",
    name: "Alexo & Phoenix",
    address: "Portfolio",
    city: "Alberta",
    status: "realized",
    acquisitionPrice: 1_900_000,
    appraisedValue: 5_600_000,
    summary: "Bought as a portfolio for $1.9M. Occupancy up, suites renovated, utilities optimized; appraised at $5.6M within 12 months.",
    source: "tripleharbour.com",
  },
];

const TENANTS = [
  "M. Tremblay", "J. Okafor", "S. Nguyen", "R. Gill", "A. Kowalski", "L. Fontaine", "D. Mensah", "K. Arsenault",
  "P. Sharma", "C. Lavoie", "T. Haddad", "E. Morin", "B. Castillo", "N. Petrov", "H. Yamamoto", "G. Bouchard",
  "F. Abdi", "V. Santos",
];

export function seedUnits(now: Date): Unit[] {
  const units: Unit[] = [];
  const layout: { n: string; floor: number; beds: 1 | 2 }[] = [];
  for (const [floor, count] of [[1, 7], [2, 7], [3, 6]] as const) {
    for (let i = 1; i <= count; i++) {
      const n = `${floor}0${i}`;
      const beds: 1 | 2 = i === 2 || i === 5 || (i === 7 && floor !== 3) || (floor === 3 && i === 6) ? 2 : 1;
      layout.push({ n, floor, beds });
    }
  }
  const today = local(now);
  let t = 0;
  for (const u of layout) {
    const id = `BDM-${u.n}`;
    const rent = u.beds === 2 ? 1465 : u.floor === 3 ? 1350 : u.floor === 2 ? 1325 : 1300;
    const base: Unit = {
      id,
      propertyId: "bonnie-doon",
      number: u.n,
      beds: u.beds,
      baths: 1,
      sqft: u.beds === 2 ? 820 : 610,
      rent,
      status: "leased",
      floor: u.floor,
      features: ["Renovated kitchen", "Plank flooring", "Balcony", "Heat & water included"],
    };
    if (id === "BDM-104") {
      const d = addDays(today.y, today.m, today.d, 0);
      units.push({ ...base, rent: 1300, status: "vacant", availableFrom: zoned(d.y, d.m, d.d, 0).toISOString(), features: [...base.features, "Main floor"] });
    } else if (id === "BDM-302") {
      units.push({ ...base, status: "turnover", availableFrom: zoned(2026, 11, 15, 0).toISOString(), features: [...base.features, "Top floor", "Renovation finishing"] });
    } else {
      const end = addDays(2027, 1, 31, Math.floor(t * 23) % 300);
      units.push({ ...base, tenant: TENANTS[t % TENANTS.length], tenantPhone: `780-555-01${(10 + t).toString().padStart(2, "0")}`, leaseEnd: zoned(end.y, end.m, end.d, 0).toISOString() });
      t++;
    }
  }
  return units;
}

const FIRST = ["Priya", "Marc", "Aisha", "Daniel", "Sofia", "Ethan", "Mei", "Olivier", "Fatima", "Jordan", "Chloé", "Samuel", "Amara", "Lucas", "Hana", "Tyler", "Noor", "Gabriel", "Isabelle", "Kwame", "Valeria", "Ryan"];
const LAST = ["Patel", "Gagnon", "Mohamed", "Chen", "Ramirez", "Wilson", "Lin", "Roy", "Hassan", "Clarke", "Bélanger", "Osei", "Kaur", "Martin", "Kim", "Brooks", "Ali", "Côté", "Dubois", "Mensah", "Torres", "Fraser"];

export function seedLeads(now: Date): Lead[] {
  const r = rng(42);
  const stages: LeadStage[] = [
    "new", "new", "new", "new", "qualified", "qualified", "qualified", "qualified", "qualified",
    "showing_booked", "showing_booked", "showing_booked", "showing_done", "showing_done", "showing_done", "showing_done",
    "applied", "applied", "applied", "leased", "leased", "lost", "lost", "lost",
  ];
  const channels: Channel[] = ["rentals.ca", "rentals.ca", "kijiji", "facebook", "website", "phone", "rentals.ca", "kijiji", "phone", "facebook"];
  const leads: Lead[] = stages.map((stage, i) => {
    const ageDays = stage === "new" ? r() * 1.5 : stage === "leased" || stage === "lost" ? 6 + r() * 7 : 0.5 + r() * 9;
    let created = new Date(now.getTime() - ageDays * 86400_000);
    // Bias ~40% of inquiries to after-hours, which is where an always-on layer earns its keep.
    {
      const p = local(created);
      const evening = r() < 0.22;
      created = zoned(p.y, p.m, p.d, evening ? 19 + Math.floor(r() * 5) : 9 + Math.floor(r() * 8), Math.floor(r() * 60));
      if (created > now) created = new Date(now.getTime() - 3600_000 * (2 + r() * 6));
    }
    const beds = r() < 0.6 ? 1 : 2;
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
    const scoreByStage: Record<LeadStage, number> = { new: 35, qualified: 62, showing_booked: 78, showing_done: 82, applied: 90, leased: 100, lost: 20 };
    const iso = created.toISOString();
    return {
      id: `L-${(1040 + i).toString()}`,
      createdAt: iso,
      channel: channels[Math.floor(r() * channels.length)],
      name,
      phone: `780-555-${(2000 + Math.floor(r() * 7999)).toString()}`,
      email: `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@example.com`,
      bedrooms: beds,
      budget: beds === 2 ? 1500 : 1350,
      moveIn: zoned(2026, beds === 2 ? 11 : 12, beds === 2 ? 15 : 1, 0).toISOString(),
      occupants: beds === 2 ? 2 : 1,
      pets: r() < 0.35 ? (r() < 0.5 ? "1 cat" : "small dog") : "none",
      incomeMonthly: Math.round((3400 + r() * 2600) / 50) * 50,
      unitInterest: beds === 2 ? "BDM-302" : "BDM-104",
      stage,
      score: Math.min(100, scoreByStage[stage] + Math.floor(r() * 8)),
      summary: "",
      afterHours: isAfterHours(iso),
      firstResponseSec: 4 + Math.floor(r() * 14),
      lastActivity: new Date(created.getTime() + 3600_000 * (1 + r() * 20)).toISOString(),
    };
  });
  const lostReasons = ["Chose a building closer to work. AI logged the reason.", "Budget below current rents. AI added them to the waitlist.", "Stopped replying after two AI follow-ups."];
  return leads.map((l, i) => {
    const suite = `#${l.unitInterest?.slice(4)}`;
    const moveIn = l.moveIn ? new Date(l.moveIn).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Edmonton" }) : "";
    const meets = (l.incomeMonthly ?? 0) >= (l.bedrooms === 2 ? 1465 : 1300) * 2.5;
    const summary: Record<LeadStage, string> = {
      new: l.pets !== "none" ? `Asked if their ${l.pets} is OK; AI answered the pet policy and offered viewing times.` : "Asked about parking and plug-ins; AI answered and offered viewing times.",
      qualified: `Qualified: ${l.occupants} occupant${l.occupants === 1 ? "" : "s"}, ${l.bedrooms}-bed, move-in ${moveIn}. ${meets ? "Income meets guideline." : "Income below 2.5x, flagged for team review."}`,
      showing_booked: `Showing booked by AI for ${suite}. SMS confirmation + reminder sent.`,
      showing_done: `Viewed ${suite}. AI sent the application link 2h after the showing.`,
      applied: `Applied for ${suite} after AI follow-up. Credit check pending team review.`,
      leased: `Signed a 12-month lease${l.afterHours ? "; first inquiry came in after hours" : ""}.`,
      lost: lostReasons[i % lostReasons.length],
    };
    return { ...l, summary: summary[l.stage], lastActivity: new Date(l.lastActivity) > now ? now.toISOString() : l.lastActivity };
  });
}

function nextWeekday(now: Date, offset: number) {
  const t = local(now);
  let n = offset;
  let d = addDays(t.y, t.m, t.d, n);
  while (d.dow === 0) d = addDays(t.y, t.m, t.d, ++n);
  return d;
}

export function seedCalendar(now: Date, leads: Lead[]): { events: CalEvent[]; workOrders: WorkOrder[]; leads: Lead[] } {
  const events: CalEvent[] = [];
  const workOrders: WorkOrder[] = [];
  let eid = 500;
  const ev = (e: Omit<CalEvent, "id">) => {
    const full = { ...e, id: `E-${eid++}` };
    events.push(full);
    return full;
  };

  // Showings for the leads already booked.
  const booked = leads.filter((l) => l.stage === "showing_booked");
  const showingSlots = [[1, 17, 30], [2, 12, 0], [3, 10, 30]];
  booked.forEach((l, i) => {
    const [off, h, m] = showingSlots[i % showingSlots.length];
    const d = nextWeekday(now, off);
    const start = zoned(d.y, d.m, d.d, h, m);
    const e = ev({
      resource: "leasing",
      start: start.toISOString(),
      end: new Date(start.getTime() + 30 * 60000).toISOString(),
      title: `Showing #${l.unitInterest?.slice(4)}: ${l.name}`,
      kind: "showing",
      propertyId: "bonnie-doon",
      unitId: l.unitInterest,
      leadId: l.id,
      createdBy: "ai",
    });
    l.showingEventId = e.id;
  });

  // Turnover of #302 on Crew B for the next three weekdays.
  for (let i = 0; i < 3; i++) {
    const d = nextWeekday(now, i + (local(now).h >= 16 ? 1 : 0));
    if (d.dow === 6) continue;
    ev({
      resource: "crew-b",
      start: zoned(d.y, d.m, d.d, 8).toISOString(),
      end: zoned(d.y, d.m, d.d, 16).toISOString(),
      title: `#302 turnover: ${["flooring + paint", "kitchen install", "final clean + punch list"][i]}`,
      kind: "turnover",
      propertyId: "bonnie-doon",
      unitId: "BDM-302",
      createdBy: "staff",
    });
  }

  const wos: Array<Omit<WorkOrder, "id" | "createdAt" | "eventId" | "scheduledFor"> & { dayOff: number; hour: number; ageH: number }> = [
    { propertyId: "bonnie-doon", unitId: "BDM-205", tenant: "T. Haddad", category: "Plumbing", issue: "Kitchen tap dripping constantly", urgency: "routine", status: "scheduled", resource: "crew-a", permissionToEnter: true, channel: "tenant-portal", createdBy: "ai", dayOff: 1, hour: 9, ageH: 20 },
    { propertyId: "bonnie-doon", unitId: "BDM-107", tenant: "L. Fontaine", category: "Appliance", issue: "Fridge not cooling, freezer fine", urgency: "urgent", status: "scheduled", resource: "crew-a", permissionToEnter: true, channel: "sms", createdBy: "ai", dayOff: 1, hour: 11, ageH: 9 },
    { propertyId: "bonnie-doon", unitId: "BDM-303", tenant: "H. Yamamoto", category: "Doors & locks", issue: "Balcony door hard to latch", urgency: "routine", status: "scheduled", resource: "crew-a", permissionToEnter: false, channel: "phone", createdBy: "ai", dayOff: 2, hour: 13, ageH: 30 },
    { propertyId: "bonnie-doon", unitId: "BDM-201", tenant: "D. Mensah", category: "Heating", issue: "Bedroom radiator cold overnight", urgency: "emergency", status: "completed", resource: "crew-a", permissionToEnter: true, channel: "phone", createdBy: "ai", dayOff: -1, hour: 7, ageH: 26 },
  ];
  wos.forEach((w, i) => {
    const { dayOff, hour, ageH, ...rest } = w;
    const t = local(now);
    const d = dayOff < 0 ? addDays(t.y, t.m, t.d, dayOff) : nextWeekday(now, dayOff);
    const start = zoned(d.y, d.m, d.d, hour);
    const id = `WO-${2210 + i}`;
    const e = ev({
      resource: rest.resource,
      start: start.toISOString(),
      end: new Date(start.getTime() + 2 * 3600_000).toISOString(),
      title: `${rest.category} #${rest.unitId.slice(4)}: ${rest.issue}`,
      kind: "work_order",
      propertyId: rest.propertyId,
      unitId: rest.unitId,
      workOrderId: id,
      createdBy: "ai",
    });
    workOrders.push({ ...rest, id, createdAt: new Date(now.getTime() - ageH * 3600_000).toISOString(), eventId: e.id, scheduledFor: e.start });
  });

  // Month-end inspection (staff).
  const d = nextWeekday(now, 4);
  ev({ resource: "crew-a", start: zoned(d.y, d.m, d.d, 14).toISOString(), end: zoned(d.y, d.m, d.d, 16).toISOString(), title: "Common-area & fire safety walk", kind: "inspection", propertyId: "bonnie-doon", createdBy: "staff" });

  return { events, workOrders, leads };
}

export function seedActivity(now: Date, leads: Lead[], workOrders: WorkOrder[]): Activity[] {
  const acts: Activity[] = [];
  let n = 9000;
  const add = (a: Omit<Activity, "id">) => acts.push({ ...a, id: `A-${n++}` });
  for (const l of leads) {
    add({ ts: l.createdAt, workflow: "inquiry-to-showing", actor: "ai", title: `Answered ${l.channel} inquiry from ${l.name} in ${l.firstResponseSec}s`, detail: l.afterHours ? "After hours: no staff online" : undefined, ref: { type: "lead", id: l.id } });
    if (["showing_booked", "showing_done", "applied", "leased"].includes(l.stage)) {
      add({ ts: new Date(new Date(l.createdAt).getTime() + 6 * 60000).toISOString(), workflow: "inquiry-to-showing", actor: "ai", title: `Booked showing for ${l.name} (#${l.unitInterest?.slice(4)})`, detail: "Added to leasing calendar, SMS confirmation sent", ref: { type: "lead", id: l.id } });
    }
    if (l.stage === "applied" || l.stage === "leased") {
      add({ ts: l.lastActivity, workflow: "inquiry-to-showing", actor: "ai", title: `Sent application link to ${l.name} after showing`, ref: { type: "lead", id: l.id } });
    }
  }
  for (const w of workOrders) {
    add({ ts: w.createdAt, workflow: "maintenance-dispatch", actor: "ai", title: `Triaged ${w.urgency} ${w.category.toLowerCase()} request from #${w.unitId.slice(4)}`, detail: `Booked ${w.resource === "crew-a" ? "Crew A" : w.resource}; tenant notified with ETA`, ref: { type: "workorder", id: w.id } });
  }
  add({ ts: new Date(now.getTime() - 3.2 * 3600_000).toISOString(), workflow: "missed-call", actor: "ai", title: "Missed call at 10:14 PM → text-back sent in 22s", detail: "Caller asked about 2-bed; converted to SMS conversation" });
  const t = local(now);
  add({ ts: zoned(t.y, t.m, 1, 6).toISOString(), workflow: "property-report", actor: "system", title: "Drafted monthly property report: Bonnie Doon Manor", detail: "Rent roll, arrears, work orders, leasing pipeline. Sent to COO for review.", ref: { type: "report", id: "property" } });
  add({ ts: zoned(t.y, t.m, 1, 6, 5).toISOString(), workflow: "lp-report", actor: "system", title: "Q3 LP update drafted for THC Value-Add 1 LP", detail: "Awaiting EMD compliance review before distribution", ref: { type: "report", id: "lp" } });
  return acts.sort((a, b) => b.ts.localeCompare(a.ts));
}
