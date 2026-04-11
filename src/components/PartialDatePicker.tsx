"use client";

import { useEffect, useState } from "react";

// PartialDatePicker — a Year / Month / Day triple of inputs that emits a
// canonical string in one of two accepted formats:
//
//   YYYY-MMM-DD   full date (e.g. "1985-Apr-08")
//   MMM-DD        month + day only, when the year is unknown (e.g. "Apr-08")
//
// It ALSO reads (but no longer emits) two legacy formats so existing rows
// keep rendering correctly after this picker replaces the old text input:
//
//   YYYY-MM-DD    numeric-month legacy ("1985-04-08")
//   YYYY          year-only legacy
//
// When legacy values arrive via the `value` prop, the picker parses them into
// its Year/Month/Day state and displays them in the new canonical form. On
// the next user edit the parent gets the re-emitted canonical string, so the
// database upgrades itself gradually as people open old profiles.

interface Props {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  // When true, a cleared state emits "" (the field is considered optional).
  // All Year/Month/Day empty is always valid — the picker never forces a full
  // date — but some callers want to treat empty as "not provided" rather
  // than as an explicit change.
  allowEmpty?: boolean;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthIndexFromAbbrev(abbrev: string): number {
  return MONTHS.findIndex((m) => m.toLowerCase() === abbrev.toLowerCase());
}

interface Parts {
  year: string;
  month: string; // canonical Mmm (e.g. "Apr") or ""
  day: string;   // zero-padded "01".."31" or ""
}

function parseValue(value: string | null | undefined): Parts {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { year: "", month: "", day: "" };

  // Canonical YYYY-MMM-DD
  const canonical = trimmed.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/);
  if (canonical) {
    const idx = monthIndexFromAbbrev(canonical[2]);
    return {
      year: canonical[1],
      month: idx >= 0 ? MONTHS[idx] : "",
      day: canonical[3].padStart(2, "0"),
    };
  }

  // Canonical MMM-DD
  const mmmDay = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (mmmDay) {
    const idx = monthIndexFromAbbrev(mmmDay[1]);
    return {
      year: "",
      month: idx >= 0 ? MONTHS[idx] : "",
      day: mmmDay[2].padStart(2, "0"),
    };
  }

  // Legacy YYYY-MM-DD (numeric month)
  const numeric = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (numeric) {
    const monthIdx = parseInt(numeric[2], 10) - 1;
    return {
      year: numeric[1],
      month: monthIdx >= 0 && monthIdx < 12 ? MONTHS[monthIdx] : "",
      day: numeric[3],
    };
  }

  // Legacy YYYY alone
  if (/^\d{4}$/.test(trimmed)) {
    return { year: trimmed, month: "", day: "" };
  }

  return { year: "", month: "", day: "" };
}

function buildValue(year: string, month: string, day: string): string {
  const y = year.trim();
  const m = month.trim();
  const d = day.trim();
  const hasY = y !== "";
  const hasM = m !== "";
  const hasD = d !== "";
  // Full canonical date
  if (hasY && hasM && hasD) return `${y}-${m}-${d.padStart(2, "0")}`;
  // Recurring month/day (year unknown)
  if (!hasY && hasM && hasD) return `${m}-${d.padStart(2, "0")}`;
  // Year only (legacy fallback — still useful when month/day are unknown)
  if (hasY && !hasM && !hasD) return y;
  // Anything else is considered empty / incomplete
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
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  // Keep internal state in sync when the parent replaces `value` externally
  // (for example when the edit page hydrates initialData after the fetch).
  useEffect(() => {
    const parsed = parseValue(value);
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }, [value]);

  const emit = (y: string, m: string, d: string) => {
    onChange(buildValue(y, m, d));
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="Year"
          value={year}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setYear(v);
            emit(v, month, day);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
          aria-label={label ? `${label} year` : "Year"}
        />
        <select
          value={month}
          disabled={disabled}
          onChange={(e) => {
            setMonth(e.target.value);
            emit(year, e.target.value, day);
          }}
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
          onChange={(e) => {
            setDay(e.target.value);
            emit(year, month, e.target.value);
          }}
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
