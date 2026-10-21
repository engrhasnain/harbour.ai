"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { useSnapshot } from "@/components/useSnapshot";
import { act } from "@/components/act";
import { Reschedule, useToast } from "@/components/ops";
import { RESOURCE_META } from "@/lib/resources";
import { addDays, fmtTime, local, zoned } from "@/lib/time";
import type { CalEvent, ResourceId } from "@/lib/types";

const START_H = 7;
const END_H = 21;
const HOUR_PX = 52;
const LANES: ResourceId[] = ["leasing", "crew-a", "crew-b", "vendor-plumbing", "rodrigo"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { data, refresh } = useSnapshot();
  const { toast, toastNode } = useToast();
  const [offset, setOffset] = useState(0);
  const [on, setOn] = useState<Record<ResourceId, boolean>>({ leasing: true, "crew-a": true, "crew-b": true, "vendor-plumbing": true, rodrigo: true });
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const days = useMemo(() => {
    const t = local(new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(t.y, t.m, t.d, offset * 7 + i));
  }, [offset]);

  const lanes = LANES.filter((r) => on[r]);
  const nowP = local(new Date());

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Viewings and maintenance, Bonnie Doon Manor"
        actions={
          <div className="flex items-center gap-1">
            <button className="btn-ghost px-2" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-ghost" onClick={() => setOffset(0)}>
              This week
            </button>
            <button className="btn-ghost px-2" onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />
      <div className="p-6 lg:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {LANES.map((r) => (
            <button
              key={r}
              onClick={() => setOn((s) => ({ ...s, [r]: !s[r] }))}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${on[r] ? "border-transparent text-white" : "border-sand-200 bg-white text-slate-500"}`}
              style={on[r] ? { background: RESOURCE_META[r].color } : undefined}
            >
              {RESOURCE_META[r].name}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-slate-400" /> booked automatically
          </span>
        </div>

        <div className="card overflow-x-auto">
          <div className="grid min-w-[980px]" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
            <div className="border-b border-sand-200" />
            {days.map((d) => {
              const isToday = d.y === nowP.y && d.m === nowP.m && d.d === nowP.d;
              return (
                <div key={`${d.m}-${d.d}`} className={`border-b border-l border-sand-200 px-2 py-2 text-center ${isToday ? "bg-harbour-50" : ""}`}>
                  <div className="label">{DOW[d.dow]}</div>
                  <div className={`text-lg font-semibold ${isToday ? "text-harbour-600" : "text-navy-900"}`}>{d.d}</div>
                </div>
              );
            })}

            <div className="relative" style={{ height: (END_H - START_H) * HOUR_PX }}>
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <div key={i} className="absolute right-2 text-[10px] text-slate-400" style={{ top: i * HOUR_PX - 6 }}>
                  {i === 0 ? "" : `${((START_H + i - 1) % 12) + 1}${START_H + i < 12 ? "a" : "p"}`}
                </div>
              ))}
            </div>
            {days.map((d) => {
              const dayStart = zoned(d.y, d.m, d.d, 0).getTime();
              const dayEnd = dayStart + 86400_000;
              const evs = (data?.events ?? []).filter((e) => on[e.resource] && new Date(e.start).getTime() < dayEnd && new Date(e.end).getTime() > dayStart);
              const isToday = d.y === nowP.y && d.m === nowP.m && d.d === nowP.d;
              return (
                <div key={`${d.m}-${d.d}-col`} className={`relative border-l border-sand-200 ${d.dow === 0 ? "bg-sand-50" : ""}`} style={{ height: (END_H - START_H) * HOUR_PX }}>
                  {Array.from({ length: END_H - START_H }, (_, i) => (
                    <div key={i} className="absolute inset-x-0 border-t border-sand-100" style={{ top: i * HOUR_PX }} />
                  ))}
                  {isToday && nowP.h >= START_H && nowP.h < END_H && (
                    <div className="absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: (nowP.h + nowP.min / 60 - START_H) * HOUR_PX }} />
                  )}
                  {evs.map((e, _i, dayEvs) => {
                    // Only split the column between teams that actually have work that day.
                    const dayLanes = lanes.filter((r) => dayEvs.some((x) => x.resource === r));
                    const s = local(e.start);
                    const en = local(e.end);
                    const sh = Math.max(START_H, Math.min(END_H - 0.5, s.h + s.min / 60));
                    const eh = Math.max(sh + 0.5, Math.min(END_H, (en.d !== s.d ? 24 : en.h + en.min / 60)));
                    const lane = dayLanes.indexOf(e.resource);
                    const color = RESOURCE_META[e.resource].color;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[10.5px] leading-tight text-white shadow-sm hover:z-20 hover:brightness-110 ${e.createdBy === "ai" ? "border-2 border-dashed border-white/70" : ""}`}
                        style={{
                          top: (sh - START_H) * HOUR_PX + 1,
                          height: (eh - sh) * HOUR_PX - 2,
                          left: `calc(${(lane / dayLanes.length) * 100}% + 2px)`,
                          width: `calc(${100 / dayLanes.length}% - 4px)`,
                          background: color,
                        }}
                        title={e.title}
                      >
                        <div className="font-semibold">{fmtTime(e.start)}</div>
                        <div className="opacity-90">{e.title}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <EventModal
          ev={selected}
          onClose={() => setSelected(null)}
          onDone={(msg) => {
            setSelected(null);
            toast(msg);
            refresh();
          }}
          onError={(msg) => toast(msg, true)}
        />
      )}
      {toastNode}
    </>
  );
}

function EventModal({ ev, onClose, onDone, onError }: { ev: CalEvent; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [moving, setMoving] = useState(false);
  const past = new Date(ev.end) < new Date();

  async function run(body: Record<string, unknown>, msg: string) {
    try {
      await act(body);
      onDone(msg);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy-950/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="label" style={{ color: RESOURCE_META[ev.resource].color }}>
          {RESOURCE_META[ev.resource].name}
        </div>
        <div className="mt-1 text-lg font-semibold text-navy-900">{ev.title}</div>
        <div className="mt-1 text-sm text-slate-600">
          {new Date(ev.start).toLocaleString("en-CA", { timeZone: "America/Edmonton", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} – {fmtTime(ev.end)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="pill bg-sand-100 capitalize text-navy-800">{ev.kind.replace("_", " ")}</span>
          {ev.unitId && <span className="pill bg-sand-100 text-navy-800">Suite #{ev.unitId.slice(4)}</span>}
          <span className="pill bg-slate-100 text-slate-600">{ev.createdBy === "ai" ? "Booked automatically" : "Booked by staff"}</span>
        </div>
        {ev.notes && <p className="mt-3 text-sm text-slate-600">{ev.notes}</p>}

        {(ev.kind === "showing" || ev.kind === "work_order") && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-sand-100 pt-4">
            <button className="btn-primary" onClick={() => run({ kind: "event.complete", id: ev.id }, ev.kind === "showing" ? "Viewing done. Application link sent" : "Work order completed")}>
              {ev.kind === "showing" ? "Mark viewed" : "Mark complete"}
            </button>
            {!past && (
              <button className="btn-ghost" onClick={() => setMoving((m) => !m)}>
                {moving ? "Close" : "Move"}
              </button>
            )}
            <button className="btn-ghost text-rose-700" onClick={() => run({ kind: "event.cancel", id: ev.id }, "Booking cancelled. They've been notified")}>
              Cancel
            </button>
          </div>
        )}
        {moving && (
          <div className="mt-4">
            <div className="mb-2 text-xs text-slate-500">Open times for {RESOURCE_META[ev.resource].short}:</div>
            <Reschedule eventId={ev.id} onDone={(label) => onDone(`Moved to ${label}. They've been notified`)} />
          </div>
        )}
        <button className="mt-4 w-full text-center text-sm text-slate-500 hover:text-navy-900" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
