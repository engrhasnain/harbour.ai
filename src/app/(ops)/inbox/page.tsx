"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, FileText, Inbox, Landmark, MailPlus, Paperclip, Reply, Sparkles, Store } from "lucide-react";
import { useSnapshot } from "@/components/useSnapshot";
import { act } from "@/components/act";
import { useToast } from "@/components/ops";
import { relTime } from "@/lib/time";
import type { Email } from "@/lib/types";

type Folder = "all" | Email["folder"];

const FOLDERS: { id: Folder; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Inbox", icon: Inbox },
  { id: "inquiries", label: "Listing inquiries", icon: Store },
  { id: "alerts", label: "Team alerts", icon: BellRing },
  { id: "investors", label: "Investors", icon: Landmark },
  { id: "reports", label: "Reports", icon: FileText },
];

const fullTime = (iso: string) => new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function InboxPage() {
  return (
    <Suspense>
      <InboxView />
    </Suspense>
  );
}

function InboxView() {
  const { data, refresh } = useSnapshot(2500);
  const [folder, setFolder] = useState<Folder>("all");
  const folderParam = useSearchParams().get("folder");
  useEffect(() => {
    if (folderParam && FOLDERS.some((f) => f.id === folderParam)) setFolder(folderParam as Folder);
  }, [folderParam]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const { toast, toastNode } = useToast();

  // Deep link (/inbox?open=M-123) is applied once, when the first snapshot arrives.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !data) return;
    deepLinked.current = true;
    const id = new URLSearchParams(window.location.search).get("open");
    const m = id ? data.emails.find((e) => e.id === id) : undefined;
    if (m) setThreadId(m.threadId);
  }, [data]);

  const emails = useMemo(() => data?.emails ?? [], [data]);
  // One row per thread, showing its latest message.
  const threads = useMemo(() => {
    const byThread = new Map<string, Email[]>();
    for (const e of emails) byThread.set(e.threadId, [...(byThread.get(e.threadId) ?? []), e]);
    return [...byThread.values()]
      .map((msgs) => msgs.sort((a, b) => a.ts.localeCompare(b.ts)))
      .filter((msgs) => folder === "all" || msgs[0].folder === folder)
      .sort((a, b) => b[b.length - 1].ts.localeCompare(a[a.length - 1].ts));
  }, [emails, folder]);
  const open = threadId ? emails.filter((e) => e.threadId === threadId).sort((a, b) => a.ts.localeCompare(b.ts)) : null;
  const unread = (f: Folder) => new Set(emails.filter((e) => e.unread && (f === "all" || e.folder === f)).map((e) => e.threadId)).size;

  async function openThread(t: Email[]) {
    setThreadId(t[0].threadId);
    if (t.some((e) => e.unread)) {
      await act({ kind: "mail.read", id: t[0].id }).catch(() => {});
      refresh();
    }
  }

  async function simulate() {
    setSimBusy(true);
    try {
      const r = await fetch("/api/inbox/simulate", { method: "POST" }).then((x) => x.json());
      await refresh();
      setFolder("inquiries");
      setThreadId(r.threadId);
      toast("New listing inquiry arrived and was answered");
    } finally {
      setSimBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-sand-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-navy-900">Inbox</h1>
          <p className="text-xs text-slate-500">leasing@ · maintenance@ · rodrigo@ · alvaro@tripleharbour.com</p>
        </div>
        <button className="btn-ghost" onClick={simulate} disabled={simBusy} title="Demo: a listing site forwards a new inquiry">
          <MailPlus size={15} /> {simBusy ? "Receiving…" : "New Kijiji / Rentals.ca inquiry"}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,380px)_minmax(0,1fr)]">
        <nav className="space-y-0.5 border-r border-sand-200 bg-white p-3">
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFolder(f.id);
                setThreadId(null);
              }}
              className={`flex w-full items-center gap-2.5 rounded-r-full px-3 py-1.5 text-sm ${folder === f.id ? "bg-[#d3e3fd] font-semibold text-navy-900" : "text-slate-700 hover:bg-sand-100"}`}
            >
              <f.icon size={15} />
              <span className="flex-1 text-left">{f.label}</span>
              {unread(f.id) > 0 && <span className="text-xs font-semibold">{unread(f.id)}</span>}
            </button>
          ))}
        </nav>

        <ul className="min-h-0 divide-y divide-sand-100 overflow-y-auto border-r border-sand-200 bg-white">
          {threads.map((t) => {
            const last = t[t.length - 1];
            const isUnread = t.some((e) => e.unread);
            const from = t[0].from;
            return (
              <li key={t[0].threadId}>
                <button onClick={() => openThread(t)} className={`block w-full px-4 py-3 text-left hover:bg-sand-50 ${threadId === t[0].threadId ? "bg-[#e8f0fe]" : isUnread ? "bg-white" : "bg-[#fafafa]"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${isUnread ? "font-semibold text-navy-900" : "text-slate-700"}`}>
                      {from}
                      {t.length > 1 && <span className="ml-1 text-xs font-normal text-slate-400">{t.length}</span>}
                    </span>
                    <span className={`shrink-0 text-xs ${isUnread ? "font-semibold text-navy-900" : "text-slate-400"}`}>{relTime(last.ts)}</span>
                  </div>
                  <div className={`truncate text-[13px] ${isUnread ? "font-semibold text-navy-900" : "text-slate-700"}`}>{t[0].subject}</div>
                  <div className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    {last.byAssistant && <Sparkles size={11} className="shrink-0 text-emerald-600" />}
                    {t.some((e) => e.attachment) && <Paperclip size={11} className="shrink-0" />}
                    <span className="truncate">{last.body.replace(/\s+/g, " ")}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="min-h-0 overflow-y-auto bg-[#f6f8fc]">
          {!open ? (
            <div className="grid h-full place-items-center text-sm text-slate-400">Select a conversation</div>
          ) : (
            <Thread
              msgs={open}
              onReplied={() => {
                toast("Reply sent");
                refresh();
              }}
            />
          )}
        </div>
      </div>
      {toastNode}
    </div>
  );
}

function Thread({ msgs, onReplied }: { msgs: Email[]; onReplied: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const canReply = msgs[0].folder === "inquiries" || msgs.some((m) => !m.fromEmail.endsWith("@tripleharbour.com"));

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await act({ kind: "mail.reply", threadId: msgs[0].threadId, text });
      setText("");
      onReplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-xl text-navy-900">{msgs[0].subject.replace(/^Re: /, "")}</h2>
      <div className="space-y-3">
        {msgs.map((m) => (
          <article key={m.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-sand-200">
            <header className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ${m.fromEmail.endsWith("@tripleharbour.com") ? "bg-navy-800" : "bg-slate-400"}`}>{m.from[0]}</div>
                <div>
                  <div className="text-sm font-semibold text-navy-900">
                    {m.from} <span className="font-normal text-slate-500">&lt;{m.fromEmail}&gt;</span>
                  </div>
                  <div className="text-xs text-slate-500">to {m.to}</div>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                {fullTime(m.ts)}
                {m.byAssistant && (
                  <div className="mt-1 flex items-center justify-end gap-1 text-emerald-700">
                    <Sparkles size={11} /> sent by the assistant
                  </div>
                )}
              </div>
            </header>
            <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-slate-800">{m.body}</div>
            {m.attachment && (
              <Link href={m.attachment.href} className="mt-4 flex w-fit items-center gap-3 rounded-lg border border-sand-200 px-3 py-2 hover:bg-sand-50">
                <span className="grid h-9 w-9 place-items-center rounded bg-rose-600 text-[10px] font-bold text-white">PDF</span>
                <span>
                  <span className="block text-sm font-medium text-navy-900">{m.attachment.name}</span>
                  <span className="text-xs text-slate-500">Click to open</span>
                </span>
              </Link>
            )}
            {m.link && (
              <Link href={m.link.href} className="mt-4 inline-block rounded-md bg-navy-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
                {m.link.label}
              </Link>
            )}
          </article>
        ))}
      </div>

      {canReply && (
        <div className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-sand-200">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Reply size={13} /> Reply as Bonnie Doon Manor Leasing
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write a reply…" className="w-full resize-none rounded-md border border-sand-200 p-2.5 text-sm outline-none focus:border-navy-700" />
          <div className="mt-2 flex justify-end">
            <button disabled={busy || !text.trim()} onClick={send} className="btn-primary">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
