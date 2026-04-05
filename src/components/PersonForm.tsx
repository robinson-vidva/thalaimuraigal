"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PersonFormData, Gender } from "@/types";
import LocationSearch from "./LocationSearch";

interface PersonOption { id: string; firstName: string; lastName: string | null; }
interface PersonFormProps { initialData?: PersonFormData & { id?: string }; isEdit?: boolean; }

export default function PersonForm({ initialData, isEdit }: PersonFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [form, setForm] = useState<PersonFormData>({
    firstName: "", lastName: "", nickname: "", gender: undefined,
    dateOfBirth: "", placeOfBirth: "", dateOfDeath: "", placeOfDeath: "",
    isLiving: true, biography: "", occupation: "", familySide: undefined,
    birthOrder: undefined, fatherId: "", motherId: "", spouseId: "", notes: "",
    currentCity: "", currentState: "", currentCountry: "",
    birthLatitude: undefined, birthLongitude: undefined,
    currentLatitude: undefined, currentLongitude: undefined,
    ...initialData,
  });

  useEffect(() => {
    fetch("/api/persons").then((r) => r.json()).then((data) =>
      setPersons(data.map((p: PersonOption) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })))
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const cleaned = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "" && v !== undefined));
    try {
      const url = isEdit ? `/api/persons/${initialData?.id}` : "/api/persons";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cleaned) });
      const person = await res.json();
      if (!res.ok) { throw new Error(person.error || "Failed to save"); }
      router.push(`/persons/${person.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  const update = (field: keyof PersonFormData, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateMultiple = (fields: Partial<PersonFormData>) => setForm((prev) => ({ ...prev, ...fields }));
  const availablePersons = persons.filter((p) => !initialData?.id || p.id !== initialData.id);

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      {/* ── Section 1: Personal Details ── */}
      <fieldset className="border border-gray-200 rounded-lg p-5">
        <legend className="text-sm font-semibold text-gray-700 px-2">Personal Details</legend>
        <p className="text-xs text-gray-400 mb-4 -mt-1">Name, identity, and background</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-400">*</span></label>
            <input required type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input type="text" value={form.lastName ?? ""} onChange={(e) => update("lastName", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
            <input type="text" value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select value={form.gender ?? ""} onChange={(e) => update("gender", (e.target.value || undefined) as Gender | undefined)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500">
              <option value="">Select...</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
          <input type="text" value={form.occupation ?? ""} onChange={(e) => update("occupation", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Biography</label>
          <textarea rows={3} value={form.biography ?? ""} onChange={(e) => update("biography", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" placeholder="A short description about this person..." />
        </div>
      </fieldset>

      {/* ── Section 2: Birth & Life ── */}
      <fieldset className="border border-gray-200 rounded-lg p-5">
        <legend className="text-sm font-semibold text-gray-700 px-2">Birth & Life</legend>
        <p className="text-xs text-gray-400 mb-4 -mt-1">Timeline, locations, and life status</p>

        {/* Birth row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input type="text" placeholder="YYYY-MM-DD or YYYY" value={form.dateOfBirth ?? ""} onChange={(e) => update("dateOfBirth", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
          </div>
          <div>
            <LocationSearch
              label="Place of Birth"
              placeholder="Search for birth city or town..."
              onSelect={(loc) => updateMultiple({
                placeOfBirth: loc.displayName,
                birthLatitude: loc.latitude,
                birthLongitude: loc.longitude,
              })}
            />
            {form.placeOfBirth && (
              <p className="text-xs text-gray-500 mt-1 truncate" title={form.placeOfBirth}>Selected: {form.placeOfBirth}</p>
            )}
          </div>
        </div>

        {/* Living / Death section */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isLiving ?? true} onChange={(e) => update("isLiving", e.target.checked)} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            Currently living
          </label>
          {!form.isLiving && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pl-6 border-l-2 border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Death</label>
                <input type="text" placeholder="YYYY-MM-DD or YYYY" value={form.dateOfDeath ?? ""} onChange={(e) => update("dateOfDeath", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place of Death</label>
                <input type="text" value={form.placeOfDeath ?? ""} onChange={(e) => update("placeOfDeath", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
              </div>
            </div>
          )}
        </div>

        {/* Current Location */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <LocationSearch
            label="Current Location"
            placeholder="Search for current city or town..."
            onSelect={(loc) => updateMultiple({
              currentCity: loc.city,
              currentState: loc.state,
              currentCountry: loc.country,
              currentLatitude: loc.latitude,
              currentLongitude: loc.longitude,
            })}
          />
          {(form.currentCity || form.currentState || form.currentCountry) && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
              Current: {[form.currentCity, form.currentState, form.currentCountry].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </fieldset>

      {/* ── Section 3: Family Connections ── */}
      <fieldset className="border border-gray-200 rounded-lg p-5">
        <legend className="text-sm font-semibold text-gray-700 px-2">Family Connections</legend>
        <p className="text-xs text-gray-400 mb-4 -mt-1">Link to parents, spouse, and family side</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Father</label>
            <select value={form.fatherId ?? ""} onChange={(e) => update("fatherId", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500">
              <option value="">None</option>
              {availablePersons.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName ?? ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mother</label>
            <select value={form.motherId ?? ""} onChange={(e) => update("motherId", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500">
              <option value="">None</option>
              {availablePersons.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName ?? ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Spouse</label>
            <select value={form.spouseId ?? ""} onChange={(e) => update("spouseId", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500">
              <option value="">None</option>
              {availablePersons.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName ?? ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birth Order</label>
            <input type="number" min="1" value={form.birthOrder ?? ""} onChange={(e) => update("birthOrder", e.target.value ? parseInt(e.target.value) : undefined)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" placeholder="e.g. 1 for eldest" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Family Side</label>
          <select value={form.familySide ?? ""} onChange={(e) => update("familySide", e.target.value || undefined)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500">
            <option value="">Select...</option>
            <option value="paternal">Paternal</option>
            <option value="maternal">Maternal</option>
            <option value="both">Both</option>
          </select>
        </div>
      </fieldset>

      {/* ── Section 4: Additional Notes ── */}
      <fieldset className="border border-gray-200 rounded-lg p-5">
        <legend className="text-sm font-semibold text-gray-700 px-2">Additional Notes</legend>
        <p className="text-xs text-gray-400 mb-4 -mt-1">Any extra information or stories</p>
        <textarea rows={3} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500" placeholder="Add any additional notes, stories, or memories..." />
      </fieldset>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={loading} className="bg-amber-700 text-white px-8 py-2.5 rounded-md hover:bg-amber-800 disabled:opacity-50 font-medium transition-colors">
          {loading ? "Saving..." : isEdit ? "Update Member" : "Add Member"}
        </button>
        <button type="button" onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
