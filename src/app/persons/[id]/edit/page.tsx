"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PersonForm from "@/components/PersonForm";
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
        const fatherId = person.childOf?.find((c: { parentType: string }) => c.parentType === "father")?.parent?.id ?? "";
        const motherId = person.childOf?.find((c: { parentType: string }) => c.parentType === "mother")?.parent?.id ?? "";
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

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-500">Person not found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Edit: {data.firstName} {data.lastName ?? ""}</h1>
      <PersonForm initialData={data} isEdit />
    </div>
  );
}
