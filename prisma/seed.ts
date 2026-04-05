import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

function createPrismaClient() {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const prisma = createPrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.setting.upsert({
    where: { key: "family_name" },
    update: {},
    create: { key: "family_name", value: "Vidva-Veronicka Family" },
  });
  await prisma.setting.upsert({
    where: { key: "site_title" },
    update: {},
    create: { key: "site_title", value: "Thalaimuraigal" },
  });
  await prisma.setting.upsert({
    where: { key: "default_language" },
    update: {},
    create: { key: "default_language", value: "en" },
  });

  const grandfather = await prisma.person.create({
    data: {
      firstName: "John",
      lastName: "Subbaiya",
      gender: "M",
      dateOfBirth: "1920",
      dateOfBirthApprox: true,
      isLiving: false,
      dateOfDeath: "1990",
      dateOfDeathApprox: true,
      biography: "Family patriarch, first generation.",
      generation: 0,
    },
  });

  const grandmother = await prisma.person.create({
    data: {
      firstName: "Muthamal",
      gender: "F",
      dateOfBirth: "1925",
      dateOfBirthApprox: true,
      isLiving: false,
      dateOfDeath: "1995",
      dateOfDeathApprox: true,
      generation: 0,
    },
  });

  await prisma.setting.upsert({
    where: { key: "reference_person_id" },
    update: { value: grandfather.id },
    create: { key: "reference_person_id", value: grandfather.id },
  });

  await prisma.spouse.create({
    data: {
      person1Id: grandfather.id,
      person2Id: grandmother.id,
      marriageOrder: 1,
    },
  });

  const father = await prisma.person.create({
    data: {
      firstName: "Theodore",
      lastName: "James",
      gender: "M",
      dateOfBirth: "1950",
      dateOfBirthApprox: true,
      isLiving: false,
      occupation: "Teacher",
      generation: 1,
      birthOrder: 1,
    },
  });

  await prisma.parentChild.create({
    data: { parentId: grandfather.id, childId: father.id, parentType: "father" },
  });
  await prisma.parentChild.create({
    data: { parentId: grandmother.id, childId: father.id, parentType: "mother" },
  });

  const mother = await prisma.person.create({
    data: {
      firstName: "Chandra",
      gender: "F",
      dateOfBirth: "1955",
      dateOfBirthApprox: true,
      isLiving: true,
      generation: 1,
    },
  });

  await prisma.spouse.create({
    data: {
      person1Id: father.id,
      person2Id: mother.id,
      marriageOrder: 1,
    },
  });

  const child = await prisma.person.create({
    data: {
      firstName: "Sherin",
      lastName: "Veronicka",
      gender: "F",
      dateOfBirth: "1985",
      isLiving: true,
      generation: 2,
      birthOrder: 1,
    },
  });

  await prisma.parentChild.create({
    data: { parentId: father.id, childId: child.id, parentType: "father" },
  });
  await prisma.parentChild.create({
    data: { parentId: mother.id, childId: child.id, parentType: "mother" },
  });

  console.log("Seed complete!");
  console.log(`  - ${await prisma.person.count()} persons`);
  console.log(`  - ${await prisma.parentChild.count()} parent-child links`);
  console.log(`  - ${await prisma.spouse.count()} spouse links`);
  console.log(`  - ${await prisma.setting.count()} settings`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
