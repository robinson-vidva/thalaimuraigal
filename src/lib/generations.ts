import { prisma } from "./db";

export async function recalculateGenerations(): Promise<void> {
  const refSetting = await prisma.setting.findUnique({
    where: { key: "reference_person_id" },
  });

  let referencePersonId = refSetting?.value;

  if (!referencePersonId) {
    const first = await prisma.person.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!first) return;
    referencePersonId = first.id;
    await prisma.setting.upsert({
      where: { key: "reference_person_id" },
      update: { value: referencePersonId },
      create: { key: "reference_person_id", value: referencePersonId },
    });
  }

  const parentChildRows = await prisma.parentChild.findMany();
  const spouseRows = await prisma.spouse.findMany();

  const parentToChildren = new Map<string, string[]>();
  const childToParents = new Map<string, string[]>();
  const spouseMap = new Map<string, string[]>();

  for (const pc of parentChildRows) {
    if (!parentToChildren.has(pc.parentId)) parentToChildren.set(pc.parentId, []);
    parentToChildren.get(pc.parentId)!.push(pc.childId);
    if (!childToParents.has(pc.childId)) childToParents.set(pc.childId, []);
    childToParents.get(pc.childId)!.push(pc.parentId);
  }

  for (const s of spouseRows) {
    if (!spouseMap.has(s.person1Id)) spouseMap.set(s.person1Id, []);
    spouseMap.get(s.person1Id)!.push(s.person2Id);
    if (!spouseMap.has(s.person2Id)) spouseMap.set(s.person2Id, []);
    spouseMap.get(s.person2Id)!.push(s.person1Id);
  }

  const generationMap = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { id: string; gen: number }[] = [
    { id: referencePersonId, gen: 0 },
  ];

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    generationMap.set(id, gen);

    for (const parentId of childToParents.get(id) ?? []) {
      if (!visited.has(parentId)) queue.push({ id: parentId, gen: gen - 1 });
    }
    for (const childId of parentToChildren.get(id) ?? []) {
      if (!visited.has(childId)) queue.push({ id: childId, gen: gen + 1 });
    }
    for (const spouseId of spouseMap.get(id) ?? []) {
      if (!visited.has(spouseId)) queue.push({ id: spouseId, gen });
    }
  }

  const allPersons = await prisma.person.findMany({ select: { id: true } });

  await prisma.$transaction(
    allPersons.map((p) =>
      prisma.person.update({
        where: { id: p.id },
        data: { generation: generationMap.get(p.id) ?? null },
      })
    )
  );
}

export async function validateNoCycle(
  parentId: string,
  childId: string
): Promise<boolean> {
  if (parentId === childId) return false;

  const parentChildRows = await prisma.parentChild.findMany();
  const childToParents = new Map<string, string[]>();

  for (const pc of parentChildRows) {
    if (!childToParents.has(pc.childId)) childToParents.set(pc.childId, []);
    childToParents.get(pc.childId)!.push(pc.parentId);
  }

  const visited = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === childId) return false;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const p of childToParents.get(current) ?? []) {
      queue.push(p);
    }
  }

  return true;
}
