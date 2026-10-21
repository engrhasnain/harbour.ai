import { runAgent } from "./agent";
import { db, getSession } from "./store";
import type { Channel, Persona } from "./types";

export async function handleTurn(sessionId: string, persona: Persona, channel: Channel, message: string) {
  const sess = getSession(sessionId, persona, channel);
  const started = Date.now();
  sess.transcript.push({ role: "user", text: message, ts: new Date().toISOString() });
  const out = await runAgent(sess, message);
  sess.transcript.push({ role: "assistant", text: out.reply, ts: new Date().toISOString(), actions: out.actions });
  const lead = sess.leadId ? db().leads.find((l) => l.id === sess.leadId) : undefined;
  if (lead && !lead.firstResponseSec) lead.firstResponseSec = Math.max(1, Math.round((Date.now() - started) / 1000));
  return { reply: out.reply, actions: out.actions, engine: out.engine, leadId: sess.leadId, workOrderIds: sess.workOrderIds, latencyMs: Date.now() - started };
}
