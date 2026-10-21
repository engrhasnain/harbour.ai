import { COMPANY } from "./kb";
import { db, kpis } from "./store";
import { local } from "./time";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function reportingMonth() {
  const t = local(new Date());
  const m = t.m === 1 ? 12 : t.m - 1;
  const y = t.m === 1 ? t.y - 1 : t.y;
  return { label: `${MONTHS[m - 1]} ${y}`, m, y };
}

export function reportingQuarter() {
  const t = local(new Date());
  const q = Math.floor((t.m - 1) / 3); // current quarter index; report the one just closed
  const prev = q === 0 ? 4 : q;
  const y = q === 0 ? t.y - 1 : t.y;
  const months = MONTHS.slice((prev - 1) * 3, prev * 3);
  return { label: `Q${prev} ${y}`, range: `${months[0]} – ${months[2]} ${y}` };
}

export function propertyReport() {
  const s = db();
  const units = s.units.filter((u) => u.propertyId === "bonnie-doon");
  const gpr = units.reduce((a, u) => a + u.rent, 0);
  const vacant = units.filter((u) => u.status !== "leased");
  const vacancyLoss = vacant.reduce((a, u) => a + u.rent, 0);
  const arrears = 675; // one tenant on a payment plan (illustrative)
  const laundry = 310;
  const collected = gpr - vacancyLoss - arrears + laundry;
  const opex = [
    { line: "Utilities (heat & water)", amount: 2850 },
    { line: "Repairs & maintenance", amount: 1940 },
    { line: "On-site staff & cleaning", amount: 1800 },
    { line: "Property tax (accrual)", amount: 1620 },
    { line: "Insurance", amount: 1150 },
    { line: "Admin & software", amount: 420 },
  ];
  const totalOpex = opex.reduce((a, o) => a + o.amount, 0);
  const k = kpis();
  const wos = s.workOrders;
  return {
    period: reportingMonth().label,
    property: { name: "Bonnie Doon Manor", address: "9107 88 Ave NW, Edmonton", units: units.length },
    occupancy: { leased: units.length - vacant.length, total: units.length, pct: (units.length - vacant.length) / units.length },
    vacant: vacant.map((u) => ({ suite: u.number, beds: u.beds, rent: u.rent, status: u.status, leadsInterested: s.leads.filter((l) => l.unitInterest === u.id && !["lost", "leased"].includes(l.stage)).length })),
    income: { gpr, vacancyLoss, arrears, laundry, collected, collectionRate: (gpr - vacancyLoss - arrears) / (gpr - vacancyLoss) },
    opex,
    totalOpex,
    noi: collected - totalOpex,
    leasing: k,
    maintenance: {
      opened: wos.length + 7,
      completed: wos.filter((w) => w.status === "completed").length + 7,
      emergencies: wos.filter((w) => w.urgency === "emergency").length,
      medianMinutesToBook: 0.2,
      byCategory: Object.entries(wos.reduce<Record<string, number>>((a, w) => ({ ...a, [w.category]: (a[w.category] ?? 0) + 1 }), {})),
    },
    capex: [
      { item: "#302 full turnover (Crew B)", status: "Finishing this week", budget: 14500, spent: 12100 },
      { item: "#104 flooring + paint", status: "Complete, listed", budget: 6200, spent: 5980 },
      { item: "Common-area LED retrofit", status: "Quoted", budget: 3800, spent: 0 },
    ],
  };
}

export function lpReport() {
  const s = db();
  const k = kpis();
  const q = reportingQuarter();
  const portfolio = s.properties.map((p) => ({
    ...p,
    uplift: p.acquisitionPrice && p.appraisedValue ? (p.appraisedValue - p.acquisitionPrice) / p.acquisitionPrice : undefined,
  }));
  return {
    quarter: q,
    fund: { name: COMPANY.fund, aum: COMPANY.aum, target: COMPANY.targetReturn, hold: COMPANY.hold, custodian: COMPANY.custodian, markets: COMPANY.markets },
    portfolio,
    bonnieDoon: { occupancy: k.occupancy, leased: k.leased, total: k.totalUnits, showings: k.showingsBooked14d, applications: k.applications14d, afterHoursPct: k.afterHoursPct },
    capitalEvents: [
      { event: "Mountain Manor refinance", status: "In execution", note: "Appraised at $1.8M vs $1.17M purchase; proceeds to return investor capital." },
      { event: "Alexo & Phoenix", status: "Realized", note: "$1.9M purchase, $5.6M combined appraisal within 12 months (+$3.7M)." },
    ],
  };
}

export function templateNarrative(kind: "property" | "lp"): string {
  if (kind === "property") {
    const r = propertyReport();
    return [
      `Bonnie Doon Manor closed ${r.period} at ${Math.round(r.occupancy.pct * 100)}% occupancy (${r.occupancy.leased} of ${r.occupancy.total} suites), holding steady in a soft Edmonton rental market. Collections were ${Math.round(r.income.collectionRate * 1000) / 10}% of occupied rent, with one tenant on an agreed payment plan.`,
      `Leasing demand remains healthy: ${r.leasing.inquiries14d} inquiries over the last 14 days, ${Math.round(r.leasing.afterHoursPct * 100)}% of them outside office hours, each answered in a median ${r.leasing.medianFirstResponseSec} seconds. ${r.leasing.showingsBooked14d} showings were booked straight into the leasing calendar, and both open suites have active applicants.`,
      `Suite #302 is in the final week of its turnover with Crew B and is pre-marketed for a November 15 start. Maintenance requests were triaged and booked automatically, and every emergency was dispatched within minutes of the first message.`,
    ].join("\n\n");
  }
  const r = lpReport();
  return [
    `${r.fund.name} continued to execute its buy-right, reposition, return-capital model through ${r.quarter.label}. The Alexo & Phoenix portfolio stands as the fund's realized proof point: acquired for $1.9M and appraised at a combined $5.6M after twelve months of occupancy gains, suite renovations and utility optimization.`,
    `At Mountain Manor, the refinance is in execution following an appraisal of $1.8M against a $1.17M purchase price. As underwritten from day one, proceeds are intended to return investor capital and recycle equity into the next acquisition within the fund's Edmonton, Camrose and Vegreville focus markets.`,
    `Bonnie Doon Manor is ${Math.round(r.bonnieDoon.occupancy * 100)}% occupied (${r.bonnieDoon.leased} of ${r.bonnieDoon.total}). The remaining suites have active leasing pipelines, supported by an always-on leasing layer that now answers every inquiry, including the ${Math.round(r.bonnieDoon.afterHoursPct * 100)}% that arrive after hours.`,
  ].join("\n\n");
}
