"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapWrapper = dynamic(() => import("@/components/MapWrapper"), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-400">Loading map...</div>,
});

interface PersonLocation {
  id: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  birthLatitude: number | null;
  birthLongitude: number | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  placeOfBirth: string | null;
  currentCity: string | null;
  currentCountry: string | null;
}

type ViewMode = "birth" | "current";

export default function MapPage() {
  const [persons, setPersons] = useState<PersonLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("birth");

  useEffect(() => {
    fetch("/api/persons")
      .then((r) => r.json())
      .then((data) => {
        setPersons(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markersData = persons
    .map((p) => {
      const lat = viewMode === "birth" ? p.birthLatitude : p.currentLatitude;
      const lng = viewMode === "birth" ? p.birthLongitude : p.currentLongitude;
      const place =
        viewMode === "birth"
          ? p.placeOfBirth
          : [p.currentCity, p.currentCountry].filter(Boolean).join(", ");
      if (lat == null || lng == null) return null;
      return { id: p.id, firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, lat, lng, place };
    })
    .filter(Boolean) as { id: string; firstName: string; lastName: string | null; dateOfBirth: string | null; lat: number; lng: number; place: string | null }[];

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Default to a world-centred view when no markers exist, so the user
  // sees a real map (not an empty placeholder) and can explore freely.
  const center: [number, number] = markersData.length > 0
    ? [
        markersData.reduce((sum, m) => sum + m.lat, 0) / markersData.length,
        markersData.reduce((sum, m) => sum + m.lng, 0) / markersData.length,
      ]
    : [20, 78]; // India-centred world view as a sensible family-tree default

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-amber-900">Family Map</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("birth")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "birth"
                ? "bg-amber-700 text-white"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            Birth Locations
          </button>
          <button
            onClick={() => setViewMode("current")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === "current"
                ? "bg-amber-700 text-white"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            }`}
          >
            Current Locations
          </button>
        </div>
      </div>
      <div
        className="relative rounded-lg shadow-md overflow-hidden border border-amber-100"
        style={{ height: "min(70vh, 500px)" }}
      >
        <MapWrapper markers={markersData} center={center} />
        {markersData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 border border-amber-200 rounded-lg px-6 py-4 text-center shadow-md pointer-events-auto">
              <p className="text-sm font-medium text-amber-900 mb-1">No location data yet</p>
              <p className="text-xs text-gray-500">
                Add or edit a family member and search for their birth or current location.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
