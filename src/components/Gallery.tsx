"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";

export interface Photo {
  src: string;
  alt: string;
}

export function Gallery({ photos }: { photos: Photo[] }) {
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, photos.length]);

  const [hero, ...rest] = photos;
  return (
    <>
      <div className="relative grid h-[260px] gap-1.5 overflow-hidden rounded-lg sm:h-[420px] sm:grid-cols-4 sm:grid-rows-2">
        <button onClick={() => setIdx(0)} className="sm:col-span-2 sm:row-span-2">
          <img src={hero.src} alt={hero.alt} className="h-full w-full object-cover hover:brightness-95" />
        </button>
        {rest.slice(0, 4).map((p, i) => (
          <button key={p.src} onClick={() => setIdx(i + 1)} className="hidden sm:block">
            <img src={p.src} alt={p.alt} className="h-full w-full object-cover hover:brightness-95" />
          </button>
        ))}
        <button onClick={() => setIdx(0)} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50">
          <Grid2x2 size={14} /> Show all {photos.length} photos
        </button>
      </div>

      {idx !== null && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={() => setIdx(null)}>
          <div className="flex items-center justify-between px-5 py-4 text-sm text-white/80">
            <span>
              {idx + 1} / {photos.length} · {photos[idx].alt}
            </span>
            <button onClick={() => setIdx(null)} className="rounded-full p-1.5 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-8" onClick={(e) => e.stopPropagation()}>
            <img src={photos[idx].src} alt={photos[idx].alt} className="max-h-full max-w-full object-contain" />
            <button onClick={() => setIdx((idx - 1 + photos.length) % photos.length)} className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <ChevronLeft size={22} />
            </button>
            <button onClick={() => setIdx((idx + 1) % photos.length)} className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
