"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Compass, Minus } from "lucide-react";

interface Step {
  title: string;
  href: string;
  say: string;
  todo: string;
}

const STEPS: Step[] = [
  {
    title: "The problem",
    href: "/",
    say: "Bonnie Doon is 18 of 20. Those two empty suites cost about $90 a day, and a big share of renter inquiries come in at night when nobody's at a desk.",
    todo: "Point at occupancy, vacancy cost and the after-hours number.",
  },
  {
    title: "A renter texts the building at night",
    href: "/live?as=prospect",
    say: "This is the building's own phone number. The assistant answers in seconds, like your best leasing agent would.",
    todo: "Tap the prompts under the phone, top to bottom.",
  },
  {
    title: "It lands in the tools they already use",
    href: "/live?as=prospect",
    say: "The viewing is on the leasing calendar, the team got an email, and the lead is in the sheet. Nothing new to learn.",
    todo: "Point at the green NEW items on the right, then open the calendar.",
  },
  {
    title: "A listing-site email gets answered",
    href: "/inbox",
    say: "Kijiji and Rentals.ca inquiries arrive by email. They get a proper answer in seconds, day or night.",
    todo: "Click “New Kijiji / Rentals.ca inquiry” and read the reply.",
  },
  {
    title: "The team can step in any time",
    href: "/leads",
    say: "Nothing is a black box. Your team sees every conversation and can take over with one message.",
    todo: "Open a lead, type a reply as the team, show it in the conversation.",
  },
  {
    title: "A tenant reports a leak",
    href: "/live?as=tenant",
    say: "Same number, a tenant this time. It sorts out how urgent it is and books the right crew. Emergencies go straight to on-call.",
    todo: "Tap the leak prompt, then show the work order in the sheet.",
  },
  {
    title: "Investors get answers too",
    href: "/investors",
    say: "Prospective investors ask about the fund at any hour. Answers stay inside the compliance rules, and intro calls land on Rodrigo's calendar.",
    todo: "Ask “What returns do you target?”, then “Can I book a call with Rodrigo?”.",
  },
  {
    title: "Reports write themselves",
    href: "/inbox?folder=reports",
    say: "On the 1st, the property report lands in Alvaro's inbox. At quarter end, the LP update is drafted from the numbers, ready for compliance.",
    todo: "Open the LP update email, then the attached report.",
  },
  {
    title: "No rip-and-replace",
    href: "/workflows",
    say: "All of this runs on your existing phone number, calendars, inbox and rent roll. We add a thin layer, we don't replace anything.",
    todo: "Show the automations page and open questions.",
  },
];

function load(): { step: number; open: boolean } {
  try {
    const raw = localStorage.getItem("demo-guide");
    if (raw) return JSON.parse(raw);
  } catch {
    // storage unavailable
  }
  return { step: 0, open: false };
}

export function DemoGuide() {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<{ step: number; open: boolean } | null>(null);

  useEffect(() => setState(load()), []);
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem("demo-guide", JSON.stringify(state));
    } catch {
      // storage unavailable
    }
  }, [state]);

  if (!state) return null;
  const s = STEPS[state.step];
  const here = path === s.href.split("?")[0];

  if (!state.open) {
    return (
      <button onClick={() => setState({ ...state, open: true })} className="no-print fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-navy-800">
        <Compass size={16} /> Demo guide · {state.step + 1}/{STEPS.length}
      </button>
    );
  }

  const go = (i: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, i));
    setState({ ...state, step: next });
    router.push(STEPS[next].href);
  };

  return (
    <div className="no-print fixed bottom-5 right-5 z-30 w-[330px] overflow-hidden rounded-xl border border-sand-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-navy-900 px-4 py-2.5 text-white">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Compass size={15} /> Demo guide
        </div>
        <div className="flex items-center gap-3 text-xs text-white/70">
          {state.step + 1} / {STEPS.length}
          <button onClick={() => setState({ ...state, open: false })} className="rounded p-0.5 hover:bg-white/10" title="Minimize">
            <Minus size={14} />
          </button>
        </div>
      </div>
      <div className="flex gap-1 px-4 pt-3">
        {STEPS.map((_, i) => (
          <button key={i} onClick={() => go(i)} className={`h-1 flex-1 rounded-full ${i <= state.step ? "bg-navy-800" : "bg-sand-200"}`} title={STEPS[i].title} />
        ))}
      </div>
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="font-semibold text-navy-900">{s.title}</div>
        <div className="rounded-lg bg-sand-50 p-3 text-[13px] leading-relaxed text-slate-700">
          <span className="font-semibold text-navy-900">Say: </span>
          {s.say}
        </div>
        <div className="text-[13px] text-slate-600">
          <span className="font-semibold text-navy-900">Do: </span>
          {s.todo}
        </div>
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => go(state.step - 1)} disabled={state.step === 0} className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900 disabled:opacity-30">
            <ChevronLeft size={15} /> Back
          </button>
          {!here && (
            <button onClick={() => router.push(s.href)} className="text-sm font-medium text-navy-900 underline underline-offset-2">
              Go to page
            </button>
          )}
          <button onClick={() => go(state.step + 1)} disabled={state.step === STEPS.length - 1} className="flex items-center gap-1 rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-30">
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
