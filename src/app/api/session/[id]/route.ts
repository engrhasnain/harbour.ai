import { NextResponse } from "next/server";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sess = db().sessions.get(id);
  if (!sess) return NextResponse.json({ transcript: [] });
  return NextResponse.json({ persona: sess.persona, channel: sess.channel, transcript: sess.transcript });
}
