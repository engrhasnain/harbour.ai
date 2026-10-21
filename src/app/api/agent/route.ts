import { NextResponse } from "next/server";
import { handleTurn } from "@/lib/turn";
import type { Channel, Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHANNELS: Channel[] = ["website", "rentals.ca", "kijiji", "facebook", "phone", "sms", "tenant-portal", "email", "investor-site"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string; persona?: Persona; channel?: Channel; message?: string };
  const message = body.message?.toString().trim();
  if (!body.sessionId || !message) return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
  const persona: Persona = body.persona === "tenant" || body.persona === "investor" ? body.persona : "prospect";
  const channel: Channel = CHANNELS.includes(body.channel as Channel) ? (body.channel as Channel) : "website";
  return NextResponse.json(await handleTurn(body.sessionId, persona, channel, message.slice(0, 2000)));
}
