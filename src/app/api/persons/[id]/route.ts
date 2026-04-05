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

    const updateData: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) updateData[key] = body[key];
    }

    const person = await prisma.person.update({ where: { id }, data: updateData });
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
  const { id } = params;
  await prisma.person.delete({ where: { id } });
  await recalculateGenerations();
  return NextResponse.json({ success: true });
}
