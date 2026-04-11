import { prisma } from "./db";

export interface PersonRelationships {
  father: SimplePerson | null;
  mother: SimplePerson | null;
  spouses: SimplePerson[];
  children: SimplePerson[];
  siblings: SimplePerson[];
}

interface SimplePerson {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  isLiving: boolean;
  birthOrder: number | null;
}

export async function getPersonRelationships(
  personId: string
): Promise<PersonRelationships> {
  const selectFields = {
    id: true,
    firstName: true,
    lastName: true,
    gender: true,
    photoUrl: true,
    dateOfBirth: true,
    dateOfDeath: true,
    isLiving: true,
    birthOrder: true,
  } as const;

  const parentLinks = await prisma.parentChild.findMany({
    where: { childId: personId },
    include: { parent: { select: selectFields } },
  });

  // Categorise each parent link as father or mother. We prefer the explicit
  // parent_type column when it matches, but we fall back to the parent's
  // own gender when the column is missing, miscased, or set to anything
  // outside the expected set — otherwise the profile page silently says
  // "Unknown" while the tree view is still drawing the edge, and the two
  // surfaces disagree about the same underlying row. Case-insensitive so
  // any legacy "Father"/"FATHER" writes are also picked up.
  function resolveParentRole(link: (typeof parentLinks)[number]): "father" | "mother" | null {
    const pt = (link.parentType ?? "").toLowerCase().trim();
    if (pt === "father") return "father";
    if (pt === "mother") return "mother";
    const g = link.parent.gender;
    if (g === "M") return "father";
    if (g === "F") return "mother";
    return null;
  }

  let father: SimplePerson | null = null;
  let mother: SimplePerson | null = null;
  for (const link of parentLinks) {
    const role = resolveParentRole(link);
    if (role === "father" && !father) father = link.parent;
    else if (role === "mother" && !mother) mother = link.parent;
  }

  const spouseLinks1 = await prisma.spouse.findMany({
    where: { person1Id: personId },
    include: { person2: { select: selectFields } },
  });
  const spouseLinks2 = await prisma.spouse.findMany({
    where: { person2Id: personId },
    include: { person1: { select: selectFields } },
  });
  const spouses = [
    ...spouseLinks1.map((s) => s.person2),
    ...spouseLinks2.map((s) => s.person1),
  ];

  const childLinks = await prisma.parentChild.findMany({
    where: { parentId: personId },
    include: { child: { select: selectFields } },
    orderBy: { child: { birthOrder: "asc" } },
  });
  const children = childLinks.map((c) => c.child);

  const parentIds = parentLinks.map((p) => p.parentId);
  const siblingLinks = await prisma.parentChild.findMany({
    where: {
      parentId: { in: parentIds },
      childId: { not: personId },
    },
    include: { child: { select: selectFields } },
  });
  const siblingMap = new Map<string, SimplePerson>();
  for (const sl of siblingLinks) {
    siblingMap.set(sl.child.id, sl.child);
  }
  const siblings = Array.from(siblingMap.values()).sort(
    (a, b) => (a.birthOrder ?? 999) - (b.birthOrder ?? 999)
  );

  return { father, mother, spouses, children, siblings };
}
