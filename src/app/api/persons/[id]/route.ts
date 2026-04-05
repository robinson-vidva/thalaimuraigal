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
    const { fatherId, motherId, spouseId, familySide, birthOrder, ...personData } = body;

    const updateData: Record<string, unknown> = { ...personData };
    if (familySide !== undefined) updateData.familySide = familySide;
    if (birthOrder !== undefined) updateData.birthOrder = birthOrder;

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
