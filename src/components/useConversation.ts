"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, Persona, ToolAction } from "@/lib/types";

export interface Bubble {
  role: "user" | "assistant";
  text: string;
  ts: number;
  actions?: ToolAction[];
  /** Typed by a person on the Triple Harbour team, not the assistant. */
  staff?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How long a person would take to type this bubble. */
const typingMs = (text: string) => Math.min(2600, Math.max(900, 450 + text.length * 20));

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One conversation with the assistant: sends messages, paces replies like a person typing,
 * and shows replies a team member sends from the console.
 */
export function useConversation({ persona, channel, greeting, onTurn }: { persona: Persona; channel: Channel; greeting?: string; onTurn?: () => void }) {
  const [sessionId, setSessionId] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const staffSeen = useRef(0);
  const onTurnRef = useRef(onTurn);
  onTurnRef.current = onTurn;

  const reset = useCallback(() => {
    setSessionId(newId());
    staffSeen.current = 0;
    setBubbles([]);
    if (!greeting) return () => {};
    // The greeting arrives like a real message, not pre-rendered.
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setBubbles([{ role: "assistant", text: greeting, ts: Date.now() }]);
    }, 700);
    return () => clearTimeout(t);
  }, [greeting]);

  useEffect(() => reset(), [reset, persona]);

  useEffect(() => {
    if (!sessionId) return;
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/session/${sessionId}`);
        const d = (await r.json()) as { transcript?: { by?: string; text: string; ts: string }[] };
        const staff = (d.transcript ?? []).filter((m) => m.by === "staff");
        if (staff.length > staffSeen.current) {
          const fresh = staff.slice(staffSeen.current);
          staffSeen.current = staff.length;
          setBubbles((b) => [...b, ...fresh.map((m) => ({ role: "assistant" as const, text: m.text, ts: new Date(m.ts).getTime(), staff: true }))]);
        }
      } catch {
        // try again on the next tick
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [sessionId]);

  /** Returns the reply split into bubbles. `instant` skips the typing pacing (voice calls). */
  const send = useCallback(
    async (text: string, opts: { channel?: Channel; instant?: boolean } = {}): Promise<string[] | null> => {
      const msg = text.trim();
      if (!msg || busy || !sessionId) return null;
      setBubbles((b) => [...b, { role: "user", text: msg, ts: Date.now() }]);
      setBusy(true);
      await sleep(350);
      setTyping(true);
      const started = Date.now();
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, persona, channel: opts.channel ?? channel, message: msg }),
        });
        const data = await res.json();
        const parts: string[] = String(data.reply ?? "Sorry, something went wrong on our end. Please try again.")
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        onTurnRef.current?.();
        if (opts.instant) {
          setTyping(false);
          setBubbles((b) => [...b, ...parts.map((p, i) => ({ role: "assistant" as const, text: p, ts: Date.now(), actions: i === parts.length - 1 ? data.actions : undefined }))]);
        } else {
          for (let i = 0; i < parts.length; i++) {
            setTyping(true);
            const wait = typingMs(parts[i]) - (i === 0 ? Date.now() - started : 0);
            if (wait > 0) await sleep(wait);
            setTyping(false);
            setBubbles((b) => [...b, { role: "assistant", text: parts[i], ts: Date.now(), actions: i === parts.length - 1 ? data.actions : undefined }]);
            if (i < parts.length - 1) await sleep(250);
          }
        }
        return parts;
      } catch {
        setBubbles((b) => [...b, { role: "assistant", text: "Sorry, the connection dropped. Can you send that again?", ts: Date.now() }]);
        return null;
      } finally {
        setTyping(false);
        setBusy(false);
      }
    },
    [busy, sessionId, persona, channel],
  );

  return { sessionId, bubbles, setBubbles, busy, typing, send, reset };
}
