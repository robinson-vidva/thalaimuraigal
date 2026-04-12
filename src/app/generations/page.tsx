import { prisma } from "@/lib/db";
import { formatDateHuman } from "@/lib/format-date";
import Link from "next/link";

export const dynamic = "force-dynamic";

const genColors = [
  "bg-amber-100 border-amber-300",
  "bg-orange-100 border-orange-300",
  "bg-yellow-100 border-yellow-300",
  "bg-lime-100 border-lime-300",
  "bg-emerald-100 border-emerald-300",
  "bg-teal-100 border-teal-300",
  "bg-cyan-100 border-cyan-300",
  "bg-sky-100 border-sky-300",
];

export default async function GenerationsPage() {
  const persons = await prisma.person.findMany({
    orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
  });

  const linked = persons.filter((p) => p.generation !== null);
  const unlinked = persons.filter((p) => p.generation === null);

  const generationMap = new Map<number, typeof persons>();
  for (const p of linked) {
    const gen = p.generation!;
    if (!generationMap.has(gen)) generationMap.set(gen, []);
    generationMap.get(gen)!.push(p);
  }

  const generations = Array.from(generationMap.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-2">
        Generations View
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Family members grouped by generation. Generation 0 is the reference
        person.
      </p>

      {generations.length === 0 ? (
        <p className="text-gray-500">
          No linked family members yet.{" "}
          <Link href="/persons/new" className="text-amber-700 underline">
            Add members
          </Link>{" "}
          and link them to see generations.
        </p>
      ) : (
        <div className="space-y-4">
          {generations.map(([gen, members], idx) => (
            <div
              key={gen}
              className={`rounded-lg border-2 p-4 ${genColors[Math.abs(gen) % genColors.length]}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-800 text-white font-bold text-sm">
                  {gen}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-amber-900">
                    Generation {gen}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {members.length} member{members.length !== 1 ? "s" : ""}
                    {gen === 0 ? " (reference)" : ""}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((p) => (
                  <Link
                    key={p.id}
                    href={`/persons/${p.id}`}
                    className="inline-flex items-center gap-2 bg-white/80 hover:bg-white border border-gray-200 rounded-full px-4 py-2 text-sm transition-colors shadow-sm"
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                        p.gender === "M"
                          ? "bg-amber-700"
                          : p.gender === "F"
                            ? "bg-amber-500"
                            : "bg-gray-400"
                      }`}
                    >
                      {p.firstName.charAt(0)}
                    </span>
                    <span className="text-gray-800 font-medium">
                      {p.firstName} {p.lastName ?? ""}
                    </span>
                    {p.dateOfBirth && (
                      <span className="text-gray-400 text-xs">
                        b. {formatDateHuman(p.dateOfBirth)}
                      </span>
                    )}
                    {!p.isLiving && (
                      <span className="text-gray-400 text-xs">†</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-600 mb-3">
            Unlinked Members
            <span className="text-sm font-normal text-gray-400 ml-2">
              ({unlinked.length})
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {unlinked.map((p) => (
              <Link
                key={p.id}
                href={`/persons/${p.id}`}
                className="inline-flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-4 py-2 text-sm transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center font-bold text-xs text-white">
                  {p.firstName.charAt(0)}
                </span>
                <span className="text-gray-600">{p.firstName} {p.lastName ?? ""}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
