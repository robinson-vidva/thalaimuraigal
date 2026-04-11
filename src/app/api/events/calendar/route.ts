import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { monthAbbrevToNumber } from "@/lib/date-validation";

export const dynamic = "force-dynamic";

export interface CalendarEvent {
  type: "birthday" | "anniversary" | "remembrance";
  title: string;
  personName: string;
  personId: string;
  date: string;       // original date string as stored
  month: number;      // 1-12
  day: number;        // 1-31
  year?: number;      // original year, if known — omitted for MMM-DD form
}

// Accepts three formats:
//   "YYYY-MM-DD" - full calendar date
//   "MMM-DD"     - month + day only, no year (recurring event, age unknown)
//   "YYYY"       - year only, skipped (no month/day to place on a calendar)
function parseDate(dateStr: string): { month: number; day: number; year?: number } | null {
  if (!dateStr) return null;
  // Full date form
  const full = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    return {
      year: parseInt(full[1], 10),
      month: parseInt(full[2], 10),
      day: parseInt(full[3], 10),
    };
  }
  // Month + day form
  const md = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (md) {
    const month = monthAbbrevToNumber(md[1]);
    if (month === null) return null;
    const day = parseInt(md[2], 10);
    if (day < 1 || day > 31) return null;
    return { month, day };
  }
  // Year-only and anything else — no month/day to place.
  return null;
}

export async function GET() {
  const persons = await prisma.person.findMany();
  const spouses = await prisma.spouse.findMany({
    include: {
      person1: { select: { id: true, firstName: true, lastName: true } },
      person2: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const events: CalendarEvent[] = [];

  for (const p of persons) {
    const name = `${p.firstName} ${p.lastName ?? ""}`.trim();

    // Birthday (for living members)
    if (p.dateOfBirth && p.isLiving) {
      const parsed = parseDate(p.dateOfBirth);
      if (parsed) {
        events.push({
          type: "birthday",
          title: `${name}'s Birthday`,
          personName: name,
          personId: p.id,
          date: p.dateOfBirth,
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        });
      }
    }

    // Remembrance (for deceased members)
    if (!p.isLiving && p.dateOfDeath) {
      const parsed = parseDate(p.dateOfDeath);
      if (parsed) {
        events.push({
          type: "remembrance",
          title: `In Loving Memory of ${name}`,
          personName: name,
          personId: p.id,
          date: p.dateOfDeath,
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        });
      }
    }
  }

  // Wedding anniversaries
  for (const s of spouses) {
    if (s.marriageDate) {
      const parsed = parseDate(s.marriageDate);
      if (parsed) {
        const name1 = `${s.person1.firstName} ${s.person1.lastName ?? ""}`.trim();
        const name2 = `${s.person2.firstName} ${s.person2.lastName ?? ""}`.trim();
        events.push({
          type: "anniversary",
          title: `${name1} & ${name2}'s Anniversary`,
          personName: `${name1} & ${name2}`,
          personId: s.person1.id,
          date: s.marriageDate,
          month: parsed.month,
          day: parsed.day,
          year: parsed.year,
        });
      }
    }
  }

  return NextResponse.json(events);
}
