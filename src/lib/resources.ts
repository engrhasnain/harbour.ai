import type { ResourceId } from "./types";

export const RESOURCE_META: Record<ResourceId, { name: string; short: string; color: string }> = {
  leasing: { name: "Leasing team (showings)", short: "Leasing", color: "#0e7c86" },
  "crew-a": { name: "Crew A: maintenance", short: "Crew A", color: "#c2410c" },
  "crew-b": { name: "Crew B: turnover & reno", short: "Crew B", color: "#6d28d9" },
  "vendor-plumbing": { name: "On-call plumbing (vendor)", short: "Plumbing", color: "#be123c" },
  rodrigo: { name: "Rodrigo: investor calls", short: "Rodrigo", color: "#1d4ed8" },
};
