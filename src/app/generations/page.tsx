import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GenerationsPage() {
  const persons = await prisma.person.findMany({
    where: { generation: { not: null } },
    orderBy: [{ generation: "asc" }, { birthOrder: "asc" }],
  });

  // Group by generation
  const generationMap = new Map<number, typeof persons>();
  for (const p of persons) {
    const gen = p.generation!;
    if (!generationMap.has(gen)) generationMap.set(gen, []);
    generationMap.get(gen)!.push(p);
  }

  const generations = Array.from(generationMap.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-6">
        Generations View
      </h1>

      {generations.length === 0 ? (
        <p className="text-gray-500">
          No linked family members yet. Add members and link them to see
          generations.
        </p>
      ) : (
        <div className="space-y-6">
          {generations.map(([gen, members]) => (
            <div key={gen} className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold text-amber-800 mb-3 border-b border-amber-100 pb-2">
                Generation {gen}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({members.length} member{members.length !== 1 ? "s" : ""})
                </span>
              </h2>
              <div className="flex flex-wrap gap-3">
                {members.map((p) => (
                  <Link
                    key={p.id}
                    href={`/persons/${p.id}`}
                    className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full px-4 py-2 text-sm transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
                      {p.firstName.charAt(0)}
                    </span>
                    <span className="text-amber-900 font-medium">
                      {p.firstName} {p.lastName ?? ""}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {p.gender === "M" ? "M" : p.gender === "F" ? "F" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
