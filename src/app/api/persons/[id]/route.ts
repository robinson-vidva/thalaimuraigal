import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations, validateNoCycle } from "@/lib/generations";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      childOf: { include: { parent: true } },
      parentOf: { include: { child: true } },
      spouse1: { include: { person2: true } },
      spouse2: { include: { person1: true } },
      media: true,
      eventPersons: { include: { event: true } },
    },
  });

  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  return NextResponse.json(person);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Only allow valid Person scalar fields — strip relations and metadata
    const allowedFields = [
      "firstName", "lastName", "maidenName", "nickname", "gender",
      "dateOfBirth", "dateOfBirthApprox", "placeOfBirth",
      "dateOfDeath", "dateOfDeathApprox", "placeOfDeath", "isLiving",
      "biography", "occupation", "education", "religion", "denomination",
      "email", "phone", "currentCity", "currentState", "currentCountry",
      "photoUrl", "birthLatitude", "birthLongitude",
      "currentLatitude", "currentLongitude",
      "generation", "familySide", "birthOrder", "addedBy", "notes",
    ];

    const { fatherId, motherId, spouseId, childrenIds, ...rest } = body;

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in rest) updateData[key] = rest[key];
    }

    const person = await prisma.person.update({ where: { id }, data: updateData });

    // Update father relationship
    if ("fatherId" in body) {
      await prisma.parentChild.deleteMany({ where: { childId: id, parentType: "father" } });
      if (fatherId) {
        await prisma.parentChild.create({ data: { parentId: fatherId, childId: id, parentType: "father" } });
      }
    }

    // Update mother relationship
    if ("motherId" in body) {
      await prisma.parentChild.deleteMany({ where: { childId: id, parentType: "mother" } });
      if (motherId) {
        await prisma.parentChild.create({ data: { parentId: motherId, childId: id, parentType: "mother" } });
      }
    }

    // Update spouse relationship
    if ("spouseId" in body) {
      await prisma.spouse.deleteMany({
        where: { OR: [{ person1Id: id }, { person2Id: id }] },
      });
      if (spouseId) {
        await prisma.spouse.create({ data: { person1Id: id, person2Id: spouseId } });
      }
    }

    // Update children relationships (diff existing vs desired)
    let childrenChanged = false;
    if ("childrenIds" in body) {
      const desiredIds: string[] = Array.isArray(childrenIds)
        ? childrenIds.filter((cid: unknown): cid is string => typeof cid === "string" && cid.length > 0)
        : [];
      const gender = (rest.gender ?? person.gender) as string | null | undefined;
      const parentType: "father" | "mother" | null =
        gender === "M" ? "father" : gender === "F" ? "mother" : null;

      if (desiredIds.length > 0 && !parentType) {
        return NextResponse.json(
          { error: "Set gender to Male or Female before linking children." },
          { status: 400 }
        );
      }

      // Current children for this person (of this parentType if known, else all).
      const existing = await prisma.parentChild.findMany({
        where: parentType ? { parentId: id, parentType } : { parentId: id },
      });
      const existingChildIds = new Set(existing.map((r) => r.childId));
      const desiredSet = new Set(desiredIds);

      const toRemove = existing.filter((r) => !desiredSet.has(r.childId));
      const toAdd = desiredIds.filter((cid) => !existingChildIds.has(cid));

      // Validate cycles and duplicate-parent conflicts BEFORE mutating.
      for (const childId of toAdd) {
        if (childId === id) {
          return NextResponse.json(
            { error: "A person cannot be their own child" },
            { status: 400 }
          );
        }
        const safe = await validateNoCycle(id, childId);
        if (!safe) {
          return NextResponse.json(
            { error: "That child link would create a circular relationship" },
            { status: 400 }
          );
        }
        if (parentType) {
          const conflict = await prisma.parentChild.findFirst({
            where: { childId, parentType, isBiological: true, parentId: { not: id } },
          });
          if (conflict) {
            const child = await prisma.person.findUnique({
              where: { id: childId },
              select: { firstName: true, lastName: true },
            });
            const name = child ? `${child.firstName} ${child.lastName ?? ""}`.trim() : "this child";
            return NextResponse.json(
              { error: `${name} already has a biological ${parentType}` },
              { status: 400 }
            );
          }
        }
      }

      if (toRemove.length > 0) {
        await prisma.parentChild.deleteMany({
          where: { id: { in: toRemove.map((r) => r.id) } },
        });
        childrenChanged = true;
      }
      if (toAdd.length > 0 && parentType) {
        await prisma.parentChild.createMany({
          data: toAdd.map((childId) => ({ parentId: id, childId, parentType })),
        });
        childrenChanged = true;
      }
    }

    if ("fatherId" in body || "motherId" in body || "spouseId" in body || childrenChanged) {
      await recalculateGenerations();
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error("PUT /api/persons/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // If this person is the generation reference, clear the setting BEFORE
    // deleting — otherwise recalculateGenerations() would BFS from a ghost ID
    // and silently null out every other person's generation.
    const refSetting = await prisma.setting.findUnique({
      where: { key: "reference_person_id" },
    });
    if (refSetting?.value === id) {
      await prisma.setting.delete({ where: { key: "reference_person_id" } });
    }

    await prisma.person.delete({ where: { id } });
    await recalculateGenerations();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/persons/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete person" },
      { status: 500 }
    );
  }
}
