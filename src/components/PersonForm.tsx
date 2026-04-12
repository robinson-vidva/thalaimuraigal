"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PersonFormData, Gender } from "@/types";
import LocationSearch from "./LocationSearch";
import PartialDatePicker from "./PartialDatePicker";
import { validatePersonDates, validatePartialDate } from "@/lib/date-validation";

interface PersonOption { id: string; firstName: string; lastName: string | null; gender: string | null; }
interface PersonFormProps { initialData?: PersonFormData & { id?: string }; isEdit?: boolean; }

type RelKind = "father" | "mother" | "spouse" | "son" | "daughter";

// Fields that represent a single-valued relationship link. When the user
// clears one of these we must send an explicit null so the server deletes
// the row — otherwise the submit cleaner would drop the empty string and
// the PUT handler would treat it as "leave alone".
const NULLABLE_REL_FIELDS = new Set(["fatherId", "motherId", "spouseId", "marriageDate"]);

export default function PersonForm({ initialData, isEdit }: PersonFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [form, setForm] = useState<PersonFormData>({
    firstName: "", lastName: "", maidenName: "", nickname: "", gender: undefined,
    dateOfBirth: "", placeOfBirth: "", dateOfDeath: "", placeOfDeath: "",
    isLiving: true, biography: "", occupation: "",
    birthOrder: undefined, fatherId: "", motherId: "", spouseId: "",
    marriageDate: "", notes: "",
    currentCity: "", currentState: "", currentCountry: "",
    birthLatitude: undefined, birthLongitude: undefined,
    currentLatitude: undefined, currentLongitude: undefined,
    childrenIds: [],
    ...initialData,
  });
  // Relationship picker state
  const [relPickerOpen, setRelPickerOpen] = useState(false);
  const [relSearch, setRelSearch] = useState("");
  const [relKind, setRelKind] = useState<RelKind>("father");
  // Captured when the picker type is "spouse" — applied to form.marriageDate
  // when the spouse is actually confirmed via addRelationship.
  const [pendingMarriageDate, setPendingMarriageDate] = useState("");

  useEffect(() => {
    fetch("/api/persons").then((r) => r.json()).then((data) =>
      setPersons(
        data.map((p: PersonOption) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender ?? null,
        }))
      )
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Reject impossible dates (Feb 30, future DOBs, death-before-birth, etc.)
    // before we even send the request, so the user gets immediate feedback.
    const dateError = validatePersonDates({
      dateOfBirth: form.dateOfBirth,
      dateOfDeath: form.dateOfDeath,
    });
    if (dateError) {
      setError(dateError);
      setLoading(false);
      return;
    }
    // Also sanity-check the marriage date independently (it doesn't
    // participate in the birth/death order check).
    const marriageError = validatePartialDate(form.marriageDate, "Marriage date");
    if (marriageError) {
      setError(marriageError);
      setLoading(false);
      return;
    }

    // Clean the payload:
    //  - drop undefined (never touched)
    //  - for single-valued relationship links, convert "" to null so the
    //    server actually deletes the row when the user removes a chip
    //  - drop other empty strings (unchanged behavior)
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === undefined) continue;
      if (NULLABLE_REL_FIELDS.has(k)) {
        cleaned[k] = v === "" ? null : v;
      } else if (v === "") {
        continue;
      } else {
        cleaned[k] = v;
      }
    }
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

  // ─── Unified Relationships view ───
  // Internal state is still split across fatherId/motherId/spouseId/childrenIds
  // (because the API expects that shape), but the form presents them as one
  // list of { otherId, kind } pairs so the user just adds/removes links
  // without caring which "slot" they live in.
  interface Rel { otherId: string; kind: RelKind }
  const childrenIds = form.childrenIds ?? [];

  const relationships: Rel[] = [];
  if (form.fatherId) relationships.push({ otherId: form.fatherId, kind: "father" });
  if (form.motherId) relationships.push({ otherId: form.motherId, kind: "mother" });
  if (form.spouseId) relationships.push({ otherId: form.spouseId, kind: "spouse" });
  for (const cid of childrenIds) {
    const child = persons.find((p) => p.id === cid);
    // Son/daughter is derived from the linked child's gender at render time.
    // We default to "son" when gender is unknown so the chip still renders.
    const kind: RelKind = child?.gender === "F" ? "daughter" : "son";
    relationships.push({ otherId: cid, kind });
  }

  const hasFather = !!form.fatherId;
  const hasMother = !!form.motherId;
  const hasSpouse = !!form.spouseId;

  // Son/Daughter adds need this person's gender to decide the parent_type
  // column (father vs mother). Offer them only when gender is M or F.
  const canAddChildKind = form.gender === "M" || form.gender === "F";

  // People already linked to this person in any capacity.
  const linkedIds = new Set<string>(
    [form.fatherId, form.motherId, form.spouseId, ...childrenIds].filter(Boolean) as string[]
  );

  // Candidate list for the picker: not self, not already linked, matches search.
  const relSearchLower = relSearch.trim().toLowerCase();
  const relCandidates = availablePersons
    .filter((p) => !linkedIds.has(p.id))
    .filter((p) => {
      if (!relSearchLower) return true;
      const name = `${p.firstName} ${p.lastName ?? ""}`.toLowerCase();
      return name.includes(relSearchLower);
    })
    .slice(0, 8);

  // Human-readable chip labels.
  function chipLabel(r: Rel): string {
    if (r.kind === "father") return "Father";
    if (r.kind === "mother") return "Mother";
    if (r.kind === "son") return "Son";
    if (r.kind === "daughter") return "Daughter";
    // Spouse: specialise by other person's gender when known.
    const other = persons.find((p) => p.id === r.otherId);
    if (other?.gender === "M") return "Husband";
    if (other?.gender === "F") return "Wife";
    return "Spouse";
  }

  // Pick the next valid kind the user might want to add, so the dropdown
  // defaults to something sensible when they re-open the picker.
  function firstAvailableKind(): RelKind {
    if (!hasFather) return "father";
    if (!hasMother) return "mother";
    if (!hasSpouse) return "spouse";
    if (canAddChildKind) return "son";
    return "father"; // all taken, will be disabled in the <select>
  }

  const openPicker = () => {
    setRelKind(firstAvailableKind());
    setRelSearch("");
    setPendingMarriageDate("");
    setRelPickerOpen(true);
  };

  const addRelationship = (otherId: string, kind: RelKind) => {
    switch (kind) {
      case "father":
        if (hasFather) return;
        update("fatherId", otherId);
        break;
      case "mother":
        if (hasMother) return;
        update("motherId", otherId);
        break;
      case "spouse": {
        if (hasSpouse) return;
        // Validate the marriage date input (if provided) before committing.
        const mdTrimmed = pendingMarriageDate.trim();
        if (mdTrimmed) {
          const err = validatePartialDate(mdTrimmed, "Marriage date");
          if (err) {
            setError(err);
            return;
          }
        }
        updateMultiple({
          spouseId: otherId,
          marriageDate: mdTrimmed || "",
        });
        break;
      }
      case "son":
      case "daughter":
        if (!canAddChildKind) return;
        if (!childrenIds.includes(otherId)) update("childrenIds", [...childrenIds, otherId]);
        break;
    }
    setError("");
    setRelPickerOpen(false);
    setRelSearch("");
    setPendingMarriageDate("");
  };

  const removeRelationship = (r: Rel) => {
    switch (r.kind) {
      case "father":
        update("fatherId", "");
        break;
      case "mother":
        update("motherId", "");
        break;
      case "spouse":
        updateMultiple({ spouseId: "", marriageDate: "" });
        break;
      case "son":
      case "daughter":
        update("childrenIds", childrenIds.filter((id) => id !== r.otherId));
        break;
    }
  };

  // Shared Tailwind classes so the form inputs look consistent without
  // repeating the string 20 times. The label + input patterns are the
  // same across every section.
  const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2">
          <span className="font-medium shrink-0">Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         Two-column layout on desktop. The left column holds "who is
         this person" (name, identity, bio). The right holds "when and
         where" (birth, death, location). Below both is a full-width
         Family Connections section. This halves the vertical scroll on
         wide screens and keeps related fields close to each other.
         ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left column: Personal Details ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-1">Personal Details</h2>
          <p className="text-xs text-gray-400 mb-5">Name, identity, and background</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name <span className="text-red-400">*</span></label>
              <input required type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" value={form.lastName ?? ""} onChange={(e) => update("lastName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nickname</label>
              <input type="text" value={form.nickname ?? ""} onChange={(e) => update("nickname", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Maiden Name</label>
              <input type="text" value={form.maidenName ?? ""} onChange={(e) => update("maidenName", e.target.value)} className={inputCls} placeholder="Surname before marriage" />
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select value={form.gender ?? ""} onChange={(e) => update("gender", (e.target.value || undefined) as Gender | undefined)} className={inputCls}>
                <option value="">Select...</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Occupation</label>
              <input type="text" value={form.occupation ?? ""} onChange={(e) => update("occupation", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>Biography</label>
            <textarea rows={2} value={form.biography ?? ""} onChange={(e) => update("biography", e.target.value)} className={inputCls} placeholder="A short description about this person..." />
          </div>
          <div className="mt-3">
            <label className={labelCls}>Notes</label>
            <textarea rows={2} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} className={inputCls} placeholder="Any additional notes, stories, or memories..." />
          </div>
        </div>

        {/* ── Right column: Birth & Life ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-amber-900 mb-1">Birth &amp; Life</h2>
          <p className="text-xs text-gray-400 mb-5">Timeline, locations, and life status</p>

          {/* Birth row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <PartialDatePicker
                label="Date of Birth"
                value={form.dateOfBirth ?? ""}
                onChange={(v) => update("dateOfBirth", v)}
                hint="Pick 'Month & day only' if the year is unknown."
              />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pl-4 border-l-2 border-amber-200">
                <div>
                  <PartialDatePicker
                    label="Date of Death"
                    value={form.dateOfDeath ?? ""}
                    onChange={(v) => update("dateOfDeath", v)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Place of Death</label>
                  <input type="text" value={form.placeOfDeath ?? ""} onChange={(e) => update("placeOfDeath", e.target.value)} className={inputCls} />
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
              <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 p-2 rounded-md mt-2">
                Current: {[form.currentCity, form.currentState, form.currentCountry].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full-width: Family Connections ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-amber-900 mb-1">Family Connections</h2>
        <p className="text-xs text-gray-400 mb-5">
          Add relationships one at a time. Each link automatically shows up on the other person&rsquo;s profile too &mdash; you only need to record it once.
        </p>

        {/* Unified relationships list */}
        <div className="space-y-2">
          {relationships.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No relationships linked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {relationships.map((r) => {
                const other = persons.find((p) => p.id === r.otherId);
                const name = other ? `${other.firstName} ${other.lastName ?? ""}`.trim() : "Unknown";
                const anniversary = r.kind === "spouse" && form.marriageDate ? form.marriageDate : null;
                return (
                  <span
                    key={`${r.kind}-${r.otherId}`}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 text-xs px-3 py-1.5"
                  >
                    <span className="font-semibold">{chipLabel(r)}</span>
                    <span>&middot;</span>
                    <span>{name}</span>
                    {anniversary && (
                      <>
                        <span className="text-amber-600">&middot;</span>
                        <span className="text-amber-700">&#9829; {anniversary}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRelationship(r)}
                      className="ml-1 text-amber-600 hover:text-amber-900 text-base leading-none"
                      aria-label={`Remove ${chipLabel(r)} link to ${name}`}
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Add relationship button / inline picker */}
        <div className="mt-4">
          {!relPickerOpen ? (
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              <span className="text-lg leading-none">+</span> Add relationship
            </button>
          ) : (
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Relationship type</label>
                  <select
                    value={relKind}
                    onChange={(e) => setRelKind(e.target.value as RelKind)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  >
                    <option value="father" disabled={hasFather}>Father{hasFather ? " (already set)" : ""}</option>
                    <option value="mother" disabled={hasMother}>Mother{hasMother ? " (already set)" : ""}</option>
                    <option value="spouse" disabled={hasSpouse}>Spouse{hasSpouse ? " (already set)" : ""}</option>
                    <option value="son" disabled={!canAddChildKind}>Son</option>
                    <option value="daughter" disabled={!canAddChildKind}>Daughter</option>
                  </select>
                  {(relKind === "son" || relKind === "daughter") && !canAddChildKind && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Set this person&rsquo;s <span className="font-semibold">Gender</span> to Male or Female to link children.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Person</label>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={relSearch}
                    onChange={(e) => setRelSearch(e.target.value)}
                    autoFocus
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  />
                </div>
              </div>

              {relKind === "spouse" && (
                <PartialDatePicker
                  label="Marriage date (optional)"
                  value={pendingMarriageDate}
                  onChange={setPendingMarriageDate}
                  hint="Added to the family calendar as an annual anniversary. Pick 'Month & day only' if the year is unknown."
                />
              )}

              {relSearch && (
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-48 overflow-auto bg-white">
                  {relCandidates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">No matching family members.</div>
                  ) : (
                    relCandidates.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addRelationship(p.id, relKind)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 disabled:opacity-50"
                        disabled={
                          (relKind === "father" && hasFather) ||
                          (relKind === "mother" && hasMother) ||
                          (relKind === "spouse" && hasSpouse) ||
                          ((relKind === "son" || relKind === "daughter") && !canAddChildKind)
                        }
                      >
                        {p.firstName} {p.lastName ?? ""}
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setRelPickerOpen(false); setRelSearch(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Birth Order */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="sm:w-1/3">
            <label className={labelCls}>Birth Order</label>
            <input
              type="number"
              min="1"
              value={form.birthOrder ?? ""}
              onChange={(e) => update("birthOrder", e.target.value ? parseInt(e.target.value) : undefined)}
              className={inputCls}
              placeholder="e.g. 1 for eldest"
            />
          </div>
        </div>
      </div>

      {/* Submit bar — slightly raised and visually separated so the
          primary action is always obvious even on long forms. */}
      <div className="flex items-center gap-4 pt-2">
        <button type="submit" disabled={loading} className="bg-amber-700 text-white px-10 py-2.5 rounded-lg hover:bg-amber-800 disabled:opacity-50 font-semibold shadow-sm transition-colors">
          {loading ? "Saving..." : isEdit ? "Update Member" : "Add Member"}
        </button>
        <button type="button" onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
