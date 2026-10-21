import Link from "next/link";
import { ArrowRight, Building2, Landmark } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { reportingMonth, reportingQuarter } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const month = reportingMonth();
  const quarter = reportingQuarter();
  const cards = [
    {
      href: "/reports/property",
      icon: Building2,
      title: `Monthly property report · ${month.label}`,
      who: "For: COO / asset management, lenders",
      when: "Auto-drafted on the 1st of each month at 6:00 AM",
      body: "Occupancy, rent roll and collections, NOI, leasing funnel, work orders and capex for Bonnie Doon Manor, with AI commentary that flags what needs attention.",
    },
    {
      href: "/reports/lp",
      icon: Landmark,
      title: `LP quarterly update · ${quarter.label}`,
      who: "For: limited partners of THC Value-Add 1 LP",
      when: "Auto-drafted at quarter end, held for EMD compliance review",
      body: "Fund snapshot, property-by-property progress, capital events like the Mountain Manor refinance, and an investor letter written strictly from the numbers.",
    },
  ];
  return (
    <>
      <PageHeader title="Reports" subtitle="Monthly property reporting and quarterly investor updates" />
      <div className="grid gap-6 p-6 md:grid-cols-2 lg:p-8">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card group p-6 transition hover:border-harbour-500 hover:shadow-md">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-navy-900 text-white">
              <c.icon size={18} />
            </div>
            <div className="text-lg font-semibold text-navy-900">{c.title}</div>
            <div className="mt-1 text-xs font-medium text-harbour-600">{c.who}</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.body}</p>
            <div className="mt-4 flex items-center justify-between border-t border-sand-100 pt-3 text-xs text-slate-500">
              {c.when}
              <span className="flex items-center gap-1 font-medium text-navy-900 group-hover:text-harbour-600">
                Open <ArrowRight size={13} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
