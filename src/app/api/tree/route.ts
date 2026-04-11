import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Partner {
  name: string;
  attributes: Record<string, string>;
  _id: string;
}

interface TreeNode {
  name: string;
  attributes: Record<string, string>;
  children: TreeNode[];
  _id: string;
  partner?: Partner;
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

  // Find root persons. A person is a tree root when:
  //  1. They have no parents in the data, AND
  //  2. None of their spouses have parents either.
  //
  // The second rule avoids a subtle ordering bug: if someone has no parents
  // but is married to a person who DOES have parents, their spouse's tree
  // will naturally absorb them as a partner card. If we still listed them
  // here, iteration order could cause the "partnerless" spouse to be
  // processed first, claim their partner, and then the actual ancestor's
  // subtree would find its child already visited — leaving the ancestor
  // stranded as a childless root. Excluding these spouses from the root
  // list keeps the couple anchored under the side of the family that has
  // known ancestors.
  const roots = persons.filter((p) => {
    if (childToParents.has(p.id)) return false;
    const spouses = spouseMap.get(p.id) || [];
    for (const sid of spouses) {
      if (childToParents.has(sid)) return false;
    }
    return true;
  });

  // Build tree recursively
  const visited = new Set<string>();

  function buildNode(personId: string): TreeNode | null {
    if (visited.has(personId)) return null;
    visited.add(personId);

    const person = personMap.get(personId);
    if (!person) return null;

    // Pick the first unvisited spouse to render as a partner card.
    const spouses = spouseMap.get(personId) || [];
    let partner: Partner | undefined;
    for (const sid of spouses) {
      if (visited.has(sid)) continue;
      const sp = personMap.get(sid);
      if (!sp) continue;
      partner = {
        name: `${sp.firstName} ${sp.lastName ?? ""}`.trim(),
        _id: sp.id,
        attributes: {
          ...(sp.gender ? { gender: sp.gender } : {}),
          ...(sp.dateOfBirth ? { born: sp.dateOfBirth } : {}),
          ...(sp.dateOfDeath ? { died: sp.dateOfDeath } : {}),
          ...(sp.generation !== null ? { generation: String(sp.generation) } : {}),
        },
      };
      visited.add(sid);
      break;
    }
    // Mark any remaining spouses as visited too, so they don't re-render as roots.
    for (const sid of spouses) visited.add(sid);

    // Children: merge the person's children with the partner's children so
    // half-siblings and shared kids all descend from this couple unit.
    const children = [...(parentToChildren.get(personId) || [])];
    for (const sid of spouses) {
      const spouseChildren = parentToChildren.get(sid) || [];
      for (const c of spouseChildren) {
        if (!children.includes(c)) children.push(c);
      }
    }

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
        ...(person.generation !== null ? { generation: String(person.generation) } : {}),
      },
      children: childNodes,
      ...(partner ? { partner } : {}),
    };
  }

  const tree: TreeNode[] = [];
  for (const root of roots) {
    const node = buildNode(root.id);
    if (node) tree.push(node);
  }

  return NextResponse.json(tree);
}
