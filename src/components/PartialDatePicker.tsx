"use client";

import { useEffect, useRef, useState } from "react";

// PartialDatePicker — an explicit two-mode date input.
//
// The picker asks the user up front which KIND of date they're entering:
//
//   "full"        → Year + Month + Day, emitted as "YYYY-MMM-DD"
//   "month-day"   → Month + Day only, emitted as "MMM-DD" (recurring event
//                   with unknown year — still shows up on the calendar).
//
// Those are the only two shapes the picker emits. Anything the user hasn't
// completed yet emits "" so the parent doesn't store a half-typed
// fragment. Existing legacy values are READ (numeric YYYY-MM-DD, and
// bare YYYY) so old rows still render, but they're no longer emitted.
// A legacy YYYY-only row loads in "full" mode with month/day empty so
// the user is nudged to either complete it or switch to month-day mode.
//
// The old version was controlled-component-with-round-trip, and the
// parent's state → parseValue → setYear loop silently wiped any
// in-progress year typing (parseValue couldn't round-trip partial
// fragments like "2", "20", "202"). This rewrite uses a ref to suppress
// the prop→state sync when the incoming value is something we just
// emitted ourselves, which keeps typing stable. External prop changes
// (form reset, initial hydration, switching persons) still flow through.

interface Props {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

type Mode = "full" | "month-day";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthIndexFromAbbrev(abbrev: string): number {
  return MONTHS.findIndex((m) => m.toLowerCase() === abbrev.toLowerCase());
}

interface Parts {
  mode: Mode;
  year: string;
  month: string; // canonical Mmm (e.g. "Apr") or ""
  day: string;   // zero-padded "01".."31" or ""
}

function parseValue(value: string | null | undefined): Parts {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { mode: "full", year: "", month: "", day: "" };

  // Canonical YYYY-MMM-DD
  const canonical = trimmed.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/);
  if (canonical) {
    const idx = monthIndexFromAbbrev(canonical[2]);
    return {
      mode: "full",
      year: canonical[1],
      month: idx >= 0 ? MONTHS[idx] : "",
      day: canonical[3].padStart(2, "0"),
    };
  }

  // Canonical MMM-DD (recurring, year unknown)
  const mmmDay = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (mmmDay) {
    const idx = monthIndexFromAbbrev(mmmDay[1]);
    return {
      mode: "month-day",
      year: "",
      month: idx >= 0 ? MONTHS[idx] : "",
      day: mmmDay[2].padStart(2, "0"),
    };
  }

  // Legacy YYYY-MM-DD (numeric month) — still read, not emitted.
  const numeric = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (numeric) {
    const monthIdx = parseInt(numeric[2], 10) - 1;
    return {
      mode: "full",
      year: numeric[1],
      month: monthIdx >= 0 && monthIdx < 12 ? MONTHS[monthIdx] : "",
      day: numeric[3],
    };
  }

  // Legacy YYYY alone. Hoist into "full" mode so the user is prompted to
  // complete it (add month+day) or switch to "month-day" mode (drop the
  // year). The picker no longer emits bare-year values.
  if (/^\d{4}$/.test(trimmed)) {
    return { mode: "full", year: trimmed, month: "", day: "" };
  }

  return { mode: "full", year: "", month: "", day: "" };
}

function buildValue(parts: Parts): string {
  const y = parts.year.trim();
  const m = parts.month.trim();
  const d = parts.day.trim();
  const hasCompleteYear = /^\d{4}$/.test(y);
  const hasM = m !== "";
  const hasD = d !== "";

  if (parts.mode === "full") {
    // Full mode requires all three. A partial year ("2", "20", "202")
    // intentionally emits "" — the parent doesn't store the half-typed
    // fragment, and our ref-based sync below keeps the typed digits in
    // the input regardless.
    if (hasCompleteYear && hasM && hasD) {
      return `${y}-${m}-${d.padStart(2, "0")}`;
    }
    return "";
  }
  // month-day mode
  if (hasM && hasD) return `${m}-${d.padStart(2, "0")}`;
  return "";
}

export default function PartialDatePicker({
  value,
  onChange,
  label,
  hint,
  disabled,
}: Props) {
  const initial = parseValue(value);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  // Track what we last pushed upstream via onChange. This is the crux of
  // the typing-stability fix: every edit runs emit() which round-trips
  // through the parent's state and re-renders us with the new `value`
  // prop. If we blindly re-parsed that prop we would wipe any state we
  // hold but the parent can't see (partial year, month selected without
  // day, etc). By remembering what we emitted we only re-sync when the
  // parent hands us a value that DIDN'T come from us — genuine external
  // changes like initial hydration, form reset, or switching persons.
  const lastEmittedRef = useRef<string>(value ?? "");

  useEffect(() => {
    const next = value ?? "";
    if (next === lastEmittedRef.current) return;
    const parsed = parseValue(next);
    setMode(parsed.mode);
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
    lastEmittedRef.current = next;
  }, [value]);

  const emit = (next: Parts) => {
    const built = buildValue(next);
    lastEmittedRef.current = built;
    onChange(built);
  };

  const updateMode = (nextMode: Mode) => {
    setMode(nextMode);
    // Switching to month-day drops the typed year so the parent doesn't
    // carry a value it can no longer see. Switching back to full leaves
    // the year field empty for the user to fill in again.
    const nextYear = nextMode === "month-day" ? "" : year;
    if (nextMode === "month-day" && year !== "") setYear("");
    emit({ mode: nextMode, year: nextYear, month, day });
  };

  const updateYear = (next: string) => {
    setYear(next);
    emit({ mode, year: next, month, day });
  };

  const updateMonth = (next: string) => {
    setMonth(next);
    emit({ mode, year, month: next, day });
  };

  const updateDay = (next: string) => {
    setDay(next);
    emit({ mode, year, month, day: next });
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      {/* Mode picker — explicit ask: do you know the year? */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-2">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={mode === "full"}
            onChange={() => updateMode("full")}
            disabled={disabled}
            className="text-amber-600 focus:ring-amber-500"
          />
          <span>Full date</span>
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={mode === "month-day"}
            onChange={() => updateMode("month-day")}
            disabled={disabled}
            className="text-amber-600 focus:ring-amber-500"
          />
          <span>Month &amp; day only (year unknown)</span>
        </label>
      </div>
      <div className={`grid gap-2 ${mode === "full" ? "grid-cols-3" : "grid-cols-2"}`}>
        {mode === "full" && (
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Year"
            value={year}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              updateYear(v);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
            aria-label={label ? `${label} year` : "Year"}
          />
        )}
        <select
          value={month}
          disabled={disabled}
          onChange={(e) => updateMonth(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
          aria-label={label ? `${label} month` : "Month"}
        >
          <option value="">Month</option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={day}
          disabled={disabled}
          onChange={(e) => updateDay(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
          aria-label={label ? `${label} day` : "Day"}
        >
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map(
            (d) => (
              <option key={d} value={d}>
                {d}
              </option>
            )
          )}
        </select>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
