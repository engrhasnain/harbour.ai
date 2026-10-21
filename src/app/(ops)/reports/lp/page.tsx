import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Narrative } from "@/components/Narrative";
import { PrintButton } from "@/components/PrintButton";
import { money, pct } from "@/components/ui";
import { lpReport } from "@/lib/reports";
import { fmtDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const millions = (n: number) => `$${(n / 1_000_000).toFixed(2).replace(/0$/, "")}M`;

export default function LpReportPage() {
  const r = lpReport();
  return (
    <div className="p-6 lg:p-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900">
          <ChevronLeft size={15} /> Reports
        </Link>
        <div className="flex items-center gap-3">
          <span className="pill bg-amber-100 text-amber-800">Draft · awaiting EMD compliance review</span>
          <PrintButton />
        </div>
      </div>

      <article className="print-page card mx-auto max-w-4xl overflow-hidden">
        <header className="relative overflow-hidden bg-navy-950 px-8 py-8 text-white">
          <svg className="absolute -right-10 bottom-0 h-full opacity-15" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>
            <path d="M0 70 Q25 55 50 70 T100 70 T150 70 T200 70 V100 H0Z" fill="#12939e" />
            <path d="M0 82 Q25 70 50 82 T100 82 T150 82 T200 82 V100 H0Z" fill="#0e7c86" />
          </svg>
          <div className="relative">
            <div className="text-xs uppercase tracking-[0.2em] text-harbour-100/80">Investor update · {r.quarter.label}</div>
            <h1 className="mt-2 text-3xl font-semibold">{r.fund.name}</h1>
            <div className="mt-1 text-sm text-white/70">Buy right. Reposition. Return capital. · {r.quarter.range}</div>
          </div>
        </header>

        <div className="grid grid-cols-2 border-b border-sand-200 md:grid-cols-4">
          {[
            ["Assets under management", money(r.fund.aum)],
            ["Target return", r.fund.target],
            ["Hold period", r.fund.hold],
            ["Custodian", r.fund.custodian],
          ].map(([l, v]) => (
            <div key={l} className="border-r border-sand-200 px-6 py-5 last:border-r-0">
              <div className="label">{l}</div>
              <div className="mt-1 text-lg font-semibold text-navy-900">{v}</div>
            </div>
          ))}
        </div>

        <div className="space-y-8 px-8 py-7">
          <div className="text-sm text-slate-500">Dear Partners,</div>
          <Narrative kind="lp" />

          <section>
            <div className="label mb-3">Portfolio</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-900/20 text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Asset</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Acquired</th>
                  <th className="pb-2 text-right font-medium">Appraised</th>
                  <th className="pb-2 text-right font-medium">Value uplift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {r.portfolio.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3">
                      <div className="font-medium text-navy-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.summary}</div>
                    </td>
                    <td className="py-3 pl-4 text-xs text-slate-600">{p.status === "operating" ? `Operating · ${pct(r.bonnieDoon.occupancy)} occupied` : p.status === "refinancing" ? "Refinance in execution" : "Realized"}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{p.acquisitionPrice ? millions(p.acquisitionPrice) : "–"}</td>
                    <td className="py-3 pl-4 text-right tabular-nums">{p.appraisedValue ? millions(p.appraisedValue) : "–"}</td>
                    <td className="py-3 text-right font-semibold tabular-nums text-emerald-700">{p.uplift !== undefined ? `+${pct(p.uplift)}` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="grid gap-8 md:grid-cols-2">
            <section>
              <div className="label mb-3">Capital events</div>
              <div className="space-y-2">
                {r.capitalEvents.map((c) => (
                  <div key={c.event} className="rounded-lg border border-sand-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-navy-900">{c.event}</div>
                      <span className={`pill ${c.status === "Realized" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{c.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{c.note}</div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="label mb-3">Operations · Bonnie Doon Manor</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Occupancy", `${r.bonnieDoon.leased}/${r.bonnieDoon.total}`],
                  ["Showings booked (14d)", r.bonnieDoon.showings],
                  ["Applications (14d)", r.bonnieDoon.applications],
                  ["After-hours inquiries answered", pct(r.bonnieDoon.afterHoursPct)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-md bg-sand-100 p-3">
                    <div className="text-lg font-semibold text-navy-900">{v}</div>
                    <div className="text-[11px] text-slate-500">{l}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="text-sm text-slate-700">
            With thanks,
            <div className="mt-2 font-medium text-navy-900">Rodrigo Parada, Alvaro Besa & Remi Noel</div>
            <div className="text-xs text-slate-500">Co-Founders, Triple Harbour Capital</div>
          </div>
        </div>
        <footer className="border-t border-sand-200 bg-sand-50 px-8 py-4 text-[10.5px] leading-relaxed text-slate-500">
          Prepared {fmtDay(new Date().toISOString())}. This update is for existing limited partners of {r.fund.name} and is not an offer to sell or a solicitation to buy any security. Offerings are made only through a registered Exempt Market Dealer under the fund&apos;s offering documents. Target returns are not guaranteed; past performance is not indicative of future results. Property values reflect third-party appraisals as published on tripleharbour.com. Demo document generated by Harbour Ops.
        </footer>
      </article>
    </div>
  );
}
