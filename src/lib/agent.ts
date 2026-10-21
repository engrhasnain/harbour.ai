import Anthropic from "@anthropic-ai/sdk";
import type { Session, ToolAction } from "./types";
import { BUILDING, FAIR_HOUSING, FUND_KB, INVESTOR_RULES, KB } from "./kb";
import { runTool, toolsFor } from "./tools";
import { runOffline } from "./offline-agent";
import { fmtDay } from "./time";

export interface AgentReply {
  reply: string;
  actions: ToolAction[];
  engine: string;
}

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

const MODEL = () => process.env.CLAUDE_MODEL || "claude-opus-5-5";

function systemPrompt(sess: Session): string {
  const today = fmtDay(new Date().toISOString());
  const voice =
    sess.channel === "phone"
      ? "You are speaking on a phone call through text-to-speech. Use short spoken sentences, no lists, no symbols, no emoji, say prices like 'thirteen twenty-five a month'."
      : sess.channel === "sms"
        ? "You are replying by SMS. Keep each reply under 320 characters, plain text."
        : "You are replying in the chat widget on the building's website.";

  if (sess.persona === "investor") {
    return `You are the investor relations assistant on the Triple Harbour Capital website. Today is ${today} (Edmonton time).

Your job: answer prospective investors' questions about THC Value-Add 1 LP clearly and accurately from the facts below, learn who they are, and book a 30-minute intro call with Rodrigo Parada (CEO).

How to work:
- Answer the question first, plainly, then ask at most one question.
- Save what you learn with update_investor (name, email, accredited status, amount, what they asked).
- When they show interest, offer two intro call times from get_intro_call_times. Before book_intro_call you need their chosen time, name and email.
- Anything personal (tax situation, whether this suits their portfolio) or not covered below: say Rodrigo or the dealer will cover it on the call, and escalate_to_human if they want a written answer.
- Write like a knowledgeable person at a small investment firm: 1–3 short sentences, blank line between separate thoughts, no lists, headings, bold or emoji.

${INVESTOR_RULES}

${FUND_KB}`;
  }

  if (sess.persona === "prospect") {
    return `You are the 24/7 leasing assistant for ${BUILDING.name}, a Triple Harbour Capital property at ${BUILDING.address}. Today is ${today} (Edmonton time). The person reached us via ${sess.channel}.

Your job is to do what a great on-site leasing agent does: answer questions accurately and warmly, learn what the person needs, and get them booked for a showing.

How to work:
- Check search_units before quoting any rent, suite or availability. Quote only what it returns.
- Learn naturally, one question at a time: bedrooms, move-in date, who will live there, pets. Save details with update_lead as soon as you learn them.
- Affordability: once they are clearly interested, you may mention the guideline (household income about 2.5x rent, all lawful income sources count) and ask if that works. Never make it a condition of seeing the suite.
- Offer exactly two concrete times from get_showing_slots, in a sentence ("I have Thursday at 6:30pm or Saturday at 11am open. Would either work?"). Before book_showing you need their chosen time, name and mobile number. After booking, confirm the day, time, suite and address, and mention the text confirmation.
- If they ask for something the knowledge base does not cover, say you will check with the team and call escalate_to_human. Never guess.
- ${voice}

Write like an experienced, friendly leasing agent texting a renter:
- Answer what they asked first, in plain words. Then ask at most one question.
- 1–3 short sentences per message. If you have two separate thoughts, put a blank line between them (each becomes its own chat bubble).
- No bullet points, numbered lists, headings, bold, or emoji. No "Great question!" or "I'd be happy to help". Never mention tools, systems, CRMs or that you "checked the calendar".
- Use natural times ("tomorrow at 10am", "Thursday at 6:30pm") and round prices ("$1,465 a month").
- If asked whether you are a person, say you're the building's virtual leasing assistant and a person from the team can follow up.

${FAIR_HOUSING}

${KB}`;
  }

  return `You are the 24/7 maintenance line for tenants of ${BUILDING.name}, ${BUILDING.address}, operated by Triple Harbour Capital. Today is ${today} (Edmonton time). The tenant reached us via ${sess.channel}.

How to work:
- Safety first. Gas smell, smoke or fire: tell them to leave the suite and call 911 (and the gas utility's emergency line for gas) before anything else, then open an emergency work order.
- Get the suite number and their name, then call verify_tenant.
- Understand the problem with at most one or two clarifying questions. Classify urgency strictly by the knowledge base (emergency / urgent / routine).
- For anything that is not an emergency, ask whether the crew may enter if nobody is home.
- Call create_work_order. Then tell them who is coming and when ("our on-call plumber", "our maintenance team"), and one practical tip to limit damage while they wait.
- Complaints about neighbours, rent, lease or legal questions: escalate_to_human.
- ${voice}

Write like a calm, capable building manager texting a tenant: short sentences, one question at a time, blank line between separate thoughts. No lists, headings, bold or emoji. Never mention tools, systems or internal crew codes.

${KB}`;
}

export async function runAgent(sess: Session, userText: string): Promise<AgentReply> {
  if (!process.env.ANTHROPIC_API_KEY) return { ...runOffline(sess, userText), engine: "offline" };

  const actions: ToolAction[] = [];
  const startLen = sess.messages.length;
  // If a team member replied in this conversation since the last turn, tell the assistant so it
  // stays consistent with what the person was told.
  const notes = sess.staffNotes?.splice(0) ?? [];
  sess.messages.push({
    role: "user",
    content: notes.length
      ? [
          { type: "text", text: `[A Triple Harbour team member replied in this chat since your last message: ${notes.map((n) => `"${n}"`).join(" ")}]` },
          { type: "text", text: userText },
        ]
      : userText,
  });
  try {
    for (let i = 0; i < 8; i++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL(),
        max_tokens: 4000,
        system: [{ type: "text", text: systemPrompt(sess), cache_control: { type: "ephemeral" } }],
        tools: toolsFor(sess.persona),
        messages: sess.messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      // Keep the full content (including thinking blocks) so the next turn replays it unchanged.
      sess.messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") {
        return { reply: "Sorry, I can't help with that here. I've passed your message to the Triple Harbour team.", actions, engine: MODEL() };
      }

      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { reply: text || "Got it.", actions, engine: response.model };
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const run = runTool(sess, block.name, (block.input ?? {}) as Record<string, unknown>);
        actions.push(run.action);
        results.push({ type: "tool_result", tool_use_id: block.id, content: run.content, is_error: run.isError || undefined });
      }
      sess.messages.push({ role: "user", content: results });
    }
    return { reply: "Let me get a teammate to finish this with you. You'll hear back shortly.", actions, engine: MODEL() };
  } catch (err) {
    // Never leave a demo hanging: roll back this turn and answer with the offline engine.
    sess.messages.length = startLen;
    const reason = err instanceof Anthropic.APIError ? `${err.status ?? ""} ${err.name}`.trim() : "network error";
    console.error("[agent] Claude call failed, using offline engine:", err);
    return { ...runOffline(sess, userText), engine: `offline (Claude unavailable: ${reason})` };
  }
}
