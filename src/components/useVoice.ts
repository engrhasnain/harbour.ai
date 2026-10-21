"use client";
import { useRef, useState } from "react";

// Minimal typing for the browser speech APIs (Chrome/Edge expose webkitSpeechRecognition).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** Browser speech in and speech out, used for the "call" mode of the chats. */
export function useVoice(onHeard: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  function speak(text: string, onEnd?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text.replace(/[•*#]/g, ""));
    u.lang = "en-CA";
    u.rate = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => /en-(CA|US)/.test(x.lang) && /Natural|Aria|Jenny|Google|Samantha/i.test(x.name)) ?? voices.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  function listen() {
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice needs Chrome or Edge. You can still type.");
      return;
    }
    const r = new Ctor();
    r.lang = "en-CA";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript;
      if (said) onHeard(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  function stop() {
    rec.current?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setListening(false);
  }

  return { listening, speak, listen, stop };
}
