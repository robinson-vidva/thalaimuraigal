import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations } from "@/lib/generations";

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

    const { fatherId, motherId, spouseId, ...rest } = body;

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

    if ("fatherId" in body || "motherId" in body || "spouseId" in body) {
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
