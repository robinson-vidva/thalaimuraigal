"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PersonFormData, Gender } from "@/types";

interface PersonOption {
  id: string;
  firstName: string;
  lastName: string | null;
}

interface PersonFormProps {
  initialData?: PersonFormData & { id?: string };
  isEdit?: boolean;
}

export default function PersonForm({ initialData, isEdit }: PersonFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [persons, setPersons] = useState<PersonOption[]>([]);

  const [form, setForm] = useState<PersonFormData>({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: undefined,
    dateOfBirth: "",
    placeOfBirth: "",
    dateOfDeath: "",
    placeOfDeath: "",
    isLiving: true,
    biography: "",
    occupation: "",
    familySide: undefined,
    birthOrder: undefined,
    fatherId: "",
    motherId: "",
    spouseId: "",
    notes: "",
    ...initialData,
  });

  useEffect(() => {
    fetch("/api/persons")
      .then((r) => r.json())
      .then((data) =>
        setPersons(
          data.map((p: PersonOption) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
          }))
        )
      );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Clean empty strings to undefined
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" && v !== undefined)
    );

    try {
      const url = isEdit ? `/api/persons/${initialData?.id}` : "/api/persons";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const person = await res.json();
      router.push(`/persons/${person.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof PersonFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Filter persons for parent/spouse selectors (exclude self in edit mode)
  const availablePersons = persons.filter(
    (p) => !initialData?.id || p.id !== initialData.id
  );

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-sm font-semibold text-gray-600 px-2">
          Basic Information
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              required
              type="text"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.lastName ?? ""}
              onChange={(e) => update("lastName", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname
            </label>
            <input
              type="text"
              value={form.nickname ?? ""}
              onChange={(e) => update("nickname", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={form.gender ?? ""}
              onChange={(e) =>
                update("gender", (e.target.value || undefined) as Gender | undefined)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Dates & Places */}
      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-sm font-semibold text-gray-600 px-2">
          Life Details
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
            <input
              type="text"
              placeholder="YYYY-MM-DD or YYYY"
              value={form.dateOfBirth ?? ""}
              onChange={(e) => update("dateOfBirth", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Place of Birth
            </label>
            <input
              type="text"
              value={form.placeOfBirth ?? ""}
              onChange={(e) => update("placeOfBirth", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={form.isLiving ?? true}
                onChange={(e) => update("isLiving", e.target.checked)}
              />
              Living
            </label>
            {!form.isLiving && (
              <>
                <input
                  type="text"
                  placeholder="Date of Death"
                  value={form.dateOfDeath ?? ""}
                  onChange={(e) => update("dateOfDeath", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-2"
                />
                <input
                  type="text"
                  placeholder="Place of Death"
                  value={form.placeOfDeath ?? ""}
                  onChange={(e) => update("placeOfDeath", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Occupation
            </label>
            <input
              type="text"
              value={form.occupation ?? ""}
              onChange={(e) => update("occupation", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Biography
          </label>
          <textarea
            rows={3}
            value={form.biography ?? ""}
            onChange={(e) => update("biography", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      {/* Family Links */}
      {!isEdit && (
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-gray-600 px-2">
            Family Links (optional)
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Father
              </label>
              <select
                value={form.fatherId ?? ""}
                onChange={(e) => update("fatherId", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {availablePersons
                  .filter((p) => true)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName ?? ""}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mother
              </label>
              <select
                value={form.motherId ?? ""}
                onChange={(e) => update("motherId", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {availablePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName ?? ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spouse
              </label>
              <select
                value={form.spouseId ?? ""}
                onChange={(e) => update("spouseId", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {availablePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName ?? ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Order
              </label>
              <input
                type="number"
                min="1"
                value={form.birthOrder ?? ""}
                onChange={(e) =>
                  update(
                    "birthOrder",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family Side
            </label>
            <select
              value={form.familySide ?? ""}
              onChange={(e) =>
                update("familySide", e.target.value || undefined)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              <option value="paternal">Paternal</option>
              <option value="maternal">Maternal</option>
              <option value="both">Both</option>
            </select>
          </div>
        </fieldset>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          rows={2}
          value={form.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-amber-700 text-white px-6 py-2 rounded-md hover:bg-amber-800 disabled:opacity-50 font-medium"
      >
        {loading ? "Saving..." : isEdit ? "Update Member" : "Add Member"}
      </button>
    </form>
  );
}
