import { NextResponse } from "next/server";
import { handleTurn } from "@/lib/turn";
import { log } from "@/lib/store";
import type { Channel, Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCENARIOS: { persona: Persona; channel: Channel; message: string; missedCall?: boolean }[] = [
  { persona: "prospect", channel: "kijiji", message: "Hi, is the 2 bedroom still available? Moving Nov 15 with my partner and we have a cat. Could we see it Thursday?" },
  { persona: "prospect", channel: "facebook", message: "Is this still available?" },
  { persona: "prospect", channel: "rentals.ca", message: "Hello! I'm looking for a 1 bedroom for Dec 1, just me. What's the rent and is parking included?" },
  { persona: "prospect", channel: "sms", message: "Hey I just called about the apartment. Is heat included? I work downtown, how far is the LRT?", missedCall: true },
  { persona: "tenant", channel: "sms", message: "Hi this is Chloe Lavoie in 204, water is dripping from the bathroom ceiling" },
  { persona: "tenant", channel: "tenant-portal", message: "Hi it's Tom Haddad, unit 205. The fridge stopped cooling since this morning." },
];

let cursor = 0;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: "prospect" | "tenant" };
  const pool = body.kind ? SCENARIOS.filter((s) => s.persona === body.kind) : SCENARIOS;
  const sc = pool[cursor++ % pool.length];
  if (sc.missedCall) log("missed-call", "Missed call from (780) 555-0187 → AI text-back sent", { detail: "Caller replied by SMS; conversation handed to leasing agent" });
  const sessionId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const out = await handleTurn(sessionId, sc.persona, sc.channel, sc.message);
  return NextResponse.json({ sessionId, scenario: sc, ...out });
}
