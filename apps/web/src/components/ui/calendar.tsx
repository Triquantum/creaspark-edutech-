"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "./card";
import { api } from "@/lib/api";

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string | null;
  startAt: string;
  endAt?: string | null;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Month calendar with event-highlighted dates; fetches /events?month=YYYY-MM as the user navigates. */
export function Calendar({ onCreate }: { onCreate?: (dateISO: string) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<Date | null>(null);

  useEffect(() => {
    api<CalendarEvent[]>(`/events?month=${ymKey(cursor)}`).then(setEvents).catch(() => setEvents([]));
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = dayKey(new Date(e.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(start.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const selectedEvents = selected ? eventsByDay.get(dayKey(selected)) ?? [] : [];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-night dark:text-white">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <button
            aria-label="Previous month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="Next month"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const hasEvents = eventsByDay.has(dayKey(d));
          const isToday = dayKey(d) === dayKey(new Date());
          const isSelected = selected && dayKey(d) === dayKey(selected);
          return (
            <button
              key={d.toISOString()}
              onClick={() => setSelected(d)}
              className={`relative aspect-square rounded-lg text-xs transition-colors
                ${!inMonth ? "text-slate-300 dark:text-slate-600" : "text-night dark:text-white"}
                ${isSelected ? "bg-primary text-white" : isToday ? "bg-primary/10" : "hover:bg-surface dark:hover:bg-white/5"}`}
            >
              {d.getDate()}
              {hasEvents && !isSelected && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-white/10">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {selected.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          {selectedEvents.length === 0 && <p className="mt-2 text-sm text-slate-500">No events.</p>}
          <ul className="mt-2 space-y-2">
            {selectedEvents.map((e) => (
              <li key={e.id} className="rounded-lg bg-surface px-3 py-2 text-sm dark:bg-white/5">
                <p className="font-medium text-night dark:text-white">{e.title}</p>
                {e.location && <p className="text-xs text-slate-400">{e.location}</p>}
              </li>
            ))}
          </ul>
          {onCreate && (
            <button onClick={() => onCreate(selected.toISOString())} className="mt-2 text-xs font-medium text-accent hover:underline">
              + Add event
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
