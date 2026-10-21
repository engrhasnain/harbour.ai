import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { lpReport, propertyReport, templateNarrative } from "@/lib/reports";
import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") === "lp" ? "lp" : "property";
  const cached = db().narratives[kind];
  return NextResponse.json(cached ?? { text: templateNarrative(kind), engine: "template", generatedAt: new Date().toISOString() });
}

export async function POST(req: Request) {
  const { kind: k } = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = k === "lp" ? "lp" : "property";
  if (!process.env.ANTHROPIC_API_KEY) {
    const out = { text: templateNarrative(kind), engine: "template", generatedAt: new Date().toISOString() };
    db().narratives[kind] = out;
    return NextResponse.json(out);
  }

  const data = kind === "lp" ? lpReport() : propertyReport();
  const audience =
    kind === "lp"
      ? "limited partners of an Alberta exempt-market real estate fund. Tone: a confident, plain-spoken operator writing a quarterly letter. No forward-looking return promises; no figures that are not in the data."
      : "the fund's COO and asset manager. Tone: crisp monthly asset-management commentary that flags what needs attention."
  const model = process.env.CLAUDE_MODEL || "claude-opus-5-5";
  try {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: `You write the commentary section of reports for Triple Harbour Capital. Audience: ${audience} Write exactly three short paragraphs of plain prose (no headings, no bullets, no markdown). Use only facts and numbers present in the JSON data you are given.`,
      messages: [{ role: "user", content: `Report data:\n${JSON.stringify(data, null, 2)}` }],
    });
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const out = { text: text || templateNarrative(kind), engine: response.model, generatedAt: new Date().toISOString() };
    db().narratives[kind] = out;
    return NextResponse.json(out);
  } catch (err) {
    console.error("[narrative] Claude call failed:", err);
    return NextResponse.json({ text: templateNarrative(kind), engine: "template (Claude unavailable)", generatedAt: new Date().toISOString() });
  }
}
