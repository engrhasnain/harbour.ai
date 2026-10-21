"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Send, X } from "lucide-react";
import { act } from "./act";
import type { TranscriptMsg } from "@/lib/types";

// ---------- Drawer ----------

export function Drawer({ title, subtitle, onClose, children }: { title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-navy-950/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-sand-200 px-6 py-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-navy-900">{title}</div>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-sand-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b border-sand-100 px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------- Toast ----------

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, error = false) => {
    setMsg({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  const node = msg ? (
    <div className={`fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${msg.error ? "bg-rose-600" : "bg-navy-900"}`}>{msg.text}</div>
  ) : null;
  return { toast: show, toastNode: node };
}

// ---------- Reschedule ----------

export function Reschedule({ eventId, onDone }: { eventId: string; onDone: (label: string) => void }) {
  const [slots, setSlots] = useState<{ start: string; label: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    act<{ slots: { start: string; label: string }[] }>({ kind: "event.slots", id: eventId })
      .then((r) => setSlots(r.slots))
      .catch((e) => setError(e.message));
  }, [eventId]);

  async function move(s: { start: string; label: string }) {
    setBusy(true);
    try {
      await act({ kind: "event.move", id: eventId, start: s.start });
      onDone(s.label);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!slots) return <div className="text-sm text-slate-400">Finding open times…</div>;
  if (!slots.length) return <div className="text-sm text-slate-500">No open times in the next three weeks.</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => (
        <button key={s.start} disabled={busy} onClick={() => move(s)} className="flex items-center gap-1.5 rounded-md border border-sand-200 px-3 py-1.5 text-sm text-navy-900 hover:border-navy-700 hover:bg-sand-50 disabled:opacity-50">
          <CalendarClock size={13} className="text-slate-400" /> {s.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Conversation + staff reply ----------

const clock = (iso: string) => new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function Conversation({
  sessionId,
  reply,
  who,
  placeholder,
  empty,
}: {
  sessionId?: string | null;
  reply: (text: string) => Promise<string | void>;
  who: string;
  placeholder: string;
  empty?: string;
}) {
  const [transcript, setTranscript] = useState<TranscriptMsg[] | null>(null);
  const [sid, setSid] = useState(sessionId ?? null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setSid(sessionId ?? null), [sessionId]);

  useEffect(() => {
    if (!sid) {
      setTranscript([]);
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/session/${sid}`)
        .then((r) => r.json())
        .then((d) => alive && setTranscript(d.transcript ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sid]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [transcript?.length]);

  async function send() {
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    try {
      const newSid = await reply(msg);
      if (newSid) setSid(newSid);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div ref={box} className="max-h-[340px] space-y-2.5 overflow-y-auto rounded-lg border border-sand-200 bg-sand-50 p-3">
        {transcript === null && <div className="text-sm text-slate-400">Loading…</div>}
        {transcript?.length === 0 && <div className="text-sm text-slate-500">{empty ?? "No messages yet."}</div>}
        {transcript?.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
            <div className="mb-0.5 text-[10px] text-slate-400">
              {m.role === "user" ? who : m.by === "staff" ? "You (team)" : "Assistant"} · {clock(m.ts)}
            </div>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] ${m.role === "user" ? "bg-white text-navy-900 ring-1 ring-sand-200" : m.by === "staff" ? "bg-emerald-700 text-white" : "bg-navy-800 text-white"}`}>
              {m.text}
            </div>
            {m.actions && m.actions.length > 0 && (
              <div className="mt-1 max-w-[85%] text-right text-[11px] text-slate-500">{m.actions.map((a) => a.label).join(" · ")}</div>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-md border border-sand-200 px-3 py-2 text-sm outline-none focus:border-navy-700" />
        <button disabled={busy || !text.trim()} className="btn-primary px-3">
          <Send size={14} /> Send
        </button>
      </form>
      <div className="mt-1 text-[11px] text-slate-400">Your message appears in their chat right away, and the assistant sees it too.</div>
    </div>
  );
}
