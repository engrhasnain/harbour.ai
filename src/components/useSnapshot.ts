"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "@/lib/types";

/** Polls the live demo state so every screen reflects what the AI just did. */
export function useSnapshot(intervalMs = 2500) {
  const [data, setData] = useState<Snapshot | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      // keep last good snapshot
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(refresh, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, intervalMs]);

  return { data, refresh };
}
