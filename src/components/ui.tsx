import type { Channel, LeadStage, Urgency, WorkflowId } from "@/lib/types";

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;

const STAGE: Record<LeadStage, [string, string]> = {
  new: ["New", "bg-slate-100 text-slate-700"],
  qualified: ["Qualified", "bg-sky-100 text-sky-800"],
  showing_booked: ["Showing booked", "bg-harbour-100 text-harbour-600"],
  showing_done: ["Viewed", "bg-indigo-100 text-indigo-800"],
  applied: ["Applied", "bg-amber-100 text-amber-800"],
  leased: ["Leased", "bg-emerald-100 text-emerald-800"],
  lost: ["Lost", "bg-rose-50 text-rose-700"],
};

export function StagePill({ stage }: { stage: LeadStage }) {
  const [label, cls] = STAGE[stage];
  return <span className={`pill ${cls}`}>{label}</span>;
}

const CHANNEL: Record<Channel, string> = {
  website: "Website chat",
  "rentals.ca": "Rentals.ca",
  kijiji: "Kijiji",
  facebook: "FB Marketplace",
  phone: "Phone",
  sms: "SMS",
  "tenant-portal": "Tenant portal",
  email: "Email",
  "investor-site": "Investor site",
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  return <span className="pill bg-sand-100 text-navy-800">{CHANNEL[channel]}</span>;
}

const URGENCY: Record<Urgency, string> = {
  emergency: "bg-rose-100 text-rose-800",
  urgent: "bg-amber-100 text-amber-800",
  routine: "bg-slate-100 text-slate-700",
};

export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  return <span className={`pill capitalize ${URGENCY[urgency]}`}>{urgency}</span>;
}

export const WORKFLOWS: Record<WorkflowId, { name: string; color: string }> = {
  "inquiry-to-showing": { name: "Inquiry → Showing", color: "#0e7c86" },
  "missed-call": { name: "Missed call → Text-back", color: "#2563eb" },
  "maintenance-dispatch": { name: "Maintenance → Crew", color: "#c2410c" },
  "property-report": { name: "Property report", color: "#6d28d9" },
  "lp-report": { name: "LP report", color: "#b8893b" },
  "investor-inquiry": { name: "Investor → Rodrigo", color: "#1d4ed8" },
};

export function WorkflowTag({ id }: { id: WorkflowId }) {
  const w = WORKFLOWS[id];
  return (
    <span className="pill border" style={{ borderColor: `${w.color}40`, color: w.color, background: `${w.color}0d` }}>
      {w.name}
    </span>
  );
}

export function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "border-harbour-600/30 bg-harbour-50" : ""}`}>
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-navy-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-harbour-500" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{score}</span>
    </div>
  );
}
