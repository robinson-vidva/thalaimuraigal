"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDateHuman } from "@/lib/format-date";
import Spinner from "@/components/Spinner";

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
    parent: { id: string; firstName: string; lastName: string | null; gender: string | null };
    parentType: string;
  }[];
  spouse1: {
    person2: { id: string; firstName: string; lastName: string | null };
  }[];
  spouse2: {
    person1: { id: string; firstName: string; lastName: string | null };
  }[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function PersonsPage() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [livingFilter, setLivingFilter] = useState("");
  const [generationFilter, setGenerationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  // Pagination state. Page is 1-indexed in the UI. Whenever any filter
  // changes we reset back to page 1 so the user isn't silently stuck
  // on a page number that no longer has rows.
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (genderFilter) params.set("gender", genderFilter);
    if (livingFilter) params.set("isLiving", livingFilter);
    if (generationFilter) params.set("generation", generationFilter);
    fetch(`/api/persons?${params}`)
      .then((r) => r.json())
      .then((data) => { setPersons(data); setLoading(false); });
  }, [search, genderFilter, livingFilter, generationFilter]);

  // Resilient to parent_type rows that don't strictly equal "father"/"mother"
  // (legacy casing, missing values, etc.) by falling back to the parent's
  // own gender. Matches the same logic the profile page uses so every
  // surface agrees on who the father/mother are.
  const getParentName = (person: Person, type: "father" | "mother") => {
    const link = person.childOf.find((c) => {
      const pt = (c.parentType ?? "").toLowerCase().trim();
      if (pt === type) return true;
      if (pt === "father" || pt === "mother") return false; // explicitly tagged as the other role
      if (type === "father") return c.parent.gender === "M";
      if (type === "mother") return c.parent.gender === "F";
      return false;
    });
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

  // Pagination derivations. `safePage` clamps the current page into the
  // valid range so a filter that shrinks the result set below the active
  // page doesn't leave us rendering an empty slice.
  const totalCount = persons.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalCount);
  const pagePersons = persons.slice(pageStart, pageEnd);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-amber-900">Family Members</h1>
        <Link href="/persons/new" className="bg-amber-700 text-white px-4 py-2 rounded-md hover:bg-amber-800 text-sm font-medium">+ Add Member</Link>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-64" />
        <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Genders</option><option value="M">Male</option><option value="F">Female</option>
        </select>
        <select value={livingFilter} onChange={(e) => setLivingFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All</option><option value="true">Living</option><option value="false">Deceased</option>
        </select>
        <select value={generationFilter} onChange={(e) => setGenerationFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Generations</option>
          {generations.map((g) => (<option key={g} value={g}>Generation {g}</option>))}
        </select>
      </div>
      {loading ? (<Spinner label="Loading family members..." />) : persons.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><p className="mb-2">No family members found.</p><Link href="/persons/new" className="text-amber-700 underline">Add the first member</Link></div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-amber-100 text-amber-900"><tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th><th className="text-left px-4 py-3 font-semibold">Gen</th><th className="text-left px-4 py-3 font-semibold">Gender</th><th className="text-left px-4 py-3 font-semibold">Born</th><th className="text-left px-4 py-3 font-semibold">Died</th><th className="text-left px-4 py-3 font-semibold">Father</th><th className="text-left px-4 py-3 font-semibold">Mother</th><th className="text-left px-4 py-3 font-semibold">Spouse</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {pagePersons.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50 cursor-pointer" onClick={() => (window.location.href = `/persons/${p.id}`)}>
                    <td className="px-4 py-3 font-medium text-amber-900">{p.firstName} {p.lastName ?? ""}</td>
                    <td className="px-4 py-3">{p.generation !== null ? p.generation : <span className="text-yellow-600 text-xs">-</span>}</td>
                    <td className="px-4 py-3">{p.gender ?? "-"}</td>
                    <td className="px-4 py-3">{formatDateHuman(p.dateOfBirth) ?? "-"}</td>
                    <td className="px-4 py-3">{p.isLiving ? <span className="text-green-600">Living</span> : <span className="text-gray-500">{formatDateHuman(p.dateOfDeath) ?? ""} {"\uD83D\uDD4A\uFE0F"}</span>}</td>
                    <td className="px-4 py-3">{getParentName(p, "father")}</td>
                    <td className="px-4 py-3">{getParentName(p, "mother")}</td>
                    <td className="px-4 py-3">{getSpouseName(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination bar. Only the Prev/Next arrows are shown when
              there's a single page; the counts stay visible either way
              so the user always knows how many total rows they have. */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500">
            <p>
              Showing <span className="font-medium text-gray-700">{totalCount === 0 ? 0 : pageStart + 1}</span>
              –<span className="font-medium text-gray-700">{pageEnd}</span> of{" "}
              <span className="font-medium text-gray-700">{totalCount}</span> member{totalCount !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &larr; Previous
              </button>
              <span className="px-2">
                Page <span className="font-medium text-gray-700">{safePage}</span> of{" "}
                <span className="font-medium text-gray-700">{totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next &rarr;
              </button>
              <label className="flex items-center gap-1.5 ml-2">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1 bg-white text-gray-700"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
