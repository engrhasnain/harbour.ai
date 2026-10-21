import { NextResponse } from "next/server";
import {
  cancelEvent,
  completeEvent,
  emailReply,
  markRead,
  moveEvent,
  reassignWorkOrder,
  sessionForWorkOrder,
  setInvestorStage,
  setLeadStage,
  setWorkOrderStatus,
  slotsForEvent,
  staffReply,
} from "@/lib/actions";
import { friendlyWhen } from "@/lib/time";
import type { InvestorStage, LeadStage, ResourceId, WorkOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  kind: string;
  id?: string;
  start?: string;
  status?: WorkOrder["status"];
  resource?: ResourceId;
  stage?: LeadStage;
  leadId?: string;
  workOrderId?: string;
  text?: string;
  threadId?: string;
  investorId?: string;
  investorStage?: InvestorStage;
};

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Body;
  const id = b.id ?? "";
  const r = (() => {
    switch (b.kind) {
      case "event.slots":
        return { ok: true, slots: slotsForEvent(id).map((s) => ({ ...s, label: friendlyWhen(s.start) })) };
      case "event.move":
        return b.start ? moveEvent(id, b.start) : { ok: false, error: "start is required" };
      case "event.cancel":
        return cancelEvent(id);
      case "event.complete":
        return completeEvent(id);
      case "wo.status":
        return b.status ? setWorkOrderStatus(id, b.status) : { ok: false, error: "status is required" };
      case "wo.reassign":
        return b.resource ? reassignWorkOrder(id, b.resource) : { ok: false, error: "resource is required" };
      case "wo.session":
        return { ok: true, sessionId: sessionForWorkOrder(id)?.id ?? null };
      case "lead.stage":
        return b.stage ? setLeadStage(id, b.stage) : { ok: false, error: "stage is required" };
      case "inv.stage":
        return b.investorStage ? setInvestorStage(id, b.investorStage) : { ok: false, error: "investorStage is required" };
      case "mail.read":
        return markRead(id);
      case "mail.reply": {
        const text = b.text?.trim();
        if (!text || !b.threadId) return { ok: false, error: "threadId and text are required" };
        return emailReply(b.threadId, text.slice(0, 3000));
      }
      case "reply": {
        const text = b.text?.trim();
        if (!text) return { ok: false, error: "text is required" };
        return staffReply({ leadId: b.leadId, workOrderId: b.workOrderId, investorId: b.investorId }, text.slice(0, 1000));
      }
      default:
        return { ok: false, error: `Unknown action ${b.kind}` };
    }
  })();
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
