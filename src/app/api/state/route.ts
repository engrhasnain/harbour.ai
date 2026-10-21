import { NextResponse } from "next/server";
import { snapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(snapshot());
}
