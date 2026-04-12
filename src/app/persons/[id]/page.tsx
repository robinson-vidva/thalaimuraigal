import { prisma } from "@/lib/db";
import { getPersonRelationships } from "@/lib/relationships";
import Link from "next/link";
import { notFound } from "next/navigation";
import DeletePersonButton from "@/components/DeletePersonButton";

// Render a single labeled field only when it actually has a value. Handles
// strings, numbers, and 0 correctly (empty string and null/undefined hide
// the row; numeric 0 still renders because birth_order = 0 is nonsense but
// any legitimate integer should survive).
function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap break-words">{value}</dd>
    </div>
  );
}

function genderLabel(g: string | null): string | null {
  if (g === "M") return "Male";
  if (g === "F") return "Female";
  return null;
}

// Map a birth year to the widely-known social-generation label. Purely
// for fun — it's decorative, not a genealogical concept. Boundaries are
// the most common US-centric ones (Pew Research). Null if no year.
function socialGeneration(dateOfBirth: string | null): string | null {
  if (!dateOfBirth) return null;
  const m = dateOfBirth.match(/^(\d{4})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (y <= 1927) return "Greatest Generation";
  if (y <= 1945) return "Silent Generation";
  if (y <= 1964) return "Baby Boomer";
  if (y <= 1980) return "Gen X";
  if (y <= 1996) return "Millennial";
  if (y <= 2012) return "Gen Z";
  return "Gen Alpha";
}

// Turn the stored date string into a human-readable form:
//   "1985-Apr-08"  → "April 8, 1985"
//   "Apr-08"       → "April 8"
//   "1985-04-08"   → "April 8, 1985"   (legacy)
//   "1985"         → "1985"             (legacy year-only)
const MONTH_FULL: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
};
const MONTH_BY_NUM: string[] = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateHuman(date: string | null): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  // Canonical YYYY-MMM-DD
  let m = trimmed.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/);
  if (m) {
    const month = MONTH_FULL[m[2].toLowerCase()] ?? m[2];
    return `${month} ${parseInt(m[3], 10)}, ${m[1]}`;
  }
  // MMM-DD
  m = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (m) {
    const month = MONTH_FULL[m[1].toLowerCase()] ?? m[1];
    return `${month} ${parseInt(m[2], 10)}`;
  }
  // Legacy YYYY-MM-DD
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const month = MONTH_BY_NUM[parseInt(m[2], 10)] ?? m[2];
    return `${month} ${parseInt(m[3], 10)}, ${m[1]}`;
  }
  // Year-only or anything else
  return trimmed;
}

function formatDateWithApprox(date: string | null, approx: boolean): string | null {
  const formatted = formatDateHuman(date);
  if (!formatted) return null;
  return approx ? `~${formatted}` : formatted;
}

function formatTimestamp(d: Date): string {
  // Short ISO-ish form without seconds, e.g. "2024-03-15". Pinning to the
  // date component keeps the metadata footer from feeling noisy.
  return d.toISOString().slice(0, 10);
}

export default async function PersonProfilePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: { media: true, eventPersons: { include: { event: true } } },
  });

  if (!person) notFound();

  const relationships = await getPersonRelationships(id);

  // Pull every spouse row for this person so we can show the marriage date
  // next to each partner on the profile. Anniversary dates are stored on the
  // spouse row, not the person, so we query them separately.
  const spouseRows = await prisma.spouse.findMany({
    where: { OR: [{ person1Id: id }, { person2Id: id }] },
  });
  const marriageDateBySpouseId = new Map<string, string>();
  for (const row of spouseRows) {
    if (!row.marriageDate) continue;
    const otherId = row.person1Id === id ? row.person2Id : row.person1Id;
    marriageDateBySpouseId.set(otherId, row.marriageDate);
  }
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  const birthDisplay = formatDateWithApprox(person.dateOfBirth, person.dateOfBirthApprox);
  const deathDisplay = formatDateWithApprox(person.dateOfDeath, person.dateOfDeathApprox);
  const dates = person.isLiving
    ? [birthDisplay, "present"].filter(Boolean).join(" \u2013 ")
    : [birthDisplay, deathDisplay ? `${deathDisplay} \uD83D\uDD4A\uFE0F` : "\uD83D\uDD4A\uFE0F"].filter(Boolean).join(" \u2013 ");

  const currentLocation = [person.currentCity, person.currentState, person.currentCountry]
    .filter(Boolean)
    .join(", ");
  const genLabel = socialGeneration(person.dateOfBirth);

  // Anything that would show up in the Details card. If none of these
  // are set we skip the card entirely rather than render an empty shell.
  const hasAnyDetail = !!(
    person.gender ||
    person.birthOrder ||
    person.occupation ||
    person.education ||
    person.religion ||
    person.denomination ||
    person.placeOfBirth ||
    person.placeOfDeath ||
    currentLocation ||
    person.email ||
    person.phone ||
    person.notes
  );

  return (
    <div>
      <div className="mb-6">
        <Link href="/persons" className="text-amber-700 hover:underline text-sm">&larr; Back to Family Members</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-3xl mb-4 overflow-hidden">
              {person.photoUrl ? <img src={person.photoUrl} alt={fullName} className="w-full h-full object-cover" /> : person.firstName.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            {person.maidenName && <p className="text-sm text-gray-500">nee {person.maidenName}</p>}
            {person.nickname && <p className="text-sm text-gray-500">&quot;{person.nickname}&quot;</p>}
            <p className="text-gray-600 mt-1">{dates}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {person.generation !== null ? (
                <span className="inline-block text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">Generation {person.generation}</span>
              ) : (
                <span className="inline-block text-xs bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full border border-yellow-200">Not yet linked to family tree</span>
              )}
              {genLabel && (
                <span className="inline-block text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-200">{genLabel}</span>
              )}
            </div>
            {person.occupation && <p className="text-sm text-gray-500 mt-2">{person.occupation}</p>}
          </div>
          {person.biography && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">Biography</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.biography}</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <Link
              href={`/tree?focus=${id}&up=2&down=2`}
              className="block w-full text-center bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-amber-800 transition-colors"
            >
              View in Family Tree
            </Link>
            <div className="flex justify-center gap-4">
              <Link href={`/persons/${id}/edit`} className="text-amber-700 hover:underline text-sm font-medium">Edit Profile</Link>
              <DeletePersonButton personId={id} personName={fullName} />
            </div>
          </div>
        </div>
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-amber-900 mb-4">Relationships</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Parents</h3>
                {relationships.father ? <Link href={`/persons/${relationships.father.id}`} className="block text-sm text-amber-700 hover:underline">Father: {relationships.father.firstName} {relationships.father.lastName ?? ""}</Link> : <p className="text-sm text-gray-400">Father: Unknown</p>}
                {relationships.mother ? <Link href={`/persons/${relationships.mother.id}`} className="block text-sm text-amber-700 hover:underline">Mother: {relationships.mother.firstName} {relationships.mother.lastName ?? ""}</Link> : <p className="text-sm text-gray-400">Mother: Unknown</p>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Spouse</h3>
                {relationships.spouses.length > 0 ? (
                  relationships.spouses.map((s) => {
                    const anniversary = marriageDateBySpouseId.get(s.id);
                    return (
                      <div key={s.id} className="mb-1">
                        <Link
                          href={`/persons/${s.id}`}
                          className="block text-sm text-amber-700 hover:underline"
                        >
                          {s.firstName} {s.lastName ?? ""}
                        </Link>
                        {anniversary && (
                          <p className="text-xs text-rose-600 flex items-center gap-1">
                            <span>&#9829;</span>
                            <span>Married {formatDateHuman(anniversary) ?? anniversary}</span>
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-400">None</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Children</h3>
                {relationships.children.length > 0 ? relationships.children.map((c) => <Link key={c.id} href={`/persons/${c.id}`} className="block text-sm text-amber-700 hover:underline">{c.firstName} {c.lastName ?? ""} {c.gender === "M" ? "(Son)" : c.gender === "F" ? "(Daughter)" : ""}</Link>) : <p className="text-sm text-gray-400">None</p>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">Siblings</h3>
                {relationships.siblings.length > 0 ? relationships.siblings.map((s) => <Link key={s.id} href={`/persons/${s.id}`} className="block text-sm text-amber-700 hover:underline">{s.firstName} {s.lastName ?? ""} {s.gender === "M" ? "(Brother)" : s.gender === "F" ? "(Sister)" : ""}</Link>) : <p className="text-sm text-gray-400">None</p>}
              </div>
            </div>
          </div>
          {hasAnyDetail && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-4">Details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Gender" value={genderLabel(person.gender)} />
                <Field label="Birth order" value={person.birthOrder} />
                <Field label="Occupation" value={person.occupation} />
                <Field label="Education" value={person.education} />
                <Field label="Religion" value={person.religion} />
                <Field label="Denomination" value={person.denomination} />
                <Field label="Place of birth" value={person.placeOfBirth} />
                <Field label="Place of death" value={person.placeOfDeath} />
                <Field label="Current location" value={currentLocation} />
                <Field
                  label="Email"
                  value={person.email ? <a href={`mailto:${person.email}`} className="text-amber-700 hover:underline">{person.email}</a> : null}
                />
                <Field
                  label="Phone"
                  value={person.phone ? <a href={`tel:${person.phone}`} className="text-amber-700 hover:underline">{person.phone}</a> : null}
                />
                <Field label="Notes" value={person.notes} wide />
              </dl>
              <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                {person.addedBy && <span>Added by {person.addedBy}</span>}
                <span>Created {formatTimestamp(person.createdAt)}</span>
                <span>Updated {formatTimestamp(person.updatedAt)}</span>
              </div>
            </div>
          )}
          {person.eventPersons.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-4">Life Events</h2>
              <div className="space-y-3">
                {person.eventPersons.map((ep) => (
                  <div key={ep.event.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400 w-24 flex-shrink-0">{ep.event.eventDate ?? "No date"}</span>
                    <div><span className="font-medium text-gray-700">{ep.event.title}</span>{ep.event.location && <span className="text-gray-500 ml-1">- {ep.event.location}</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {person.media.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-amber-900 mb-4">Photos & Media</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {person.media.filter((m) => m.type === "photo").map((m) => (
                  <div key={m.id} className="aspect-square rounded-md overflow-hidden bg-gray-100">
                    <img src={m.url} alt={m.caption ?? ""} className="w-full h-full object-cover" />
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
