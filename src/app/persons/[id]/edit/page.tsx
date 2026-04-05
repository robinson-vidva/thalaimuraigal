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
      .then((person) => { setData({ ...person, id: person.id }); setLoading(false); });
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
