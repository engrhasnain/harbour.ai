"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BatteryFull, ChevronLeft, Signal, Wifi } from "lucide-react";
import type { Persona } from "@/lib/types";
import type { Bubble } from "./useConversation";

/** An iPhone-style SMS thread. The conversation state lives in the parent (useConversation). */
export function PhoneChat({
  contact,
  number,
  bubbles,
  typing,
  busy,
  onSend,
  persona,
}: {
  contact: string;
  number: string;
  bubbles: Bubble[];
  typing: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  persona: Persona;
}) {
  const [input, setInput] = useState("");
  const [clock, setClock] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[ap]\.?m\.?/i, ""));
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, typing]);

  const firstTs = bubbles[0]?.ts;
  return (
    <div className="mx-auto w-[340px] shrink-0 rounded-[46px] bg-neutral-900 p-[10px] shadow-2xl shadow-navy-900/30">
      <div className="relative flex h-[660px] flex-col overflow-hidden rounded-[37px] bg-white">
        {/* status bar */}
        <div className="flex items-center justify-between px-7 pb-1 pt-3 text-[13px] font-semibold text-black">
          <span>{clock}</span>
          <span className="absolute left-1/2 top-2.5 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-1">
            <Signal size={13} />
            <Wifi size={13} />
            <BatteryFull size={16} />
          </span>
        </div>

        {/* contact header */}
        <div className="flex flex-col items-center border-b border-neutral-200 bg-neutral-50/90 pb-2 pt-1">
          <div className="flex w-full items-center px-3">
            <ChevronLeft size={22} className="text-[#0a7cff]" />
          </div>
          <div className="-mt-4 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-neutral-400 to-neutral-500 text-sm font-semibold text-white">{contact.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
          <div className="mt-1 text-[12px] font-medium text-black">{contact}</div>
          <div className="text-[10px] text-neutral-500">{number}</div>
        </div>

        {/* thread */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-2 text-center text-[10px] font-medium text-neutral-400">
            Text Message
            <br />
            Today {firstTs ? new Date(firstTs).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" }) : ""}
          </div>
          <div className="space-y-1">
            {bubbles.map((b, i) => {
              const mine = b.role === "user";
              const next = bubbles[i + 1];
              const tail = !next || next.role !== b.role;
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"} ${tail ? "pb-1.5" : ""}`}>
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap px-3 py-[7px] text-[14px] leading-[1.3] ${
                      mine ? `bg-[#34c759] text-white ${tail ? "rounded-[18px] rounded-br-[5px]" : "rounded-[18px]"}` : `bg-[#e9e9eb] text-black ${tail ? "rounded-[18px] rounded-bl-[5px]" : "rounded-[18px]"}`
                    }`}
                  >
                    {b.staff && <div className="mb-0.5 text-[10px] font-semibold text-emerald-700">{persona === "tenant" ? "Maintenance team" : "Leasing team"}</div>}
                    {b.text}
                  </div>
                </div>
              );
            })}
            {typing && (
              <div className="flex justify-start">
                <div className="typing flex gap-1 rounded-[18px] bg-[#e9e9eb] px-3.5 py-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* composer */}
        <form
          className="flex items-center gap-2 px-3 pb-6 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            onSend(input);
            setInput("");
          }}
        >
          <div className="flex flex-1 items-center rounded-full border border-neutral-300 pl-3.5 pr-1">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text Message" className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-black outline-none placeholder:text-neutral-400" />
            <button disabled={!input.trim() || busy} className="grid h-7 w-7 place-items-center rounded-full bg-[#34c759] text-white disabled:bg-neutral-300">
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
        <div className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}
