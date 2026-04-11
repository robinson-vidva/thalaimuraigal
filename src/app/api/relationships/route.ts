import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations, validateNoCycle } from "@/lib/generations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (type === "parent_child") {
      const { parentId, childId, parentType, isBiological, isAdopted } = body;
      if (!parentId || !childId || !parentType) {
        return NextResponse.json(
          { error: "parentId, childId and parentType are required" },
          { status: 400 }
        );
      }
      const safe = await validateNoCycle(parentId, childId);
      if (!safe) {
        return NextResponse.json(
          { error: "This relationship would create a circular reference" },
          { status: 400 }
        );
      }
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
      if (!person1Id || !person2Id) {
        return NextResponse.json(
          { error: "person1Id and person2Id are required" },
          { status: 400 }
        );
      }
      if (person1Id === person2Id) {
        return NextResponse.json(
          { error: "A person cannot be their own spouse" },
          { status: 400 }
        );
      }
      const rel = await prisma.spouse.create({
        data: { person1Id, person2Id, marriageDate, marriagePlace, marriageOrder },
      });
      await recalculateGenerations();
      return NextResponse.json(rel, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid relationship type" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/relationships error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create relationship" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error("DELETE /api/relationships error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete relationship" },
      { status: 500 }
    );
  }
}
