import { getTamilTerm, type RelationshipType } from "@/lib/tamil-terms";

interface RelationshipBadgeProps { relationship: RelationshipType; showTamil?: boolean; }

export default function RelationshipBadge({ relationship, showTamil = true }: RelationshipBadgeProps) {
  const term = getTamilTerm(relationship);
  if (!term) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200">
      {term.english}{showTamil && <span className="text-amber-600">({term.tamil})</span>}
    </span>
  );
}
