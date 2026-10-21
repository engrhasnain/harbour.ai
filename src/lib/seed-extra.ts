// Seed data for the team inbox and the investor pipeline. Names and messages are illustrative.
import type { CalEvent, Email, InvestorLead, Lead, WorkOrder } from "./types";
import { addDays, fmtDateTime, local, longWhen, zoned } from "./time";
import { reportingMonth, reportingQuarterLabel } from "./periods";

const ago = (now: Date, hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString();

function nextWeekday(now: Date, offset: number, hour: number, min = 0) {
  const t = local(now);
  let n = offset;
  let d = addDays(t.y, t.m, t.d, n);
  while (d.dow === 0 || d.dow === 6) d = addDays(t.y, t.m, t.d, ++n);
  return zoned(d.y, d.m, d.d, hour, min);
}

export function seedInvestors(now: Date, events: CalEvent[]): InvestorLead[] {
  const rows: (Omit<InvestorLead, "id" | "lastActivity"> & { callAt?: Date })[] = [
    {
      createdAt: ago(now, 5),
      name: "Daniel Wu",
      email: "daniel.wu@example.com",
      phone: "403-555-0182",
      accredited: "yes",
      amount: "around $150k",
      interest: "Asked how the refinance returns capital and whether the fund is RRSP-eligible.",
      stage: "call_booked",
      source: "Website",
      callAt: nextWeekday(now, 1, 14),
    },
    {
      createdAt: ago(now, 26),
      name: "Sandra Okafor",
      email: "sandra.okafor@example.com",
      accredited: "unsure",
      amount: "$50k–$75k",
      interest: "Wanted to know the hold period and whether she qualifies as accredited.",
      stage: "new",
      source: "LinkedIn",
    },
    {
      createdAt: ago(now, 50),
      name: "Martin Lévesque",
      email: "m.levesque@example.com",
      phone: "514-555-0144",
      accredited: "yes",
      amount: "$250k",
      interest: "Quebec investor asking about the Alexo & Phoenix results and the next acquisition.",
      stage: "docs_sent",
      source: "Referral",
    },
    {
      createdAt: ago(now, 75),
      name: "Grace Kim",
      email: "grace.kim@example.com",
      accredited: "yes",
      amount: "$100k",
      interest: "Asked about distributions and the preferred return.",
      stage: "call_booked",
      source: "Website",
      callAt: nextWeekday(now, 2, 10, 30),
    },
  ];
  let eid = 650;
  return rows.map((r, i) => {
    const { callAt, ...rest } = r;
    const inv: InvestorLead = { ...rest, id: `INV-${301 + i}`, lastActivity: rest.createdAt };
    if (callAt) {
      const ev: CalEvent = {
        id: `E-${eid++}`,
        resource: "rodrigo",
        start: callAt.toISOString(),
        end: new Date(callAt.getTime() + 30 * 60000).toISOString(),
        title: `Investor intro call: ${inv.name}`,
        kind: "investor_call",
        propertyId: "fund",
        createdBy: "ai",
        notes: `${inv.amount ?? ""} · accredited: ${inv.accredited ?? "unknown"}`,
      };
      events.push(ev);
      inv.callEventId = ev.id;
    }
    return inv;
  });
}

export function seedEmails(now: Date, leads: Lead[], workOrders: WorkOrder[], investors: InvestorLead[], events: CalEvent[]): Email[] {
  const out: Email[] = [];
  let n = 100;
  const mail = (e: Omit<Email, "id" | "unread"> & { unread?: boolean }) => out.push({ unread: false, ...e, id: `M-${n++}` });

  // Listing-site inquiries answered by email.
  const inquiry = leads.filter((l) => ["rentals.ca", "kijiji", "facebook"].includes(l.channel)).slice(0, 4);
  const asks = [
    "Hi, is the 2 bedroom still available? Is parking included and are cats ok?",
    "Hello, I'm interested in the 1 bedroom. When could I come see it?",
    "Is the rent negotiable? And how close is it to the LRT?",
    "Hi there, is heat included? Looking to move for December 1.",
  ];
  const replies = [
    "Hi! Yes, the 2 bedroom is still available. It's $1,465 a month with heat and water included, and each suite can have an assigned stall with a plug-in. Cats are welcome too.\n\nI have tomorrow at 6:30pm or Saturday at 11am open for a viewing. Would either of those work?\n\nBonnie Doon Manor Leasing",
    "Hi! The 1 bedroom is $1,300 a month, heat and water included, and it's ready now. I can show it to you tomorrow at 10am or Thursday at 5:30pm. Which works better?\n\nBonnie Doon Manor Leasing",
    "Hi! I'm not able to change the rent myself, but I've passed your question to our leasing manager. The Bonnie Doon LRT stop is about a 10-minute walk.\n\nWould you like to see the suite in the meantime?\n\nBonnie Doon Manor Leasing",
    "Hi! Yes, heat and water are both included. December 1 works well for the 1 bedroom. Would you like to come take a look this week?\n\nBonnie Doon Manor Leasing",
  ];
  const site: Record<string, string> = { "rentals.ca": "Rentals.ca", kijiji: "Kijiji", facebook: "Facebook Marketplace" };
  inquiry.forEach((l, i) => {
    const thread = `T-${l.id}`;
    const subj = `${site[l.channel]}: inquiry about Bonnie Doon Manor`;
    mail({ threadId: thread, folder: "inquiries", from: l.name ?? "Renter", fromEmail: l.email ?? "renter@example.com", to: "leasing@tripleharbour.com", subject: subj, body: asks[i], ts: l.createdAt, leadId: l.id });
    mail({
      threadId: thread,
      folder: "inquiries",
      from: "Bonnie Doon Manor Leasing",
      fromEmail: "leasing@tripleharbour.com",
      to: l.email ?? "",
      subject: `Re: ${subj}`,
      body: replies[i],
      ts: new Date(new Date(l.createdAt).getTime() + l.firstResponseSec * 1000).toISOString(),
      byAssistant: true,
      leadId: l.id,
    });
  });

  // Team alerts.
  for (const l of leads.filter((x) => x.stage === "showing_booked")) {
    const ev = events.find((e) => e.id === l.showingEventId);
    if (!ev) continue;
    mail({
      threadId: `A-${l.id}`,
      folder: "alerts",
      from: "Bonnie Doon Manor Assistant",
      fromEmail: "assistant@tripleharbour.com",
      to: "leasing@tripleharbour.com",
      subject: `Viewing booked: ${l.name}, ${fmtDateTime(ev.start)}`,
      body: `${l.name} booked a viewing of suite #${ev.unitId?.slice(4)} for ${longWhen(ev.start)}.\n\nPhone: ${l.phone}\nMove-in: Nov 15 · ${l.occupants} occupant(s) · pets: ${l.pets}\n\nIt's on the leasing calendar and they've had a text confirmation.`,
      ts: new Date(new Date(l.createdAt).getTime() + 6 * 60000).toISOString(),
      leadId: l.id,
      link: { label: "Open lead", href: `/leads?open=${l.id}` },
    });
  }
  const done = workOrders.find((w) => w.urgency === "emergency");
  if (done) {
    mail({
      threadId: `A-${done.id}`,
      folder: "alerts",
      from: "Bonnie Doon Manor Assistant",
      fromEmail: "assistant@tripleharbour.com",
      to: "maintenance@tripleharbour.com",
      subject: `Emergency handled overnight: #${done.unitId.slice(4)} ${done.issue.toLowerCase()}`,
      body: `${done.tenant} reported "${done.issue}" at ${fmtDateTime(done.createdAt)}.\n\nThe on-call crew was dispatched right away and the work order ${done.id} is now completed. No action needed.`,
      ts: done.createdAt,
      link: { label: "Open work order", href: `/maintenance?open=${done.id}` },
    });
  }

  // Reports.
  const t = local(now);
  mail({
    threadId: "R-property",
    folder: "reports",
    from: "Harbour Reports",
    fromEmail: "reports@tripleharbour.com",
    to: "alvaro@tripleharbour.com",
    subject: `Bonnie Doon Manor: ${reportingMonth(now)} property report`,
    body: `Hi Alvaro,\n\nThe ${reportingMonth(now)} report for Bonnie Doon Manor is attached: occupancy, collections, NOI, leasing and maintenance, with commentary.\n\nReply "approve" and it goes to the lender and the partners.\n\nHarbour Reports`,
    ts: zoned(t.y, t.m, 1, 6).toISOString(),
    attachment: { name: `Bonnie-Doon-Manor-${reportingMonth(now).replace(" ", "-")}.pdf`, href: "/reports/property" },
  });
  mail({
    threadId: "R-lp",
    folder: "reports",
    from: "Harbour Reports",
    fromEmail: "reports@tripleharbour.com",
    to: "alvaro@tripleharbour.com",
    subject: `${reportingQuarterLabel(now)} LP update draft ready for compliance review`,
    body: `Hi Alvaro,\n\nThe ${reportingQuarterLabel(now)} investor update for THC Value-Add 1 LP is drafted from the fund and property data. Every number in the letter comes from the attached tables.\n\nOnce compliance signs off, it can be sent to all limited partners.\n\nHarbour Reports`,
    ts: zoned(t.y, t.m, 1, 6, 5).toISOString(),
    attachment: { name: `THC-Value-Add-1-LP-${reportingQuarterLabel(now).replace(" ", "-")}.pdf`, href: "/reports/lp" },
  });

  // Investor inquiries.
  for (const inv of investors.filter((i) => i.stage === "call_booked")) {
    const ev = events.find((e) => e.id === inv.callEventId);
    mail({
      threadId: `I-${inv.id}`,
      folder: "investors",
      from: "Harbour Investor Desk",
      fromEmail: "assistant@tripleharbour.com",
      to: "rodrigo@tripleharbour.com",
      subject: `Intro call booked: ${inv.name}${ev ? `, ${fmtDateTime(ev.start)}` : ""}`,
      body: `${inv.name} (${inv.source}) asked about the fund and booked a 30-minute intro call with you.\n\nWhat they asked: ${inv.interest}\nAmount mentioned: ${inv.amount ?? "not shared"}\nAccredited: ${inv.accredited ?? "not asked"}\nEmail: ${inv.email}\n\nThe call is on your calendar.`,
      ts: inv.createdAt,
      link: { label: "Open investor pipeline", href: "/investors" },
    });
  }

  return out.sort((a, b) => b.ts.localeCompare(a.ts)).map((m, i) => ({ ...m, unread: i < 3 }));
}
