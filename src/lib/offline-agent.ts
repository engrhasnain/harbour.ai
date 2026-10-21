// Scripted engine used when no ANTHROPIC_API_KEY is configured (or Claude is unreachable).
// It drives the same tools as the Claude agent, so the calendar, CRM and work orders update
// identically. Replies are written to read like a leasing agent texting: short, one question at a
// time, no lists. Paragraph breaks ("\n\n") are rendered as separate chat bubbles.
import type { Session, ToolAction } from "./types";
import { runTool } from "./tools";
import { db } from "./store";
import { addDays, friendlyWhen, local, longWhen, monthDay } from "./time";

interface Offered {
  start_iso: string;
  label: string;
}

type Ask = "beds" | "movein" | "viewing" | "slot" | "contact" | "phone" | "name";

interface ProspectState {
  beds?: 1 | 2;
  moveIn?: string; // YYYY-MM-DD
  name?: string;
  phone?: string;
  email?: string;
  offered?: Offered[];
  seen?: string[]; // slots already offered
  chosen?: Offered;
  booked?: Offered;
  last?: Ask;
  asked?: Partial<Record<Ask, number>>;
  told?: Partial<Record<string, boolean>>;
  escalated?: boolean;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

const NOT_NAMES = /^(Hi|Hello|Hey|Thanks|Thank|The|My|Suite|Unit|Apt|Yes|Yeah|Sure|Ok|Okay|Please|It|This|Water|Kitchen|Bathroom|Is|Can|Do|What|When|How|Are|And|But|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|November|December|October|January)$/i;

const titleCase = (s: string) => s.split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

function extractName(text: string, loose: boolean): string | undefined {
  const explicit = text.match(/\b(?:my name is|my name's|name is|name's|call me)\s+([a-z\p{L}'-]+(?:\s+(?!and\b|my\b|number\b|phone\b)[a-z\p{L}'-]+)?)/iu);
  if (explicit && !NOT_NAMES.test(explicit[1].split(" ")[0])) return titleCase(explicit[1]);
  const m = text.match(/(?:[Mm]y name is|[Mm]y name's|[Tt]his is|[Ii]'m|[Ii] am|[Nn]ame's|[Ii]t's|[Nn]ame is)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/u);
  if (m && !NOT_NAMES.test(m[1].split(" ")[0])) return m[1];
  if (!loose) return undefined;
  for (const mm of text.matchAll(/\b([A-Z][\p{L}'-]+)(?:\s+([A-Z][\p{L}'-]+))?\b/gu)) {
    if (NOT_NAMES.test(mm[1]) || (mm[2] && NOT_NAMES.test(mm[2]))) continue;
    return mm[2] ? `${mm[1]} ${mm[2]}` : mm[1];
  }
  // all-lowercase reply to "what's your name?", e.g. "priya patel 780..." or "unit 203, priya sharma"
  const words = text
    .toLowerCase()
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/\b(unit|suite|apt|apartment|room|number|phone|cell|mobile|my|name|is|it's|its|i'm|im|and|here|this|hi|hey|hello|yes|yeah|sure|ok|okay|thanks|the|in|at)\b/g, " ")
    .replace(/[#()\d.,:;!?\-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => /^[a-z\p{L}'-]{2,}$/u.test(w));
  if (words.length >= 1 && words.length <= 3) return titleCase(words.slice(0, 2).join(" "));
  return undefined;
}

const extractPhone = (text: string) => text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0];

function extractMoveIn(lower: string): string | undefined {
  const t = local(new Date());
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (/\b(asap|right away|immediately|as soon as|right now)\b/.test(lower)) return iso(t.y, t.m, t.d);
  if (/next month|beginning of (the )?month|start of (the )?month/.test(lower)) {
    const d = addDays(t.y, t.m, 1, 32);
    return iso(d.y, d.m, 1);
  }
  const m = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})?(?:st|nd|rd|th)?\b/);
  if (m) {
    const month = MONTHS.indexOf(m[1]) + 1;
    const year = month < t.m ? t.y + 1 : t.y;
    return iso(year, month, Number(m[2] ?? 1));
  }
  const d = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)? of (?:the )?(?:month|next month)/);
  if (d) {
    const n = addDays(t.y, t.m, 1, 32);
    return iso(n.y, n.m, Number(d[1]));
  }
  return undefined;
}

function moneyNear(lower: string, keywords: RegExp): number | undefined {
  if (!keywords.test(lower)) return undefined;
  const m = lower.match(/\$?\s?(\d{1,2},?\d{3})(?:\s?k)?/);
  return m ? Number(m[1].replace(",", "")) : undefined;
}

export function runOffline(sess: Session, text: string): { reply: string; actions: ToolAction[] } {
  if (sess.persona === "investor") return investor(sess, text);
  return sess.persona === "tenant" ? tenant(sess, text) : prospect(sess, text);
}

// ---------------------------------------------------------------- investors

interface InvestorState {
  name?: string;
  email?: string;
  phone?: string;
  accredited?: "yes" | "no" | "unsure";
  offered?: Offered[];
  chosen?: Offered;
  booked?: Offered;
  last?: "call" | "slot" | "contact" | "accredited" | "email";
  asked?: Record<string, number>;
  told?: Record<string, boolean>;
}

function investor(sess: Session, raw: string) {
  const st = sess.offline as InvestorState;
  st.asked ??= {};
  st.told ??= {};
  const text = raw.trim();
  const lower = text.toLowerCase();
  const actions: ToolAction[] = [];
  const call = (name: string, input: Record<string, unknown>) => {
    const r = runTool(sess, name, input);
    actions.push(r.action);
    return JSON.parse(r.content);
  };
  const done = (...b: (string | undefined)[]) => ({ reply: b.filter((x) => x && x.trim()).join("\n\n"), actions });

  // ---------- learn ----------
  const learned: Record<string, unknown> = {};
  const expectingName = st.last === "contact";
  const name = extractName(text, expectingName);
  if (name && (!st.name || expectingName)) learned.name = st.name = name;
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  if (email) learned.email = st.email = email;
  const phone = extractPhone(text);
  if (phone) learned.phone = st.phone = phone;
  const amount = text.match(/\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|million|thousand)?|\b\d{2,3}\s?(?:k|thousand)\b/i)?.[0];
  if (amount && /invest|put in|thinking|looking|around|about|have|budget|\$/.test(lower)) learned.amount = amount.trim();
  if (st.last === "accredited") {
    if (/\b(yes|yeah|yep|i am|i'm accredited|correct)\b/.test(lower)) learned.accredited = st.accredited = "yes";
    else if (/\b(not sure|unsure|don'?t know|no idea|maybe)\b/.test(lower)) learned.accredited = st.accredited = "unsure";
    else if (/\b(no|nope|not)\b/.test(lower)) learned.accredited = st.accredited = "no";
  }
  const topics: string[] = [];

  const answers: string[] = [];
  const faq = (key: string, re: RegExp, answer: string) => {
    if (re.test(lower)) {
      answers.push(answer);
      st.told![key] = true;
      topics.push(key);
    }
  };
  faq("strategy", /\b(what do you (do|invest)|strategy|how does (it|this|the fund) work|what kind of|business model|value.?add)\b/, "We buy older apartment buildings, usually 10 to 50 units, in mid-sized Alberta markets, fix them up and run them better, then refinance to return investors' capital and recycle it into the next building.");
  faq("returns", /\b(return|returns|yield|irr|how much (can|will|would) i make|profit|roi)\b/, "The fund targets 15–18% annualized, paid through a waterfall with a preferred return first and then profit participation. Those are targets, not guarantees.");
  faq("minimum", /\b(minimum|min\b|how much do i need|smallest|least)\b/, "There is a minimum investment. The exact threshold is in the offering documents, which come to you through our Exempt Market Dealer, and Rodrigo can walk you through it.");
  faq("hold", /\b(hold|how long|lock.?up|liquid|get my money (back|out)|exit|term)\b/, "The plan is a 3–5 year hold. Along the way we refinance stabilized buildings to return capital, like we're doing at Mountain Manor right now.");
  faq("track", /\b(track record|results|performance|past deals|history|done before|proof)\b/, "Our clearest example is Alexo & Phoenix: bought for $1.9M as a portfolio and appraised at a combined $5.6M about 12 months later, after renovations and occupancy gains. Past results don't guarantee future ones.");
  faq("mountain", /\b(mountain manor|refinanc)\b/, "Mountain Manor was bought at $1.17M and appraised at $1.8M. The refinance is underway now, and it's meant to return investor capital.");
  faq("alexo", /\b(alexo|phoenix)\b/, "Alexo & Phoenix was bought as a portfolio for $1.9M. We raised occupancy, renovated suites and cut utility costs, and it appraised at $5.6M combined.");
  faq("risk", /\b(risk|risky|safe|guarantee|lose|downside|what if)\b/, "Every deal is underwritten from the exit first and stress-tested against a worst-case refinance before we commit capital. It's still a private investment though, so returns aren't guaranteed and capital is at risk.");
  faq("accredited", /\b(accredited|qualify|eligible to invest|who can invest)\b/, "The fund is offered to accredited investors through a licensed Exempt Market Dealer. If you're not sure whether you qualify, the dealer confirms that with you, usually based on income or net assets.");
  faq("registered", /\b(rrsp|tfsa|rrif|registered|tax|taxes|t5013|deduct)\b/, "The team confirms registered-account eligibility for each investor, and I can't give tax advice. That's a good one to go over with Rodrigo and your own advisor.");
  faq("custody", /\b(custodian|custody|where is (my|the) money|held|trust company|odyssey)\b/, "Investor funds are held with Odyssey Trust as custodian, and the fund is distributed through a licensed Exempt Market Dealer.");
  faq("distributions", /\b(distribution|distributions|payout|paid|pref|preferred|waterfall|cash flow)\b/, "Returns flow through a waterfall: investors get a preferred return first, then share in the profits. Timing and the exact terms are in the offering documents.");
  faq("markets", /\b(where|which (cities|markets)|alberta|edmonton|camrose|vegreville|markets?)\b/, "We focus on mid-sized Alberta markets with strong rental demand and buildings priced below replacement cost: right now Edmonton, Camrose, Vegreville and the surrounding area.");
  faq("team", /\b(who (are you|runs|is behind)|your team|founders?|who is (rodrigo|alvaro|remi))\b/, "There are three co-founders: Rodrigo Parada (CEO) leads deals and capital raising, Alvaro Besa (COO) handles legal, treasury and compliance, and Remi Noel (CDO) leads construction and due diligence.");
  faq("reporting", /\b(report|reporting|updates?|portal|statements?)\b/, "Investors get regular updates, quarterly LP reports and access to an investor portal.");
  faq("aum", /\b(aum|assets under|how big|size of the fund)\b/, "The fund has about $29M in assets under management.");

  if (/\b(fee|fees|management fee|carry|carried interest|promote)\b/.test(lower)) {
    call("escalate_to_human", { reason: `Investor asked about fees: "${text.slice(0, 100)}"`, urgency: "normal" });
    answers.push("I'd rather not guess on fees. They're set out in the offering documents, and I've passed your question to Rodrigo so you get an exact answer.");
    topics.push("fees");
  }
  if (learned.amount && !answers.length) answers.push(`Thanks, I'll note ${learned.amount} for Rodrigo.`);
  // Keep a running list of what they asked about, so Rodrigo's briefing covers the whole conversation.
  const allTopics = (st.told ? Object.keys(st.told) : []).filter((k) => k !== "fees").concat(topics.includes("fees") ? ["fees"] : []);
  const TOPIC_WORDS: Record<string, string> = { strategy: "strategy", returns: "target returns", minimum: "minimum investment", hold: "hold period", track: "track record", mountain: "Mountain Manor", alexo: "Alexo & Phoenix", risk: "risk", accredited: "accredited status", registered: "RRSP/TFSA", custody: "custody", distributions: "distributions", markets: "markets", team: "the team", reporting: "reporting", aum: "fund size", fees: "fees" };
  const interest = allTopics.length ? `Asked about ${[...new Set(allTopics)].map((t) => TOPIC_WORDS[t] ?? t).join(", ")}` : undefined;
  if (topics.length || Object.keys(learned).length) call("update_investor", { ...learned, interest });

  const yes = /^\s*(yes|yeah|yep|sure|ok|okay|please|sounds good|that works|perfect|definitely|absolutely)\b/.test(lower);
  const wantsCall = /\b(call|talk|speak|meet|meeting|chat with|zoom|book|schedule|interested|invest(ing)? with you|next step|sign up|get started)\b/.test(lower) && !/\bcall (it|them)\b/.test(lower);

  // ---------- accredited answer after booking ----------
  if (st.last === "accredited" && learned.accredited) {
    st.last = undefined;
    const msg = learned.accredited === "yes" ? "Great, I've noted that for Rodrigo." : "No problem, the dealer will go through that with you on the call.";
    return done(msg, "Is there anything else you'd like to know before you speak with him?");
  }

  // ---------- slot choice ----------
  if (st.offered && !st.booked && st.last === "slot") {
    const ord = lower.match(/\b(first|1st|earlier|second|2nd|later|other)\b|^\s*([12])\s*$/);
    let choice: Offered | undefined;
    if (ord) choice = st.offered[/first|1st|earlier|^1$/.test(ord[1] ?? ord[2]) ? 0 : 1];
    if (!choice) {
      const day = DAYS.find((d) => new RegExp(`\\b${d}`).test(lower)) ?? (/\btomorrow\b/.test(lower) ? "tomorrow" : undefined);
      if (day) choice = st.offered.find((o) => o.label.toLowerCase().startsWith(day === "tomorrow" ? day : DAYS_FULL[day]));
    }
    if (choice) st.chosen = choice;
    else if (yes) return done(`Great! Which works better, ${st.offered.map((o) => o.label).join(" or ")}?`);
  }

  // ---------- booking ----------
  if (st.chosen && !st.booked) {
    if (st.name && st.email) {
      const r = call("book_intro_call", { name: st.name, email: st.email, phone: st.phone, start_iso: st.chosen.start_iso });
      if (r.booked) {
        st.booked = st.chosen;
        st.last = st.accredited ? undefined : "accredited";
        return done(
          `You're booked with Rodrigo for ${r.when} (30 minutes). A calendar invite is on its way to ${st.email}.`,
          st.accredited ? "Is there anything else I can help with in the meantime?" : "One quick question so he can prepare: do you know if you're an accredited investor?",
        );
      }
      st.chosen = undefined;
      return done("Sorry, that time was just taken. Let me find you another one.");
    }
    st.last = "contact";
    if (!st.name && !st.email) return done(`Perfect, ${st.chosen.label}. What's your name and the best email for the calendar invite?`);
    if (!st.email) return done(`Thanks${st.name ? `, ${st.name.split(" ")[0]}` : ""}! What's the best email for the calendar invite?`);
    return done("Got it. And what name should I put on the invite?");
  }

  if (/^\s*(hi|hello|hey|good (morning|afternoon|evening))[\s!.,]*$/.test(lower)) {
    return done("Hi! Thanks for your interest in Triple Harbour Capital. I can answer questions about the fund and our track record, or set up a call with Rodrigo, our CEO. What would you like to know?");
  }
  if (/\b(thanks|thank you|thx)\b/.test(lower) && !answers.length && !wantsCall) {
    return done(st.booked ? `You're welcome! Rodrigo will talk to you ${friendlyWhen(st.booked.start_iso)}.` : "You're welcome! Let me know if anything else comes up.");
  }

  // ---------- next step ----------
  let next: string | undefined;
  if (st.booked) {
    if (!answers.length) next = "Is there anything else you'd like to know before your call?";
  } else if (wantsCall || (yes && st.last === "call")) {
    const r = call("get_intro_call_times", {});
    const slots = (r.slots as Offered[]).slice(0, 2);
    if (slots.length) {
      st.offered = slots;
      st.last = "slot";
      next = `Rodrigo has ${slots.map((s) => s.label).join(" or ")} open for a 30-minute intro call. Would either work?`;
    }
  } else if (!answers.length && /\?/.test(text)) {
    call("escalate_to_human", { reason: `Investor question: "${text.slice(0, 120)}"`, urgency: "normal" });
    answers.push("I don't want to give you a half answer on that, so I've passed it to Rodrigo and he'll get back to you.");
  } else if ((st.asked.call ?? 0) < 2 && (answers.length || st.asked.call === undefined)) {
    next = st.asked.call ? "Would a 30-minute intro call with Rodrigo be useful?" : "Would it help to book a quick intro call with Rodrigo? He can go through the offering documents with you.";
    st.asked.call = (st.asked.call ?? 0) + 1;
    st.last = "call";
  }
  if (!answers.length && !next) next = "What else would you like to know about the fund?";
  return done(...answers.slice(0, 2), answers.length > 2 ? answers.slice(2).join(" ") : undefined, next);
}

// ---------------------------------------------------------------- prospects

function unitFor(beds?: number) {
  const units = db().units.filter((u) => u.status !== "leased");
  return units.find((u) => u.beds === beds) ?? units[0];
}

function prospect(sess: Session, raw: string) {
  const st = sess.offline as ProspectState;
  st.asked ??= {};
  st.told ??= {};
  const text = raw.trim();
  const lower = text.toLowerCase();
  const seed = sess.transcript.length;
  const actions: ToolAction[] = [];
  const call = (name: string, input: Record<string, unknown>) => {
    const r = runTool(sess, name, input);
    actions.push(r.action);
    return JSON.parse(r.content);
  };

  // ---------- learn ----------
  const learned: Record<string, unknown> = {};
  const expectingName = st.last === "contact" || st.last === "name";
  const name = extractName(text, expectingName);
  if (name && (!st.name || expectingName)) learned.name = st.name = name;
  const phone = extractPhone(text);
  if (phone) learned.phone = st.phone = phone;
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  if (email) learned.email = st.email = email;

  let beds: 1 | 2 | undefined;
  if (/\b(2|two)[\s-]*(bed|br|bdr|bedroom|bdrm)/.test(lower) || /\b2\s?b(r|d)?\b/.test(lower)) beds = 2;
  else if (/\b(1|one|single)[\s-]*(bed|br|bdr|bedroom|bdrm)/.test(lower) || /\b1\s?b(r|d)?\b/.test(lower)) beds = 1;
  else if (st.last === "beds" && /^\s*(2|two|the (2|two)|second|bigger|larger)\b/.test(lower)) beds = 2;
  else if (st.last === "beds" && /^\s*(1|one|the (1|one)|first|smaller)\b/.test(lower)) beds = 1;
  const bedsChanged = beds && beds !== st.beds;
  if (beds) {
    st.beds = beds;
    learned.bedrooms = beds;
    learned.unit_interest = unitFor(beds)?.id;
  }
  const moveIn = extractMoveIn(lower);
  if (moveIn && !(st.last === "slot" && !/move|moving|start|lease|need/.test(lower))) {
    st.moveIn = moveIn;
    learned.move_in_date = moveIn;
  }
  const petMatch = lower.match(/\b(cats?|dogs?|puppy|kitten|pets?)\b/);
  const hasPet = petMatch && !/\bno (pets|cats|dogs)\b/.test(lower) && /\b(have|got|with|my|our|own|bringing)\b/.test(lower);
  if (hasPet) learned.pets = lower.match(/\b(a|one|two|\d)?\s*(cats?|dogs?|puppy|kitten)\b/)?.[0]?.trim() ?? "pet";
  const budget = moneyNear(lower, /budget|max|under|up to|afford/);
  if (budget) learned.budget = budget;
  const income = moneyNear(lower, /income|make|earn|salary|bring home/);
  if (income) learned.income_monthly = income;
  if (/just me|myself|only me|by myself|alone/.test(lower)) learned.occupants = 1;
  else if (/(me and my|with my|my (partner|wife|husband|girlfriend|boyfriend|roommate))/.test(lower)) learned.occupants = 2;
  if (Object.keys(learned).length) call("update_lead", learned);

  // ---------- intents ----------
  const yes = /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|sounds good|that works|perfect|definitely|absolutely|for sure|y)\b/.test(lower);
  const no = /^\s*(no|nope|not (yet|really|now)|maybe later|neither|none)\b/.test(lower) || /\b(neither|none of (those|them)|doesn'?t work|don'?t work|can'?t make)\b/.test(lower);
  const thanks = /\b(thanks|thank you|thx|ty|appreciate)\b/.test(lower);
  const greetingOnly = /^\s*(hi|hello|hey|good (morning|afternoon|evening)|bonjour)[\s!.,]*$/.test(lower);
  const wantsViewing = /\b(view|viewing|tour|show(ing)?|see (it|the|a|them|this|that)|come (by|see|look)|visit|look at|check (it|out)|book|appointment|when can i)\b/.test(lower);
  const asksAvail = /\bavail|\bvacan|\bstill (up|open|there|for rent)\b|\bis (this|it) (still )?(up|open)\b|\bany (units|suites|apartments|openings)\b/.test(lower);
  const asksPrice = /\b(how much|rent|price|cost|per month|a month|monthly)\b/.test(lower) && !/\brent(ing|al)? history\b/.test(lower);
  const wantsHuman = /\b(human|real person|talk to (someone|a person|an agent)|manager|call me|phone call|speak to)\b/.test(lower);
  const negotiate = /\b(negotiat|discount|lower the rent|deal on|cheaper|incentive|move-in special|promo)\b/.test(lower);

  const answers: string[] = [];
  let unitTold = false;

  // ---------- slot choice / rejection ----------
  if (st.offered && !st.booked && st.last === "slot") {
    let choice: Offered | undefined;
    const ord = lower.match(/\b(first|1st|earlier|former|second|2nd|later|latter|other)\b|^\s*([12])\s*$/);
    if (ord) choice = st.offered[/first|1st|earlier|former|^1$/.test(ord[1] ?? ord[2]) ? 0 : 1];
    if (!choice) {
      const day = DAYS.find((d) => new RegExp(`\\b${d}`).test(lower)) ?? (/\btomorrow\b/.test(lower) ? "tomorrow" : /\btoday\b/.test(lower) ? "today" : undefined);
      const hour = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
      choice = st.offered.find((o) => {
        const l = o.label.toLowerCase();
        if (day && !l.startsWith(day === "tomorrow" || day === "today" ? day : DAYS_FULL[day])) return false;
        if (hour && !hour[0].includes(",") && !extractPhone(text)) {
          const hh = Number(hour[1]);
          const lp = local(o.start_iso);
          const h12 = ((lp.h + 11) % 12) + 1;
          if (hh !== h12) return false;
          if (hour[2] && Number(hour[2]) !== lp.min) return false;
        }
        return !!(day || (hour && !extractPhone(text)));
      });
    }
    if (!choice && yes && st.offered.length === 1) choice = st.offered[0];
    if (choice) st.chosen = choice;
    else if (yes && st.offered.length > 1) {
      st.last = "slot";
      return done(`Great! Which works better for you, ${st.offered[0].label} or ${st.offered[1].label}?`);
    } else if (no) {
      const more = offerSlots(lower, true);
      if (more) return done(`No problem. How about ${more}? Or let me know a day that suits you better and I'll find something.`);
      return done("No problem. What day works best for you? I'll check what's open.");
    }
  }

  // ---------- booking ----------
  if (st.chosen && !st.booked) {
    if (st.name && st.phone) {
      const unit = unitFor(st.beds);
      const r = call("book_showing", { name: st.name, phone: st.phone, email: st.email, unit_id: unit.id, start_iso: st.chosen.start_iso, notes: learned.pets ? `Has ${learned.pets}` : undefined });
      if (r.booked) {
        st.booked = st.chosen;
        st.last = undefined;
        const first = st.name.split(" ")[0];
        return done(
          `You're all set, ${first}! I've booked you in to see suite #${unit.number} on ${longWhen(st.chosen.start_iso)}.`,
          `It's at 9107 88 Ave NW and someone from our leasing team will meet you at the front entrance. You'll get a text confirmation shortly, and a reminder a couple of hours before.`,
        );
      }
      st.chosen = undefined;
      const more = offerSlots(lower, true);
      return done(`Ah, sorry, that time was just taken. ${more ? `I can do ${more}. Would one of those work?` : "What other day works for you?"}`);
    }
    st.last = !st.name && !st.phone ? "contact" : !st.phone ? "phone" : "name";
    const when = st.chosen.label;
    st.asked.contact = (st.asked.contact ?? 0) + 1;
    if (!st.name && !st.phone && st.asked.contact > 1) return done("Sorry, I just need your name and a phone number to hold the spot for you.");
    if (!st.name && !st.phone) return done(`Perfect, ${when} it is. What's your name and the best number to text the confirmation to?`);
    if (!st.phone) return done(`Thanks${st.name ? `, ${st.name.split(" ")[0]}` : ""}! What's the best number to text the confirmation to?`);
    return done("Got it. And what name should I put the viewing under?");
  }

  // ---------- small talk ----------
  if (greetingOnly) {
    st.last = "beds";
    st.asked.beds = (st.asked.beds ?? 0) + 1;
    return done(pick(["Hi there! Thanks for reaching out about Bonnie Doon Manor. Are you looking for a 1 or 2 bedroom?", "Hey! Thanks for your interest in Bonnie Doon Manor. Are you after a 1 bedroom or a 2 bedroom?"], seed));
  }
  if (thanks && !wantsViewing && !asksAvail && !/\?/.test(text)) {
    if (st.booked) return done(`You're welcome! See you ${friendlyWhen(st.booked.start_iso)}. If anything changes, just message here.`);
    return done("You're welcome! Let me know if there's anything else I can help with.");
  }

  // ---------- availability / price ----------
  if (asksAvail || asksPrice || bedsChanged) {
    if (!st.beds) {
      const units = call("search_units", {}).units as Array<{ bedrooms: number; rent: number; available_from: string }>;
      const one = units.find((u) => u.bedrooms === 1);
      const two = units.find((u) => u.bedrooms === 2);
      if (one && two) answers.push(`Yes! We have two suites open right now: a 1 bedroom at $${one.rent.toLocaleString()} that's ready ${one.available_from === "now" ? "now" : one.available_from}, and a 2 bedroom at $${two.rent.toLocaleString()} that's ready ${two.available_from === "now" ? "now" : two.available_from}. Heat and water are included in both.`);
      unitTold = true;
    } else {
      const u = (call("search_units", { bedrooms: st.beds }).units as Array<{ suite: string; rent: number; available_from: string; sqft: number }>)[0];
      if (u && st.told![`unit${st.beds}`] && !bedsChanged) {
        answers.push(asksPrice && !asksAvail ? `It's $${u.rent.toLocaleString()} a month, heat and water included.` : "Yes, it's still available!");
      } else if (u) {
        st.told![`unit${st.beds}`] = true;
        const ready = u.available_from === "now" ? "it's ready to move in now" : `it'll be ready ${u.available_from}`;
        answers.push(
          st.beds === 2
            ? `${asksAvail ? "Yes, it's still available! " : ""}The 2 bedroom is $${u.rent.toLocaleString()} a month with heat and water included. It's on the top floor and getting the last of its renovations, so ${ready}.`
            : `${asksAvail ? "Yes, it's still available! " : ""}The 1 bedroom is $${u.rent.toLocaleString()} a month with heat and water included, and ${ready}. It's about ${u.sqft} sq ft with a renovated kitchen.`,
        );
      } else answers.push(`The ${st.beds} bedroom was just rented, unfortunately. I can add you to the list for the next one that opens up.`);
      unitTold = true;
    }
  }

  // ---------- move-in date reaction ----------
  if (learned.move_in_date && st.beds) {
    const unit = unitFor(st.beds);
    const ready = unit.availableFrom ? new Date(unit.availableFrom) : new Date();
    const want = new Date(`${learned.move_in_date}T12:00:00-06:00`);
    const today = local(new Date());
    const isToday = learned.move_in_date === `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;
    if (isToday && unit.status === "vacant") answers.push("Good news, it's ready now, so you could move in as soon as your application is approved.");
    else if (want >= ready || unit.status === "vacant") answers.push(`${monthDay(want.toISOString())} works well, the suite will be ready by then.`);
    else answers.push(`Just so you know, the 2 bedroom won't be ready until ${monthDay(ready.toISOString())}. Would that work for you?`);
  } else if (learned.move_in_date && !unitTold) {
    answers.push(`Got it, ${monthDay(new Date(`${learned.move_in_date}T12:00:00-06:00`).toISOString())}.`);
  }

  // ---------- FAQs ----------
  const faq = (key: string, re: RegExp, answer: string) => {
    if (re.test(lower)) {
      answers.push(answer);
      st.told![key] = true;
    }
  };
  if (petMatch && !/\bno (pets|cats|dogs)\b/.test(lower)) {
    const kind = /dog|puppy/.test(lower) ? "Dogs are" : /cat|kitten/.test(lower) ? "Cats are" : "Cats and dogs are both";
    answers.push(`${kind} welcome! There's a $300 refundable pet deposit and no monthly pet rent.`);
  }
  faq("parking", /\b(park|parking|stall|plug.?in|car)\b/, "Yes, each suite can have an assigned stall in the back lot, and they're plugged in for winter.");
  faq("laundry", /\b(laundry|washer|dryer)\b/, /in.?suite/.test(lower) ? "There's no in-suite washer and dryer, but there's coin laundry in the building." : "There's coin laundry right in the building.");
  faq("utilities", /\b(utilit\w*|heat|hydro|electric\w*|power bill|water included|what'?s included|anything included|bills)\b/, "Heat and water are included. You'd just set up electricity, which usually runs about $45 to $70 a month.");
  faq("internet", /\b(internet|wifi|wi-fi|cable)\b/, "Internet isn't included, so you can go with whichever provider you like.");
  faq("deposit", /\b(deposit|damage deposit|security)\b/, "The security deposit is between $750 and $900 depending on the suite.");
  faq("apply", /\b(apply|application|requirements?|qualify|credit|reference)\b/, "Applying is quick: a short online form, photo ID, a credit check and one landlord reference.");
  faq("income", /\b(income|how much do i need to make|salary|co-?signer|guarantor)\b/, "We generally look for household income of around 2.5 times the rent, and co-signers are welcome.");
  faq("transit", /\b(lrt|train|transit|bus|downtown|commute)\b/, "The Bonnie Doon LRT stop is about a 10-minute walk, and downtown is roughly 15 minutes from there on the train.");
  faq("uni", /\b(university|u of a|uofa|ualberta|campus|school|student)\b/, "Campus Saint-Jean is about a 4-minute walk, and the U of A main campus is about 10 minutes by car.");
  faq("shops", /\b(grocer|shopping|safeway|mall|stores?)\b/, "Bonnie Doon Centre with Safeway and Shoppers is about a 12-minute walk.");
  faq("area", /\b(neighbou?rhood|area|safe|quiet|location|where is it|where is this)\b/, "It's a quiet, established neighbourhood in the French Quarter, close to the river valley trails, and the building has controlled entry and video surveillance.");
  faq("lease", /\b(lease|month.to.month|short.term|how long|6 months|six months)\b/, "Leases are 12 months to start.");
  faq("furnished", /\b(furnish|furniture)\b/, "The suites come unfurnished, but the fridge and stove are included.");
  faq("smoking", /\b(smok|vape|cannabis|weed)\b/, "It's a non-smoking building, including the balconies.");
  faq("size", /\b(sq|square|size|big|how large)\b/, "The 1 bedroom is about 610 sq ft and the 2 bedroom is about 820 sq ft.");
  faq("balcony", /\bbalcon/, "Yes, the suites have balconies.");
  faq("storage", /\bstorage\b/, "There's storage available in the building as well.");
  faq("elevator", /\b(elevator|lift|stairs|accessib|wheelchair)\b/, "It's a three-storey walk-up without an elevator. If you need an accessible suite, I'll let the team know so they can talk through options.");

  if (negotiate) {
    call("escalate_to_human", { reason: "Prospect asked about rent flexibility / incentives", urgency: "normal" });
    answers.push("I'm not able to change the rent myself, but I've passed your question on to the leasing manager and they'll get back to you.");
  }
  if (wantsHuman) {
    call("escalate_to_human", { reason: "Prospect asked to speak with a person", urgency: "normal" });
    st.escalated = true;
    answers.push(st.phone ? "Of course. I've asked someone from our leasing team to give you a call." : "Of course. I've asked someone from our leasing team to reach out to you.");
    if (!st.phone) {
      st.last = "phone";
      return done(answers.join(" "), "What's the best number for them to call?");
    }
  }

  // ---------- unknown question ----------
  if (!answers.length && !wantsViewing && /\?/.test(text) && !yes && !no) {
    call("escalate_to_human", { reason: `Unanswered question: "${text.slice(0, 120)}"`, urgency: "normal" });
    answers.push("I'm not 100% sure on that one, so I've asked the leasing team to confirm and get back to you.");
  }

  // ---------- next step (one question) ----------
  let next: string | undefined;
  if (st.booked) {
    if (!answers.length) next = "Is there anything else you'd like to know before your viewing?";
  } else if (wantsViewing || (yes && st.last === "viewing")) {
    const offer = offerSlots(lower, false);
    next = offer ? `I have ${offer} open. Would either of those work?` : "What day works best for you? I'll check what's open.";
  } else if (no && st.last === "viewing") {
    next = "No problem at all. Just message here whenever you'd like to see it.";
    st.last = undefined;
  } else if (st.offered && st.last === "slot") {
    next = `Did ${st.offered.length > 1 ? `${st.offered[0].label} or ${st.offered[1].label}` : st.offered[0].label} work for you?`;
  } else if (!st.beds && (st.asked.beds ?? 0) < 2) {
    next = unitTold ? "Which one are you interested in?" : "Are you looking for a 1 or 2 bedroom?";
    st.last = "beds";
    st.asked.beds = (st.asked.beds ?? 0) + 1;
  } else if (st.beds && !st.moveIn && !st.asked.movein) {
    next = "When are you hoping to move in?";
    st.last = "movein";
    st.asked.movein = 1;
  } else if ((st.asked.viewing ?? 0) < 2) {
    next = st.asked.viewing ? "Would you like me to book you in for a viewing?" : pick(["Would you like to come see it? I can usually fit you in within a day or two.", "Want to come take a look? I can set up a viewing this week."], seed);
    st.last = "viewing";
    st.asked.viewing = (st.asked.viewing ?? 0) + 1;
  }

  if (!answers.length && !next) next = "Let me know if there's anything else I can help with!";
  const grouped = answers.length > 3 ? [answers.slice(0, 2).join(" "), answers.slice(2).join(" ")] : answers;
  return done(...grouped, next);

  // ---------- helpers ----------
  function offerSlots(l: string, more: boolean): string | undefined {
    const t = local(new Date());
    const dayIdx = DAYS.findIndex((d) => new RegExp(`\\b${d}`).test(l));
    let from = 0;
    if (/\btomorrow\b/.test(l)) from = 1;
    else if (/\b(weekend|saturday)\b/.test(l)) from = (6 - t.dow + 7) % 7;
    else if (dayIdx >= 0) from = (dayIdx - t.dow + 7) % 7;
    const specific = from > 0 || /\btoday\b/.test(l);
    const r = call("get_showing_slots", { days_from_today: from, days: specific ? 1 : 5 });
    const seen = new Set(st.seen ?? []);
    const all = (r.slots as Offered[]).filter((s) => !more || !seen.has(s.start_iso));
    if (!all.length) return undefined;
    let chosen: Offered[];
    if (specific) chosen = [all[0], all[all.length - 1]];
    else {
      // One sooner option and one evening/weekend option on a different day.
      const firstDay = local(all[0].start_iso).d;
      const later = all.find((s) => local(s.start_iso).d !== firstDay && (local(s.start_iso).h >= 17 || local(s.start_iso).dow === 6)) ?? all.find((s) => local(s.start_iso).d !== firstDay);
      chosen = [all[0], later ?? all[all.length - 1]];
    }
    chosen = chosen.filter((s, i, a) => s && a.findIndex((x) => x.start_iso === s.start_iso) === i);
    st.offered = chosen;
    st.seen = [...seen, ...chosen.map((c) => c.start_iso)];
    st.last = "slot";
    if (chosen.length < 2) return chosen[0].label;
    const [a, b] = chosen.map((c) => c.label);
    const sameDay = a.split(" at ")[0] === b.split(" at ")[0];
    return sameDay ? `${a} or ${b.split(" at ")[1]}` : `${a} or ${b}`;
  }

  function done(...bubbles: (string | undefined)[]) {
    return { reply: bubbles.filter((b) => b && b.trim()).join("\n\n"), actions };
  }
}

const DAYS_FULL: Record<string, string> = { sun: "sunday", mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday", fri: "friday", sat: "saturday" };

// ---------------------------------------------------------------- tenants

interface TenantState {
  unit?: string;
  name?: string;
  issue?: string;
  category?: string;
  urgency?: "emergency" | "urgent" | "routine";
  permission?: boolean;
  verified?: boolean;
  woDone?: boolean;
  awaiting?: "issue" | "unit" | "name" | "permission";
}

const EMERGENCY = /(drip|dripping|water|leak).*ceiling|ceiling.*(drip|water|leak)|no heat|heat(ing)? (is )?(out|off|not working|broke)|radiator.*(cold|not)|freezing|flood|burst|pouring|water (everywhere|coming)|sewer|back(ed)? ?up|gas|smoke|fire|no power|sparks|locked out/;
const URGENT = /fridge|refrigerator|freezer|stove|oven|hot water|toilet.*(not flush|won'?t flush|clog|overflow|block)|(clog|block).*toilet|mice|mouse|cockroach|roach|bed ?bug/;

function categorize(lower: string): string {
  if (/heat|radiator|freezing|cold/.test(lower)) return "Heating";
  if (/leak|water|flood|drip|tap|faucet|sink|toilet|drain|clog|pipe|sewer|shower/.test(lower)) return "Plumbing";
  if (/fridge|refrigerator|freezer|stove|oven|dishwasher|microwave/.test(lower)) return "Appliance";
  if (/power|outlet|breaker|light|spark|electric/.test(lower)) return "Electrical";
  if (/door|lock|key|latch/.test(lower)) return "Doors & locks";
  if (/mice|mouse|roach|bug|pest|ant/.test(lower)) return "Pests";
  if (/window|blind/.test(lower)) return "Windows";
  return "General";
}

/** Strip greetings, names and suite numbers so the work order reads like a dispatcher wrote it. */
function cleanIssue(text: string): string {
  const t = text
    .replace(/\s+/g, " ")
    .replace(/^(hi|hello|hey|good (morning|afternoon|evening))[,!.\s]*/i, "")
    .replace(/\b(this is|it's|it is|i'm|i am|my name is)\s+[A-Z][\p{L}'-]+(\s+[A-Z][\p{L}'-]+)?/u, "")
    .replace(/\b(in|from|at)?\s*(suite|unit|apt|apartment|#)?\s*#?\d{3}\b[,.]?/i, "")
    .replace(/^[\s,.\-–]+/, "")
    .trim();
  const out = t || text.trim();
  return (out.charAt(0).toUpperCase() + out.slice(1)).slice(0, 110);
}

const CREW_WORDS: Record<string, string> = {
  "vendor-plumbing": "our on-call plumber",
  "crew-a": "our maintenance team",
  "crew-b": "our renovation crew",
};

const TIPS: Record<string, string> = {
  Plumbing: "In the meantime, put a bucket or some towels under it and move anything valuable out of the way. If you can see a shut-off valve under the sink or behind the toilet, turning it off will help.",
  Heating: "In the meantime, keep your interior doors open so the warm air can move around, and let us know if any pipes look frosty.",
  Appliance: "In the meantime, try to keep the fridge door closed as much as you can. Food usually stays safe for about 4 hours.",
  Electrical: "In the meantime, please don't use that outlet or switch until it's been checked.",
};

function tenant(sess: Session, text: string) {
  const st = sess.offline as TenantState;
  const lower = text.toLowerCase();
  const actions: ToolAction[] = [];
  const call = (name: string, input: Record<string, unknown>) => {
    const r = runTool(sess, name, input);
    actions.push(r.action);
    return JSON.parse(r.content);
  };
  const out = (...b: string[]) => ({ reply: b.filter(Boolean).join("\n\n"), actions });
  const pre: string[] = [];

  if (st.woDone) {
    if (/thank|thx|great|perfect|ok|okay|appreciate/.test(lower)) return out("You're welcome! If anything changes or gets worse, just message here, day or night.");
    Object.assign(st, { woDone: false, issue: undefined, urgency: undefined, permission: undefined, category: undefined });
  }

  const unit = lower.match(/(?:#|suite|unit|apt|apartment|room)\s*(\d{3})\b/)?.[1] ?? lower.match(/\b([1-3]0[1-7])\b/)?.[1];
  if (unit) st.unit = unit;
  const asked = st.awaiting === "name" || st.awaiting === "unit";
  // A capitalized "First Last" anywhere in the message counts as a name even before we ask for it
  // ("Water is dripping from my ceiling. Chloe Lavoie, suite 204").
  const fullName = [...text.matchAll(/\b([A-Z][\p{L}'-]+)\s+([A-Z][\p{L}'-]+)\b/gu)].find((m) => !NOT_NAMES.test(m[1]) && !NOT_NAMES.test(m[2]));
  const name = extractName(text, asked) ?? (fullName ? `${fullName[1]} ${fullName[2]}` : undefined);
  if (name && (!st.name || asked)) st.name = name;

  if (st.awaiting === "permission" && st.permission === undefined) {
    if (/\b(yes|yeah|yep|sure|ok|okay|fine|go ahead|that's fine|of course|no problem)\b/.test(lower)) st.permission = true;
    else if (/\b(no|nope|rather|prefer|i'll be|i will be|be home|be there)\b/.test(lower)) st.permission = false;
  }

  const describesIssue = EMERGENCY.test(lower) || URGENT.test(lower) || /leak|drip|broken|not working|doesn'?t work|won'?t|clog|noise|stuck|crack|damage|problem|issue|loose|squeak/.test(lower);
  if (describesIssue && !st.issue) {
    st.issue = cleanIssue(text);
    st.category = categorize(lower);
    st.urgency = EMERGENCY.test(lower) ? "emergency" : URGENT.test(lower) ? "urgent" : "routine";
    if (/gas|smoke|fire/.test(lower)) pre.push("Please leave your suite right away and call 911. If you smell gas, don't use light switches or anything with a flame. I'm getting our on-call team out at the same time.");
  }

  if (!st.issue) {
    st.awaiting = "issue";
    return out(/^\s*(hi|hello|hey)/.test(lower) ? "Hi! This is the Bonnie Doon Manor maintenance line. What's going on in your suite?" : "Sorry, I didn't quite catch that. Can you tell me what the problem is?");
  }
  if (!st.unit || !st.name) {
    const first = st.awaiting !== "unit" && st.awaiting !== "name";
    st.awaiting = st.unit ? "name" : "unit";
    const ack = !first ? "Thanks." : st.urgency === "emergency" ? "Okay, that needs attention right away." : "Oh no, sorry about that. Let's get it fixed.";
    const ask = !st.unit && !st.name ? "What's your suite number and your name?" : !st.unit ? "Which suite are you in?" : "And can I get your name?";
    return out(...pre, `${ack} ${ask}`);
  }
  if (!st.verified) {
    call("verify_tenant", { unit_number: st.unit, name: st.name });
    st.verified = true;
  }
  if (st.urgency !== "emergency" && st.permission === undefined) {
    st.awaiting = "permission";
    const when = st.urgency === "urgent" ? "within 24 hours" : "within the next few business days";
    return out(...pre, `Thanks ${st.name.split(" ")[0]}. We'll get someone out ${when}. If you're not home, is it okay for them to let themselves in?`);
  }

  const unitRow = db().units.find((u) => u.number === st.unit);
  // Work order titles read like a dispatcher wrote them: no tenant name, suite or trailing punctuation.
  const issueTitle = st.issue
    .split(st.name)
    .join("")
    .replace(/[\s,.;:!-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const r = call("create_work_order", {
    unit_number: st.unit,
    tenant_name: st.name,
    phone: unitRow?.tenantPhone,
    category: st.category,
    issue: issueTitle || st.issue,
    urgency: st.urgency,
    permission_to_enter: st.urgency === "emergency" ? true : st.permission,
  });
  st.woDone = true;
  st.awaiting = undefined;
  if (r.error) return out("Sorry, I couldn't book that in. I've flagged it for the team and someone will call you shortly.");

  const wo = db().workOrders.find((w) => w.id === r.work_order);
  const who = CREW_WORDS[wo?.resource ?? "crew-a"];
  const when = friendlyWhen(r.arrival_iso);
  const main =
    st.urgency === "emergency"
      ? `Okay, ${who} is on the way. They should be there by ${when.replace(/^today at /, "")}, and they'll text you when they're close.`
      : `You're booked: ${who} will come by ${when}.${st.permission ? " Since it's okay to go in, you don't need to be home." : " They'll knock, so please make sure someone's home."}`;
  const tip = /ceiling|leak|flood|pouring|burst/.test(st.issue.toLowerCase())
    ? TIPS.Plumbing
    : /toilet/.test(st.issue.toLowerCase())
      ? "In the meantime, you can turn the small valve behind the toilet clockwise to shut the water off until we get there."
      : /tap|faucet|sink/.test(st.issue.toLowerCase())
        ? "If it gets worse before then, the shut-off valves under the sink will stop the water."
        : st.category === "Plumbing"
          ? ""
          : (TIPS[st.category ?? ""] ?? "");
  return out(...pre, main, tip, `Your reference number is ${r.work_order}.`);
}
