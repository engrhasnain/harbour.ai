import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/store";

export const dynamic = "force-dynamic";

export function POST() {
  resetDemo();
  return NextResponse.json({ ok: true });
}
