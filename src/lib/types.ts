import type Anthropic from "@anthropic-ai/sdk";

export type Channel = "website" | "rentals.ca" | "kijiji" | "facebook" | "phone" | "sms" | "tenant-portal" | "email" | "investor-site";
export type Persona = "prospect" | "tenant" | "investor";

export type UnitStatus = "leased" | "vacant" | "notice" | "turnover";

export interface Unit {
  id: string; // e.g. "BDM-104"
  propertyId: string;
  number: string;
  beds: 1 | 2;
  baths: number;
  sqft: number;
  rent: number;
  status: UnitStatus;
  availableFrom?: string; // ISO date
  tenant?: string;
  tenantPhone?: string;
  leaseEnd?: string;
  floor: number;
  features: string[];
}

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  status: "operating" | "refinancing" | "realized";
  acquisitionPrice?: number;
  appraisedValue?: number;
  unitCount?: number;
  summary: string;
  source: string; // where the fact comes from
}

export type LeadStage = "new" | "qualified" | "showing_booked" | "showing_done" | "applied" | "leased" | "lost";

export interface Lead {
  id: string;
  createdAt: string;
  channel: Channel;
  name?: string;
  phone?: string;
  email?: string;
  bedrooms?: number;
  budget?: number;
  moveIn?: string;
  occupants?: number;
  pets?: string;
  incomeMonthly?: number;
  unitInterest?: string;
  stage: LeadStage;
  score: number;
  summary: string;
  sessionId?: string;
  afterHours: boolean;
  firstResponseSec: number;
  showingEventId?: string;
  lastActivity: string;
}

export type ResourceId = "leasing" | "crew-a" | "crew-b" | "vendor-plumbing" | "rodrigo";

export type InvestorStage = "new" | "call_booked" | "docs_sent" | "committed" | "not_fit";

export interface InvestorLead {
  id: string;
  createdAt: string;
  name?: string;
  email?: string;
  phone?: string;
  accredited?: "yes" | "no" | "unsure";
  amount?: string; // what they mentioned, e.g. "around $100k"
  interest: string; // one-line summary of what they asked about
  stage: InvestorStage;
  callEventId?: string;
  sessionId?: string;
  source: string;
  lastActivity: string;
}

export interface Email {
  id: string;
  threadId: string;
  folder: "inquiries" | "alerts" | "reports" | "investors";
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  ts: string;
  unread: boolean;
  /** Sent by the assistant on the team's behalf. */
  byAssistant?: boolean;
  attachment?: { name: string; href: string };
  link?: { label: string; href: string };
  leadId?: string;
  sessionId?: string;
}

export interface CalEvent {
  id: string;
  resource: ResourceId;
  start: string;
  end: string;
  title: string;
  kind: "showing" | "work_order" | "turnover" | "inspection" | "investor_call";
  propertyId: string;
  unitId?: string;
  leadId?: string;
  workOrderId?: string;
  createdBy: "ai" | "staff";
  notes?: string;
}

export type Urgency = "emergency" | "urgent" | "routine";

export interface WorkOrder {
  id: string;
  createdAt: string;
  propertyId: string;
  unitId: string;
  tenant: string;
  phone?: string;
  category: string;
  issue: string;
  urgency: Urgency;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  resource: ResourceId;
  eventId?: string;
  scheduledFor?: string;
  permissionToEnter: boolean;
  channel: Channel;
  createdBy: "ai" | "staff";
}

export type WorkflowId = "inquiry-to-showing" | "missed-call" | "maintenance-dispatch" | "property-report" | "lp-report" | "investor-inquiry";

export interface Activity {
  id: string;
  ts: string;
  workflow: WorkflowId;
  title: string;
  detail?: string;
  actor: "ai" | "staff" | "system";
  ref?: { type: "lead" | "workorder" | "event" | "report" | "investor"; id: string };
}

export interface ToolAction {
  tool: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface TranscriptMsg {
  role: "user" | "assistant";
  /** Set when a team member typed this message instead of the assistant. */
  by?: "staff";
  text: string;
  ts: string;
  actions?: ToolAction[];
}

export interface Session {
  id: string;
  persona: Persona;
  channel: Channel;
  createdAt: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  transcript: TranscriptMsg[];
  leadId?: string;
  investorId?: string;
  workOrderIds: string[];
  offline: Record<string, unknown>;
  /** Staff replies the assistant has not seen yet; passed along with the next user turn. */
  staffNotes?: string[];
}

export interface Snapshot {
  now: string;
  engine: { mode: "claude" | "offline"; model?: string };
  properties: Property[];
  units: Unit[];
  leads: Lead[];
  events: CalEvent[];
  workOrders: WorkOrder[];
  activity: Activity[];
  emails: Email[];
  investors: InvestorLead[];
  kpis: Kpis;
}

export interface Kpis {
  occupancy: number;
  leased: number;
  totalUnits: number;
  vacancyCostPerDay: number;
  inquiries14d: number;
  afterHoursPct: number;
  medianFirstResponseSec: number;
  showingsBooked14d: number;
  inquiryToShowingPct: number;
  applications14d: number;
  openWorkOrders: number;
  aiHandledPct: number;
  funnel: { stage: string; count: number }[];
}
