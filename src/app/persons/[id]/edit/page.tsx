"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PersonForm from "@/components/PersonForm";
import Spinner from "@/components/Spinner";
import type { PersonFormData } from "@/types";

export default function EditPersonPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<(PersonFormData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/persons/${id}`)
      .then((r) => r.json())
      .then((person) => {
        // Resolve each parent link's role resiliently: strict match on
        // parent_type when possible (case-insensitive), fall back to the
        // parent's own gender. Matches /lib/relationships.ts so the edit
        // form's chips agree with the profile page and the tree view.
        type RawLink = {
          parentType: string;
          parent: { id: string; gender: string | null };
        };
        const resolveRole = (link: RawLink): "father" | "mother" | null => {
          const pt = (link.parentType ?? "").toLowerCase().trim();
          if (pt === "father") return "father";
          if (pt === "mother") return "mother";
          if (link.parent.gender === "M") return "father";
          if (link.parent.gender === "F") return "mother";
          return null;
        };
        let fatherId = "";
        let motherId = "";
        for (const link of (person.childOf ?? []) as RawLink[]) {
          const role = resolveRole(link);
          if (role === "father" && !fatherId) fatherId = link.parent.id;
          else if (role === "mother" && !motherId) motherId = link.parent.id;
        }
        // Pull the spouse row (and its marriage date) from whichever side of
        // the spouses table this person is stored on.
        const spouseRow = person.spouse1?.[0] ?? person.spouse2?.[0];
        const spouse = person.spouse1?.[0]?.person2 ?? person.spouse2?.[0]?.person1;
        const spouseId = spouse?.id ?? "";
        const marriageDate = spouseRow?.marriageDate ?? "";
        const childrenIds: string[] =
          person.parentOf?.map((p: { child: { id: string } }) => p.child.id) ?? [];
        setData({ ...person, id: person.id, fatherId, motherId, spouseId, marriageDate, childrenIds });
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Spinner label="Loading profile..." />;
  if (!data) return <p className="text-red-500">Person not found.</p>;

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => window.history.back()} className="text-amber-700 hover:underline text-sm">&larr; Back to Profile</button>
      </div>
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Edit: {data.firstName} {data.lastName ?? ""}</h1>
      <PersonForm initialData={data} isEdit />
    </div>
  );
}
