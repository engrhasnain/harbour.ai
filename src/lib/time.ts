// All scheduling happens in Edmonton local time; instants are stored as ISO UTC strings.
export const TZ = "America/Edmonton";

function offsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Edmonton wall-clock time -> instant. Month is 1-12. */
export function zoned(y: number, m: number, d: number, h: number, min = 0): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const off = offsetMinutes(new Date(guess));
  let t = guess - off * 60000;
  const off2 = offsetMinutes(new Date(t));
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}

export interface LocalParts {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  dow: number; // 0 = Sunday
}

export function local(date: Date | string): LocalParts {
  const dt = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")),
    min: Number(get("minute")),
    dow: dows.indexOf(get("weekday")),
  };
}

/** Local calendar date n days after (y,m,d). */
export function addDays(y: number, m: number, d: number, n: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() };
}

export function startOfLocalDay(date: Date | string): Date {
  const p = local(date);
  return zoned(p.y, p.m, p.d, 0, 0);
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
}

export function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ, month: "short", day: "numeric" });
}

export function isAfterHours(iso: string): boolean {
  const p = local(iso);
  return p.dow === 0 || p.dow === 6 || p.h < 9 || p.h >= 17;
}

export function relTime(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function clock(p: LocalParts): string {
  const h12 = ((p.h + 11) % 12) + 1;
  return `${h12}${p.min ? `:${String(p.min).padStart(2, "0")}` : ""}${p.h < 12 ? "am" : "pm"}`;
}

/** "today at 5pm", "tomorrow at 10:30am", "Thursday at 6:30pm", or "Oct 30 at 2pm" further out. */
export function friendlyWhen(iso: string, now = new Date()): string {
  const p = local(iso);
  const t = local(now);
  const diff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(t.y, t.m - 1, t.d)) / 86400_000);
  const day = diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff < 7 ? DAY_NAMES[p.dow] : `${MONTH_NAMES[p.m - 1].slice(0, 3)} ${p.d}`;
  return `${day} at ${clock(p)}`;
}

/** "Thursday, October 22 at 6:30pm" for confirmations. */
export function longWhen(iso: string): string {
  const p = local(iso);
  return `${DAY_NAMES[p.dow]}, ${MONTH_NAMES[p.m - 1]} ${p.d} at ${clock(p)}`;
}

export function monthDay(iso: string): string {
  const p = local(iso);
  return `${MONTH_NAMES[p.m - 1]} ${p.d}`;
}
