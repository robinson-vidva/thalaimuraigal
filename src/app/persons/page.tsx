"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Person {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  isLiving: boolean;
  generation: number | null;
  photoUrl: string | null;
  childOf: {
    parent: { id: string; firstName: string; lastName: string | null };
    parentType: string;
  }[];
  spouse1: {
    person2: { id: string; firstName: string; lastName: string | null };
  }[];
  spouse2: {
    person1: { id: string; firstName: string; lastName: string | null };
  }[];
}

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [livingFilter, setLivingFilter] = useState("");
  const [generationFilter, setGenerationFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (genderFilter) params.set("gender", genderFilter);
    if (livingFilter) params.set("isLiving", livingFilter);
    if (generationFilter) params.set("generation", generationFilter);
    fetch(`/api/persons?${params}`)
      .then((r) => r.json())
      .then((data) => { setPersons(data); setLoading(false); });
  }, [search, genderFilter, livingFilter, generationFilter]);

  const getParentName = (person: Person, type: string) => {
    const link = person.childOf.find((c) => c.parentType === type);
    if (!link) return "-";
    return `${link.parent.firstName} ${link.parent.lastName ?? ""}`.trim();
  };

  const getSpouseName = (person: Person) => {
    const s1 = person.spouse1[0]?.person2;
    const s2 = person.spouse2[0]?.person1;
    const spouse = s1 || s2;
    if (!spouse) return "-";
    return `${spouse.firstName} ${spouse.lastName ?? ""}`.trim();
  };

  const generations = [...new Set(persons.map((p) => p.generation).filter((g) => g !== null))].sort((a, b) => a - b);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-900">Family Members</h1>
        <Link href="/persons/new" className="bg-amber-700 text-white px-4 py-2 rounded-md hover:bg-amber-800 text-sm font-medium">+ Add Member</Link>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm w-64" />
        <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Genders</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
        </select>
        <select value={livingFilter} onChange={(e) => setLivingFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All</option><option value="true">Living</option><option value="false">Deceased</option>
        </select>
        <select value={generationFilter} onChange={(e) => setGenerationFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Generations</option>
          {generations.map((g) => (<option key={g} value={g}>Generation {g}</option>))}
        </select>
      </div>
      {loading ? (<p className="text-gray-500">Loading...</p>) : persons.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><p className="mb-2">No family members found.</p><Link href="/persons/new" className="text-amber-700 underline">Add the first member</Link></div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-sm">
            <thead className="bg-amber-100 text-amber-900"><tr>
              <th className="text-left px-4 py-3 font-semibold">Name</th><th className="text-left px-4 py-3 font-semibold">Gen</th><th className="text-left px-4 py-3 font-semibold">Gender</th><th className="text-left px-4 py-3 font-semibold">Born</th><th className="text-left px-4 py-3 font-semibold">Died</th><th className="text-left px-4 py-3 font-semibold">Father</th><th className="text-left px-4 py-3 font-semibold">Mother</th><th className="text-left px-4 py-3 font-semibold">Spouse</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {persons.map((p) => (
                <tr key={p.id} className="hover:bg-amber-50 cursor-pointer" onClick={() => (window.location.href = `/persons/${p.id}`)}>
                  <td className="px-4 py-3 font-medium text-amber-900">{p.firstName} {p.lastName ?? ""}</td>
                  <td className="px-4 py-3">{p.generation !== null ? p.generation : <span className="text-yellow-600 text-xs">-</span>}</td>
                  <td className="px-4 py-3">{p.gender ?? "-"}</td>
                  <td className="px-4 py-3">{p.dateOfBirth ?? "-"}</td>
                  <td className="px-4 py-3">{p.isLiving ? <span className="text-green-600">Living</span> : (p.dateOfDeath ?? "Deceased")}</td>
                  <td className="px-4 py-3">{getParentName(p, "father")}</td>
                  <td className="px-4 py-3">{getParentName(p, "mother")}</td>
                  <td className="px-4 py-3">{getSpouseName(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4">{persons.length} member{persons.length !== 1 ? "s" : ""} total</p>
    </div>
  );
}
