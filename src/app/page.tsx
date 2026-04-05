import Link from "next/link";
import { prisma } from "@/lib/db";

interface SimpleEvent {
  type: "birthday" | "anniversary" | "remembrance";
  title: string;
  personId: string;
  daysAway: number;
}

function parseMonthDay(dateStr: string): { month: number; day: number } | null {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { month: parseInt(m[2]), day: parseInt(m[3]) };
}

function daysUntil(month: number, day: number): number {
  const now = new Date();
  const thisYear = now.getFullYear();
  let next = new Date(thisYear, month - 1, day);
  const today = new Date(thisYear, now.getMonth(), now.getDate());
  if (next < today) next = new Date(thisYear + 1, month - 1, day);
  return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const ICONS: Record<string, string> = { birthday: "\uD83C\uDF82", anniversary: "\uD83D\uDC8D", remembrance: "\uD83D\uDD4A\uFE0F" };

export default async function Home() {
  // Fetch upcoming events server-side
  const persons = await prisma.person.findMany();
  const spouses = await prisma.spouse.findMany({
    include: {
      person1: { select: { id: true, firstName: true, lastName: true } },
      person2: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const events: SimpleEvent[] = [];

  for (const p of persons) {
    const name = `${p.firstName} ${p.lastName ?? ""}`.trim();
    if (p.dateOfBirth && p.isLiving) {
      const md = parseMonthDay(p.dateOfBirth);
      if (md) {
        const d = daysUntil(md.month, md.day);
        if (d <= 7) events.push({ type: "birthday", title: `${name}'s Birthday`, personId: p.id, daysAway: d });
      }
    }
    if (!p.isLiving && p.dateOfDeath) {
      const md = parseMonthDay(p.dateOfDeath);
      if (md) {
        const d = daysUntil(md.month, md.day);
        if (d <= 7) events.push({ type: "remembrance", title: `In Loving Memory of ${name}`, personId: p.id, daysAway: d });
      }
    }
  }

  for (const s of spouses) {
    if (s.marriageDate) {
      const md = parseMonthDay(s.marriageDate);
      if (md) {
        const n1 = `${s.person1.firstName}`;
        const n2 = `${s.person2.firstName}`;
        const d = daysUntil(md.month, md.day);
        if (d <= 7) events.push({ type: "anniversary", title: `${n1} & ${n2}'s Anniversary`, personId: s.person1.id, daysAway: d });
      }
    }
  }

  events.sort((a, b) => a.daysAway - b.daysAway);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h1 className="text-5xl font-bold text-amber-900 mb-2">தலைமுறைகள்</h1>
      <h2 className="text-2xl text-amber-700 mb-6">Thalaimuraigal</h2>
      <p className="text-gray-600 max-w-lg mb-8">
        Preserving family history across generations. Explore your family tree,
        discover relationships, and keep the stories of your ancestors alive.
      </p>
      <div className="flex gap-4 mb-12">
        <Link href="/persons" className="bg-amber-700 text-white px-6 py-3 rounded-lg hover:bg-amber-800 font-medium transition-colors">View Family Members</Link>
        <Link href="/persons/new" className="border-2 border-amber-700 text-amber-700 px-6 py-3 rounded-lg hover:bg-amber-100 font-medium transition-colors">Add a Member</Link>
      </div>

      {/* Upcoming events */}
      {events.length > 0 && (
        <div className="w-full max-w-lg text-left">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Upcoming This Week</h3>
            <Link href="/calendar" className="text-xs text-amber-600 hover:underline">View calendar &rarr;</Link>
          </div>
          <div className="space-y-2">
            {events.slice(0, 5).map((e, i) => (
              <Link
                key={i}
                href={`/persons/${e.personId}`}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:shadow-sm transition-shadow"
              >
                <span className="text-xl">{ICONS[e.type]}</span>
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">{e.title}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {e.daysAway === 0 ? "Today" : e.daysAway === 1 ? "Tomorrow" : `${e.daysAway}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
