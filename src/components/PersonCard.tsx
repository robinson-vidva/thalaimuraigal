import Link from "next/link";

interface PersonCardProps {
  id: string;
  firstName: string;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  isLiving: boolean;
  photoUrl?: string | null;
  generation?: number | null;
}

export default function PersonCard({
  id,
  firstName,
  lastName,
  gender,
  dateOfBirth,
  dateOfDeath,
  isLiving,
  photoUrl,
  generation,
}: PersonCardProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const genderIcon = gender === "M" ? "M" : gender === "F" ? "F" : "";
  const dates = [dateOfBirth, dateOfDeath ? dateOfDeath : isLiving ? "present" : "?"]
    .filter(Boolean)
    .join(" - ");

  return (
    <Link
      href={`/persons/${id}`}
      className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border border-gray-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-lg flex-shrink-0 overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={fullName}
              className="w-full h-full object-cover"
            />
          ) : (
            firstName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">
            {fullName}
            {genderIcon && (
              <span className="ml-1 text-xs text-gray-500">({genderIcon})</span>
            )}
          </div>
          <div className="text-sm text-gray-500">{dates}</div>
          {generation !== null && generation !== undefined && (
            <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
              Gen {generation}
            </span>
          )}
          {generation === null && (
            <span className="inline-block mt-1 text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded">
              Unlinked
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
