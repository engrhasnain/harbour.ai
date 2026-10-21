import { NextResponse } from "next/server";
import { handleTurn } from "@/lib/turn";
import { db, log, mail } from "@/lib/store";
import type { Channel } from "@/lib/types";

export const dynamic = "force-dynamic";

// Inquiries the way listing sites forward them: a name, an email and a short message.
const INQUIRIES: { site: string; channel: Channel; name: string; email: string; message: string }[] = [
  { site: "Kijiji", channel: "kijiji", name: "Jordan Tremblay", email: "jordan.tremblay@example.com", message: "Hi, is the 2 bedroom still available? I have a small dog. My name is Jordan Tremblay." },
  { site: "Rentals.ca", channel: "rentals.ca", name: "Amara Osei", email: "amara.osei@example.com", message: "Hello, I'm Amara Osei. Is heat included in the rent for the 1 bedroom, and how far is it from the LRT?" },
  { site: "Facebook Marketplace", channel: "facebook", name: "Lucas Martin", email: "lucas.martin@example.com", message: "Is this still available? This is Lucas Martin." },
];

let cursor = 0;

export async function POST() {
  const q = INQUIRIES[cursor++ % INQUIRIES.length];
  const sessionId = `mail-${Date.now()}`;
  const threadId = `T-${sessionId}`;
  const subject = `${q.site}: inquiry about Bonnie Doon Manor`;
  const inbound = mail({ threadId, folder: "inquiries", from: q.name, fromEmail: q.email, to: "leasing@tripleharbour.com", subject, body: q.message, sessionId });

  const out = await handleTurn(sessionId, "prospect", q.channel, q.message);
  const sess = db().sessions.get(sessionId);
  const lead = sess?.leadId ? db().leads.find((l) => l.id === sess.leadId) : undefined;
  if (lead) {
    lead.name ??= q.name;
    lead.email ??= q.email;
    inbound.leadId = lead.id;
  }
  mail({
    threadId,
    folder: "inquiries",
    from: "Bonnie Doon Manor Leasing",
    fromEmail: "leasing@tripleharbour.com",
    to: q.email,
    subject: `Re: ${subject}`,
    body: `${out.reply}\n\nBonnie Doon Manor Leasing\n9107 88 Ave NW, Edmonton`,
    byAssistant: true,
    leadId: lead?.id,
    sessionId,
  });
  log("inquiry-to-showing", `Answered ${q.site} email from ${q.name} in ${Math.max(1, Math.round(out.latencyMs / 1000))}s`, { ref: lead ? { type: "lead", id: lead.id } : undefined });
  return NextResponse.json({ ok: true, threadId, emailId: inbound.id });
}
