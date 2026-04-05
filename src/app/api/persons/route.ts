import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recalculateGenerations } from "@/lib/generations";

// GET /api/persons - List all persons with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search");
  const generation = searchParams.get("generation");
  const gender = searchParams.get("gender");
  const isLiving = searchParams.get("isLiving");
  const familySide = searchParams.get("familySide");

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
  if (familySide) where.familySide = familySide;

  const persons = await prisma.person.findMany({
    where,
    orderBy: [{ generation: "asc" }, { birthOrder: "asc" }, { firstName: "asc" }],
    include: {
      childOf: {
        include: { parent: { select: { id: true, firstName: true, lastName: true } } },
      },
      spouse1: {
        include: { person2: { select: { id: true, firstName: true, lastName: true } } },
      },
      spouse2: {
        include: { person1: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  return NextResponse.json(persons);
}

// POST /api/persons - Create a new person
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    fatherId,
    motherId,
    spouseId,
    ...personData
  } = body;

  const person = await prisma.person.create({
    data: personData,
  });

  // Create parent-child relationships
  if (fatherId) {
    await prisma.parentChild.create({
      data: {
        parentId: fatherId,
        childId: person.id,
        parentType: "father",
      },
    });
  }

  if (motherId) {
    await prisma.parentChild.create({
      data: {
        parentId: motherId,
        childId: person.id,
        parentType: "mother",
      },
    });
  }

  // Create spouse relationship
  if (spouseId) {
    await prisma.spouse.create({
      data: {
        person1Id: person.id,
        person2Id: spouseId,
      },
    });
  }

  // Recalculate generations if relationships were added
  if (fatherId || motherId || spouseId) {
    await recalculateGenerations();
  }

  return NextResponse.json(person, { status: 201 });
}
