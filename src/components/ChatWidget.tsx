"use client";
import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";

/** Floating website chat: launcher bubble bottom-right, opens on click or when the page asks a question. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("chat") === "open") setOpen(true);
    const t = setTimeout(() => setTeaser(true), 4000);
    const onAsk = () => setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener("chat:ask", onAsk);
    window.addEventListener("chat:open", onOpen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("chat:ask", onAsk);
      window.removeEventListener("chat:open", onOpen);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <div className={open ? "block" : "hidden"}>
        <ChatPanel
          persona="prospect"
          channel="website"
          title="Bonnie Doon Manor"
          subtitle="Leasing · usually replies instantly"
          avatar="/bdm/exterior.jpg"
          greeting="Hi there! I can help with availability, pricing or booking a viewing. What can I help you with?"
          suggestions={["Is the 2 bedroom still available?", "Are pets allowed?", "Can I book a viewing?"]}
          allowVoice
          className="h-[min(600px,calc(100vh-110px))] w-[min(380px,calc(100vw-40px))]"
          headerRight={
            <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" title="Minimize">
              <X size={16} />
            </button>
          }
        />
      </div>

      {!open && teaser && (
        <button onClick={() => setOpen(true)} className="max-w-[260px] rounded-2xl rounded-br-md border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-800 shadow-lg">
          Hi! Have a question about the suites? I can also book you a viewing.
        </button>
      )}
      <button
        onClick={() => {
          setOpen((o) => !o);
          setTeaser(false);
        }}
        className="grid h-14 w-14 place-items-center rounded-full bg-[#1f3a5f] text-white shadow-lg hover:bg-[#18304f]"
        title="Chat with us"
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
