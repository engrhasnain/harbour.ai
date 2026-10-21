"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import type { Channel, Persona } from "@/lib/types";
import { useConversation } from "./useConversation";
import { useVoice } from "./useVoice";

interface Props {
  persona: Persona;
  channel: Channel;
  title: string;
  subtitle?: string;
  avatar?: string;
  greeting: string;
  suggestions?: string[];
  /** Operator views only: show what the assistant did after each reply. */
  showTrace?: boolean;
  allowVoice?: boolean;
  className?: string;
  headerRight?: React.ReactNode;
  onTurn?: () => void;
}

const clockOf = (ts: number) => new Date(ts).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

export function ChatPanel({ persona, channel, title, subtitle, avatar, greeting, suggestions = [], showTrace = false, allowVoice = false, className = "", headerRight, onTurn }: Props) {
  const convo = useConversation({ persona, channel, greeting, onTurn });
  const { bubbles, setBubbles, busy, typing } = convo;
  const [input, setInput] = useState("");
  const [call, setCall] = useState(false);
  const callRef = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(t: string) => void>(() => {});
  const voice = useVoice((said) => sendRef.current(said));

  async function send(text: string) {
    setInput("");
    const parts = await convo.send(text, callRef.current ? { channel: "phone", instant: true } : {});
    if (parts && callRef.current) voice.speak(parts.join(" "), () => callRef.current && voice.listen());
  }
  sendRef.current = send;

  useEffect(() => {
    const onAsk = (e: Event) => sendRef.current((e as CustomEvent<string>).detail);
    window.addEventListener("chat:ask", onAsk);
    return () => window.removeEventListener("chat:ask", onAsk);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, typing]);

  function toggleCall() {
    if (call) {
      callRef.current = false;
      setCall(false);
      voice.stop();
      return;
    }
    callRef.current = true;
    setCall(true);
    const hello = persona === "tenant" ? "Bonnie Doon Manor maintenance. What's going on in your suite?" : persona === "investor" ? "Hi, thanks for calling Triple Harbour Capital. How can I help?" : "Hi, thanks for calling Bonnie Doon Manor. How can I help?";
    setBubbles((b) => [...b, { role: "assistant", text: hello, ts: Date.now() }]);
    voice.speak(hello, () => callRef.current && voice.listen());
  }

  const userHasSpoken = bubbles.some((b) => b.role === "user");
  const staffLabel = persona === "tenant" ? "Maintenance team" : persona === "investor" ? "Rodrigo Parada" : "Leasing team";

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {avatar ? <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-white">TH</div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{call ? "On a call…" : title}</div>
          {subtitle && (
            <div className="flex items-center gap-1.5 truncate text-xs text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {subtitle}
            </div>
          )}
        </div>
        {allowVoice && (
          <button onClick={toggleCall} title={call ? "End call" : "Call"} className={`grid h-8 w-8 place-items-center rounded-full ${call ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            {call ? <PhoneOff size={15} /> : <Phone size={15} />}
          </button>
        )}
        {headerRight}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4">
        <div className="mb-3 text-center text-[11px] text-slate-400">Today</div>
        <div className="space-y-1.5">
          {bubbles.map((b, i) => {
            const next = bubbles[i + 1];
            const lastOfGroup = !next || next.role !== b.role;
            return (
              <div key={i} className={`flex flex-col ${b.role === "user" ? "items-end" : "items-start"} ${lastOfGroup ? "pb-2" : ""}`}>
                {b.staff && !bubbles[i - 1]?.staff && <div className="mb-0.5 px-1 text-[11px] font-medium text-emerald-700">{staffLabel}</div>}
                <div
                  className={`max-w-[82%] whitespace-pre-wrap px-3.5 py-2 text-[14px] leading-snug ${
                    b.role === "user"
                      ? "rounded-2xl rounded-br-md bg-[#1f3a5f] text-white"
                      : b.staff
                        ? "rounded-2xl rounded-bl-md bg-emerald-50 text-slate-900 ring-1 ring-emerald-200"
                        : "rounded-2xl rounded-bl-md bg-slate-100 text-slate-900"
                  }`}
                >
                  {b.text}
                </div>
                {showTrace && b.actions && b.actions.length > 0 && (
                  <div className="mt-1 max-w-[82%] space-y-0.5 border-l-2 border-slate-200 pl-2">
                    {b.actions.map((a, j) => (
                      <div key={j} className={`text-[11px] ${a.ok ? "text-slate-500" : "text-rose-600"}`}>
                        {a.label}
                        {a.detail ? ` · ${a.detail}` : ""}
                      </div>
                    ))}
                  </div>
                )}
                {lastOfGroup && <div className="mt-0.5 px-1 text-[10px] text-slate-400">{clockOf(b.ts)}</div>}
              </div>
            );
          })}
          {typing && (
            <div className="flex items-start">
              <div className="typing flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {suggestions.length > 0 && !userHasSpoken && bubbles.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-[#1f3a5f]/30 px-3 py-1 text-[13px] text-[#1f3a5f] hover:bg-[#1f3a5f]/5">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
      >
        {allowVoice && (
          <button type="button" onClick={() => (voice.listening ? voice.stop() : voice.listen())} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${voice.listening ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-100"}`} title="Voice message">
            {voice.listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voice.listening ? "Listening…" : "Write a message…"}
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] outline-none focus:border-slate-400 focus:bg-white"
        />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1f3a5f] text-white disabled:bg-slate-200 disabled:text-slate-400">
          <ArrowUp size={17} />
        </button>
      </form>
    </div>
  );
}
