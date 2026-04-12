import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations } from "@/lib/generations";
import { validatePersonDates, validatePartialDate } from "@/lib/date-validation";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const generation = searchParams.get("generation");
  const gender = searchParams.get("gender");
  const isLiving = searchParams.get("isLiving");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { nickname: { contains: search } },
      { maidenName: { contains: search } },
    ];
  }
  if (generation) where.generation = parseInt(generation);
  if (gender) where.gender = gender;
  if (isLiving !== null && isLiving !== undefined && isLiving !== "") {
    where.isLiving = isLiving === "true";
  }

  const persons = await prisma.person.findMany({
    where,
    orderBy: [{ generation: "asc" }, { birthOrder: "asc" }, { firstName: "asc" }],
    include: {
      childOf: {
        include: { parent: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      },
      spouse1: {
        include: { person2: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      },
      spouse2: {
        include: { person1: { select: { id: true, firstName: true, lastName: true, gender: true } } },
      },
    },
  });

  return NextResponse.json(persons);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fatherId, motherId, spouseId, marriageDate, childrenIds, ...personData } = body;

    if (!personData.firstName || typeof personData.firstName !== "string" || !personData.firstName.trim()) {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      );
    }

    const dateError = validatePersonDates({
      dateOfBirth: personData.dateOfBirth,
      dateOfDeath: personData.dateOfDeath,
    });
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 });
    }

    if (marriageDate) {
      const marriageError = validatePartialDate(marriageDate, "Marriage date");
      if (marriageError) {
        return NextResponse.json({ error: marriageError }, { status: 400 });
      }
    }

    const childIdsList: string[] = Array.isArray(childrenIds) ? childrenIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0) : [];

    // If children are being linked, we need a gender to decide father vs mother.
    if (childIdsList.length > 0 && personData.gender !== "M" && personData.gender !== "F") {
      return NextResponse.json(
        { error: "Set gender to Male or Female before linking children \u2014 it determines whether the link is father or mother." },
        { status: 400 }
      );
    }

    const parentType: "father" | "mother" | null =
      personData.gender === "M" ? "father" : personData.gender === "F" ? "mother" : null;

    // Reject up front if any selected child already has a biological parent of this type.
    if (parentType && childIdsList.length > 0) {
      const conflicts = await prisma.parentChild.findMany({
        where: { childId: { in: childIdsList }, parentType, isBiological: true },
        include: { child: { select: { firstName: true, lastName: true } } },
      });
      if (conflicts.length > 0) {
        const names = conflicts
          .map((c) => `${c.child.firstName} ${c.child.lastName ?? ""}`.trim())
          .join(", ");
        return NextResponse.json(
          { error: `Cannot link as ${parentType}: already has a biological ${parentType} \u2014 ${names}` },
          { status: 400 }
        );
      }
    }

    const person = await prisma.person.create({ data: personData });

    if (fatherId) {
      await prisma.parentChild.create({
        data: { parentId: fatherId, childId: person.id, parentType: "father" },
      });
    }
    if (motherId) {
      await prisma.parentChild.create({
        data: { parentId: motherId, childId: person.id, parentType: "mother" },
      });
    }
    if (spouseId) {
      await prisma.spouse.create({
        data: {
          person1Id: person.id,
          person2Id: spouseId,
          ...(marriageDate ? { marriageDate } : {}),
        },
      });
    }

    if (parentType && childIdsList.length > 0) {
      await prisma.parentChild.createMany({
        data: childIdsList.map((childId: string) => ({
          parentId: person.id,
          childId,
          parentType,
        })),
      });
    }

    if (fatherId || motherId || spouseId || childIdsList.length > 0) {
      await recalculateGenerations();
    }

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    console.error("POST /api/persons error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create person" },
      { status: 500 }
    );
  }
}
