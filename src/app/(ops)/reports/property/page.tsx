import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Narrative } from "@/components/Narrative";
import { PrintButton } from "@/components/PrintButton";
import { money, pct } from "@/components/ui";
import { propertyReport } from "@/lib/reports";
import { fmtDay } from "@/lib/time";

export const dynamic = "force-dynamic";

function Row({ label, value, strong, neg }: { label: string; value: number; strong?: boolean; neg?: boolean }) {
  return (
    <tr className={strong ? "border-t border-navy-900/20 font-semibold text-navy-900" : "text-slate-700"}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{neg ? `(${money(value)})` : money(value)}</td>
    </tr>
  );
}

export default function PropertyReportPage() {
  const r = propertyReport();
  return (
    <div className="p-6 lg:p-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900">
          <ChevronLeft size={15} /> Reports
        </Link>
        <PrintButton />
      </div>

      <article className="print-page card mx-auto max-w-4xl overflow-hidden">
        <header className="bg-navy-900 px-8 py-7 text-white">
          <div className="text-xs uppercase tracking-[0.2em] text-harbour-100/80">Triple Harbour Capital · Monthly property report</div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{r.property.name}</h1>
              <div className="text-sm text-white/70">
                {r.property.address} · {r.property.units} suites
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{r.period}</div>
              <div className="text-white/60">Prepared {fmtDay(new Date().toISOString())}</div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 border-b border-sand-200 md:grid-cols-4">
          {[
            ["Occupancy", `${pct(r.occupancy.pct)}`, `${r.occupancy.leased}/${r.occupancy.total} suites`],
            ["Collected", money(r.income.collected), `${(r.income.collectionRate * 100).toFixed(1)}% of occupied rent`],
            ["NOI", money(r.noi), `${pct(r.noi / r.income.collected)} margin`],
            ["Inquiry → showing", pct(r.leasing.inquiryToShowingPct), `${r.leasing.inquiries14d} inquiries / 14d`],
          ].map(([l, v, s]) => (
            <div key={l} className="border-r border-sand-200 px-6 py-5 last:border-r-0">
              <div className="label">{l}</div>
              <div className="mt-1 text-xl font-semibold text-navy-900">{v}</div>
              <div className="text-xs text-slate-500">{s}</div>
            </div>
          ))}
        </div>

        <div className="space-y-8 px-8 py-7">
          <Narrative kind="property" />

          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <div className="label mb-2">Operating statement</div>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Gross potential rent" value={r.income.gpr} />
                  <Row label="Vacancy loss" value={r.income.vacancyLoss} neg />
                  <Row label="Arrears (payment plan)" value={r.income.arrears} neg />
                  <Row label="Laundry income" value={r.income.laundry} />
                  <Row label="Effective income" value={r.income.collected} strong />
                  {r.opex.map((o) => (
                    <Row key={o.line} label={o.line} value={o.amount} neg />
                  ))}
                  <Row label="Net operating income" value={r.noi} strong />
                </tbody>
              </table>
            </section>

            <section className="space-y-6">
              <div>
                <div className="label mb-2">Suites not yet earning</div>
                {r.vacant.map((v) => (
                  <div key={v.suite} className="mb-2 flex items-center justify-between rounded-lg border border-sand-200 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-navy-900">#{v.suite}</span> · {v.beds}-bed · {money(v.rent)}
                      <div className="text-xs text-slate-500">{v.status === "vacant" ? "vacant, listed" : "turnover in progress"}</div>
                    </div>
                    <div className="text-right text-xs font-medium text-harbour-600">{v.leadsInterested} active leads</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="label mb-2">Leasing funnel (14 days)</div>
                <div className="flex gap-1">
                  {r.leasing.funnel.map((f) => (
                    <div key={f.stage} className="flex-1 rounded-md bg-sand-100 px-2 py-2 text-center">
                      <div className="text-lg font-semibold text-navy-900">{f.count}</div>
                      <div className="text-[10px] text-slate-500">{f.stage}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Median first response {r.leasing.medianFirstResponseSec}s · {pct(r.leasing.afterHoursPct)} of inquiries after hours, all answered.
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <div className="label mb-2">Maintenance</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Opened", r.maintenance.opened],
                  ["Completed", r.maintenance.completed],
                  ["Emergencies", r.maintenance.emergencies],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-md bg-sand-100 py-2">
                    <div className="text-lg font-semibold text-navy-900">{v}</div>
                    <div className="text-[10px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-slate-500">Every request triaged and booked into a crew calendar within seconds of the first message.</div>
            </section>
            <section>
              <div className="label mb-2">Capex & turnovers</div>
              <table className="w-full text-sm">
                <tbody>
                  {r.capex.map((c) => (
                    <tr key={c.item} className="border-b border-sand-100 last:border-0">
                      <td className="py-1.5 text-navy-900">
                        {c.item}
                        <div className="text-xs text-slate-500">{c.status}</div>
                      </td>
                      <td className="py-1.5 text-right text-xs tabular-nums text-slate-600">
                        {money(c.spent)} / {money(c.budget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
        <footer className="border-t border-sand-200 bg-sand-50 px-8 py-4 text-[11px] text-slate-500">
          Generated automatically by Harbour Ops for internal review. Occupancy, leasing and maintenance figures are live from the operating system; income and expense lines are illustrative for this demo and would come from the connected accounting ledger.
        </footer>
      </article>
    </div>
  );
}
