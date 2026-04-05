"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CalendarEvent {
  type: "birthday" | "anniversary" | "remembrance";
  title: string;
  personName: string;
  personId: string;
  date: string;
  month: number;
  day: number;
  year?: number;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_CONFIG = {
  birthday: { icon: "\uD83C\uDF82", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-500", label: "Birthday" },
  anniversary: { icon: "\uD83D\uDC8D", color: "bg-rose-100 text-rose-800 border-rose-300", dot: "bg-rose-500", label: "Anniversary" },
  remembrance: { icon: "\uD83D\uDD4A\uFE0F", color: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400", label: "In Loving Memory" },
};

function daysUntil(month: number, day: number): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  if (next < new Date(thisYear, now.getMonth(), now.getDate())) {
    next = new Date(thisYear + 1, month - 1, day);
  }
  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function yearsAgo(year: number | undefined): string {
  if (!year) return "";
  const diff = new Date().getFullYear() - year;
  if (diff <= 0) return "";
  return `${diff} years`;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/events/calendar")
      .then((r) => r.json())
      .then((data) => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const todayYear = today.getFullYear();

  // Upcoming events (next 30 days)
  const upcoming = events
    .map((e) => ({ ...e, daysAway: daysUntil(e.month, e.day) }))
    .filter((e) => e.daysAway >= 0 && e.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);

  // Events for the currently viewed month
  const monthEvents = events.filter((e) => e.month === currentMonth + 1);

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
    setSelectedDay(null);
  };
  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(null);
  };

  const eventsOnDay = (day: number) => monthEvents.filter((e) => e.day === day);
  const selectedDayEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  if (loading) {
    return <div className="text-center py-16"><p className="text-gray-500">Loading calendar...</p></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">Family Calendar</h1>
      <p className="text-sm text-gray-500 mb-6">Birthdays, anniversaries, and days of remembrance</p>

      {/* ── Upcoming Events ── */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Upcoming Events</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-400 text-sm">No upcoming events in the next 30 days.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcoming.slice(0, 9).map((e, i) => {
              const cfg = EVENT_CONFIG[e.type];
              const isToday = e.daysAway === 0;
              return (
                <Link
                  key={`${e.personId}-${e.type}-${i}`}
                  href={`/persons/${e.personId}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-shadow hover:shadow-md ${cfg.color} ${isToday ? "ring-2 ring-amber-400" : ""}`}
                >
                  <span className="text-2xl flex-shrink-0">{cfg.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{e.title}</p>
                    <p className="text-xs opacity-70 mt-0.5">
                      {isToday ? (
                        <span className="font-semibold">Today!</span>
                      ) : e.daysAway === 1 ? (
                        "Tomorrow"
                      ) : (
                        `In ${e.daysAway} days`
                      )}
                      {e.year ? ` \u00B7 ${yearsAgo(e.year)}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Monthly Calendar ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-amber-100 transition-colors text-amber-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="text-center">
            <h3 className="font-bold text-amber-900">{MONTH_NAMES[currentMonth]} {currentYear}</h3>
            {(currentMonth !== today.getMonth() || currentYear !== today.getFullYear()) && (
              <button onClick={goToday} className="text-xs text-amber-600 hover:underline">Go to today</button>
            )}
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-amber-100 transition-colors text-amber-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 sm:h-20 border-b border-r border-gray-50" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayEvents = eventsOnDay(day);
            const isToday = day === todayDay && currentMonth === today.getMonth() && currentYear === todayYear;
            const isSelected = day === selectedDay;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`h-16 sm:h-20 border-b border-r border-gray-50 p-1 text-left transition-colors relative
                  ${isToday ? "bg-amber-50" : "hover:bg-gray-50"}
                  ${isSelected ? "ring-2 ring-inset ring-amber-400 bg-amber-50" : ""}
                `}
              >
                <span className={`text-xs font-medium inline-block w-6 h-6 leading-6 text-center rounded-full
                  ${isToday ? "bg-amber-600 text-white" : "text-gray-700"}
                `}>
                  {day}
                </span>
                {/* Event dots */}
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap">
                    {dayEvents.slice(0, 3).map((e, j) => (
                      <span key={j} className={`w-1.5 h-1.5 rounded-full ${EVENT_CONFIG[e.type].dot}`} />
                    ))}
                    {dayEvents.length > 3 && <span className="text-[8px] text-gray-400">+{dayEvents.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">
              {MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
            </h4>
            {selectedDayEvents.length === 0 ? (
              <p className="text-xs text-gray-400">No events on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((e, i) => {
                  const cfg = EVENT_CONFIG[e.type];
                  return (
                    <Link
                      key={i}
                      href={`/persons/${e.personId}`}
                      className={`flex items-center gap-2 p-2 rounded-md border text-sm ${cfg.color} hover:shadow-sm transition-shadow`}
                    >
                      <span>{cfg.icon}</span>
                      <span className="font-medium">{e.title}</span>
                      {e.year && <span className="text-xs opacity-60 ml-auto">{yearsAgo(e.year)}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Birthdays</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Anniversaries</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> In Loving Memory</span>
      </div>
    </div>
  );
}
