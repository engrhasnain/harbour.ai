"use client";

export function AskButton({ text, children, className }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <button className={className} onClick={() => window.dispatchEvent(new CustomEvent("chat:ask", { detail: text }))}>
      {children}
    </button>
  );
}
