import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations, validateNoCycle } from "@/lib/generations";

// POST /api/relationships - Create a parent-child or spouse relationship
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type } = body; // 'parent_child' or 'spouse'

  if (type === "parent_child") {
    const { parentId, childId, parentType, isBiological, isAdopted } = body;

    // Validate no cycles
    const safe = await validateNoCycle(parentId, childId);
    if (!safe) {
      return NextResponse.json(
        { error: "This relationship would create a circular reference" },
        { status: 400 }
      );
    }

    // Validate max 1 father and 1 mother (biological)
    if (isBiological !== false) {
      const existing = await prisma.parentChild.findFirst({
        where: { childId, parentType, isBiological: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: `This person already has a biological ${parentType}` },
          { status: 400 }
        );
      }
    }

    const rel = await prisma.parentChild.create({
      data: { parentId, childId, parentType, isBiological, isAdopted },
    });

    await recalculateGenerations();
    return NextResponse.json(rel, { status: 201 });
  }

  if (type === "spouse") {
    const { person1Id, person2Id, marriageDate, marriagePlace, marriageOrder } = body;

    const rel = await prisma.spouse.create({
      data: { person1Id, person2Id, marriageDate, marriagePlace, marriageOrder },
    });

    await recalculateGenerations();
    return NextResponse.json(rel, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid relationship type" }, { status: 400 });
}

// DELETE /api/relationships - Remove a relationship
export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id || !type) {
    return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
  }

  if (type === "parent_child") {
    await prisma.parentChild.delete({ where: { id } });
  } else if (type === "spouse") {
    await prisma.spouse.delete({ where: { id } });
  } else {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  await recalculateGenerations();
  return NextResponse.json({ success: true });
}
