import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TreeNode {
  name: string;
  attributes: Record<string, string>;
  children: TreeNode[];
  _id: string;
}

export async function GET() {
  const persons = await prisma.person.findMany();
  const parentChildLinks = await prisma.parentChild.findMany();
  const spouseLinks = await prisma.spouse.findMany();

  // Build parent-child map: childId -> parentIds
  const childToParents = new Map<string, string[]>();
  const parentToChildren = new Map<string, string[]>();
  for (const link of parentChildLinks) {
    if (!childToParents.has(link.childId)) childToParents.set(link.childId, []);
    childToParents.get(link.childId)!.push(link.parentId);
    if (!parentToChildren.has(link.parentId)) parentToChildren.set(link.parentId, []);
    parentToChildren.get(link.parentId)!.push(link.childId);
  }

  // Build spouse map
  const spouseMap = new Map<string, string[]>();
  for (const s of spouseLinks) {
    if (!spouseMap.has(s.person1Id)) spouseMap.set(s.person1Id, []);
    spouseMap.get(s.person1Id)!.push(s.person2Id);
    if (!spouseMap.has(s.person2Id)) spouseMap.set(s.person2Id, []);
    spouseMap.get(s.person2Id)!.push(s.person1Id);
  }

  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Find root persons (those who have no parents in the data)
  const roots = persons.filter((p) => !childToParents.has(p.id));

  // Build tree recursively
  const visited = new Set<string>();

  function buildNode(personId: string): TreeNode | null {
    if (visited.has(personId)) return null;
    visited.add(personId);

    const person = personMap.get(personId);
    if (!person) return null;

    const spouses = spouseMap.get(personId) || [];
    const spouseNames = spouses
      .map((sid) => personMap.get(sid))
      .filter(Boolean)
      .map((s) => `${s!.firstName} ${s!.lastName ?? ""}`.trim());

    const children = parentToChildren.get(personId) || [];
    // Also include children of spouses
    for (const sid of spouses) {
      const spouseChildren = parentToChildren.get(sid) || [];
      for (const c of spouseChildren) {
        if (!children.includes(c)) children.push(c);
      }
    }
    // Mark spouses as visited so they don't appear as separate roots
    for (const sid of spouses) visited.add(sid);

    const childNodes = children
      .map((cid) => buildNode(cid))
      .filter(Boolean) as TreeNode[];

    return {
      name: `${person.firstName} ${person.lastName ?? ""}`.trim(),
      _id: person.id,
      attributes: {
        ...(person.gender ? { gender: person.gender } : {}),
        ...(person.dateOfBirth ? { born: person.dateOfBirth } : {}),
        ...(person.dateOfDeath ? { died: person.dateOfDeath } : {}),
        ...(spouseNames.length > 0 ? { spouse: spouseNames.join(", ") } : {}),
        ...(person.generation !== null ? { generation: String(person.generation) } : {}),
      },
      children: childNodes,
    };
  }

  const tree: TreeNode[] = [];
  for (const root of roots) {
    const node = buildNode(root.id);
    if (node) tree.push(node);
  }

  return NextResponse.json(tree);
}
