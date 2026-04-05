import { prisma } from "@/lib/db";
import { getPersonRelationships } from "@/lib/relationships";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PersonProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      media: true,
      eventPersons: { include: { event: true } },
    },
  });

  if (!person) notFound();

  const relationships = await getPersonRelationships(id);

  const fullName = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(" ");
  const dates = [
    person.dateOfBirth,
    person.isLiving ? "present" : person.dateOfDeath ?? "?",
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/persons"
          className="text-amber-700 hover:underline text-sm"
        >
          &larr; Back to Family Members
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-3xl mb-4 overflow-hidden">
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                person.firstName.charAt(0).toUpperCase()
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            {person.maidenName && (
              <p className="text-sm text-gray-500">
                nee {person.maidenName}
              </p>
            )}
            {person.nickname && (
              <p className="text-sm text-gray-500">
                &quot;{person.nickname}&quot;
              </p>
            )}
            <p className="text-gray-600 mt-1">{dates}</p>

            {person.generation !== null ? (
              <span className="mt-2 inline-block text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                Generation {person.generation}
              </span>
            ) : (
              <span className="mt-2 inline-block text-xs bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full border border-yellow-200">
                Not yet linked to family tree
              </span>
            )}

            {person.occupation && (
              <p className="text-sm text-gray-500 mt-2">{person.occupation}</p>
            )}
          </div>

          {person.biography && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Biography
              </h3>
              <p className="text-sm text-gray-700">{person.biography}</p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
            <Link
              href={`/persons/${id}/edit`}
              className="text-amber-700 hover:underline text-sm font-medium"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Relationships */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-amber-900 mb-4">
              Relationships
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Parents */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  Parents
                </h3>
                {relationships.father ? (
                  <Link
                    href={`/persons/${relationships.father.id}`}
                    className="block text-sm text-amber-700 hover:underline"
                  >
                    Father: {relationships.father.firstName}{" "}
                    {relationships.father.lastName ?? ""}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400">Father: Unknown</p>
                )}
                {relationships.mother ? (
                  <Link
                    href={`/persons/${relationships.mother.id}`}
                    className="block text-sm text-amber-700 hover:underline"
                  >
                    Mother: {relationships.mother.firstName}{" "}
                    {relationships.mother.lastName ?? ""}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400">Mother: Unknown</p>
                )}
              </div>

              {/* Spouse */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  Spouse
                </h3>
                {relationships.spouses.length > 0 ? (
                  relationships.spouses.map((s) => (
                    <Link
                      key={s.id}
                      href={`/persons/${s.id}`}
                      className="block text-sm text-amber-700 hover:underline"
                    >
                      {s.firstName} {s.lastName ?? ""}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">None</p>
                )}
              </div>

              {/* Children */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  Children
                </h3>
                {relationships.children.length > 0 ? (
                  relationships.children.map((c) => (
                    <Link
                      key={c.id}
                      href={`/persons/${c.id}`}
                      className="block text-sm text-amber-700 hover:underline"
                    >
                      {c.firstName} {c.lastName ?? ""}{" "}
                      {c.gender === "M" ? "(Son)" : c.gender === "F" ? "(Daughter)" : ""}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">None</p>
                )}
              </div>

              {/* Siblings */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">
                  Siblings
                </h3>
                {relationships.siblings.length > 0 ? (
                  relationships.siblings.map((s) => (
                    <Link
                      key={s.id}
                      href={`/persons/${s.id}`}
                      className="block text-sm text-amber-700 hover:underline"
                    >
                      {s.firstName} {s.lastName ?? ""}{" "}
                      {s.gender === "M" ? "(Brother)" : s.gender === "F" ? "(Sister)" : ""}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">None</p>
                )}
              </div>
            </div>
          </div>

          {/* Events */}
          {person.eventPersons.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-4">
                Life Events
              </h2>
              <div className="space-y-3">
                {person.eventPersons.map((ep) => (
                  <div
                    key={ep.event.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <span className="text-gray-400 w-24 flex-shrink-0">
                      {ep.event.eventDate ?? "No date"}
                    </span>
                    <div>
                      <span className="font-medium text-gray-700">
                        {ep.event.title}
                      </span>
                      {ep.event.location && (
                        <span className="text-gray-500 ml-1">
                          - {ep.event.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Media Gallery */}
          {person.media.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-4">
                Photos & Media
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {person.media
                  .filter((m) => m.type === "photo")
                  .map((m) => (
                    <div
                      key={m.id}
                      className="aspect-square rounded-md overflow-hidden bg-gray-100"
                    >
                      <img
                        src={m.url}
                        alt={m.caption ?? ""}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
