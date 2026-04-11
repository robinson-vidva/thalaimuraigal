import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Flat shape: one record per person with ids of their direct relatives.
// The tree page handles layout. Keeping the API "dumb" means we don't have
// to hand-craft a recursive structure that can't faithfully represent the
// DAG shape of a family — any person may be the endpoint of multiple
// lineages and we want to place them exactly once.
export interface TreePerson {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  generation: number | null;
  parentIds: string[];   // biological parents (father + mother, if known)
  spouseIds: string[];   // current spouses
  childIds: string[];    // direct biological children
}

export async function GET() {
  const [persons, parentChildRows, spouseRows] = await Promise.all([
    prisma.person.findMany({
      orderBy: [{ generation: "asc" }, { birthOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.parentChild.findMany(),
    prisma.spouse.findMany(),
  ]);

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const row of parentChildRows) {
    if (!parentsOf.has(row.childId)) parentsOf.set(row.childId, []);
    parentsOf.get(row.childId)!.push(row.parentId);
    if (!childrenOf.has(row.parentId)) childrenOf.set(row.parentId, []);
    childrenOf.get(row.parentId)!.push(row.childId);
  }

  const spousesOf = new Map<string, string[]>();
  for (const row of spouseRows) {
    if (!spousesOf.has(row.person1Id)) spousesOf.set(row.person1Id, []);
    spousesOf.get(row.person1Id)!.push(row.person2Id);
    if (!spousesOf.has(row.person2Id)) spousesOf.set(row.person2Id, []);
    spousesOf.get(row.person2Id)!.push(row.person1Id);
  }

  const payload: TreePerson[] = persons.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth,
    dateOfDeath: p.dateOfDeath,
    generation: p.generation,
    parentIds: parentsOf.get(p.id) ?? [],
    spouseIds: spousesOf.get(p.id) ?? [],
    childIds: childrenOf.get(p.id) ?? [],
  }));

  return NextResponse.json(payload);
}
