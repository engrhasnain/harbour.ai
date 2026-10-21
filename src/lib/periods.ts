import { local } from "./time";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The month just closed, e.g. "September 2026". */
export function reportingMonth(now = new Date()): string {
  const t = local(now);
  const m = t.m === 1 ? 12 : t.m - 1;
  return `${MONTHS[m - 1]} ${t.m === 1 ? t.y - 1 : t.y}`;
}

/** The quarter just closed, e.g. "Q3 2026". */
export function reportingQuarterLabel(now = new Date()): string {
  const t = local(now);
  const q = Math.floor((t.m - 1) / 3);
  return q === 0 ? `Q4 ${t.y - 1}` : `Q${q} ${t.y}`;
}
