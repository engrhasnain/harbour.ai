"use client";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function Narrative({ kind }: { kind: "property" | "lp" }) {
  const [state, setState] = useState<{ text: string; engine: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/narrative?kind=${kind}`)
      .then((r) => r.json())
      .then(setState);
  }, [kind]);

  async function regenerate() {
    setBusy(true);
    try {
      const r = await fetch("/api/narrative", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      setState(await r.json());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="label">Commentary</div>
        <button onClick={regenerate} disabled={busy} className="no-print flex items-center gap-1 text-xs font-medium text-harbour-600 hover:underline disabled:opacity-50">
          <Sparkles size={12} /> {busy ? "Drafting from the numbers…" : "Redraft with AI"}
        </button>
      </div>
      <div className={`space-y-3 text-[14px] leading-relaxed text-slate-700 ${busy ? "opacity-40" : ""}`}>
        {(state?.text ?? "").split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {state && <div className="no-print mt-2 text-[10px] text-slate-400">Drafted by: {state.engine}. Every figure is pulled from the data on this page.</div>}
    </div>
  );
}
