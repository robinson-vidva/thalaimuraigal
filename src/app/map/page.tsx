"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamically import map components to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
      const lat =
        viewMode === "birth" ? p.birthLatitude : p.currentLatitude;
      const lng =
        viewMode === "birth" ? p.birthLongitude : p.currentLongitude;
      const place =
        viewMode === "birth"
          ? p.placeOfBirth
          : [p.currentCity, p.currentCountry].filter(Boolean).join(", ");
      if (lat == null || lng == null) return null;
      return { ...p, lat, lng, place };
    })
    .filter(Boolean) as (PersonLocation & {
    lat: number;
    lng: number;
    place: string | null;
  })[];

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (markersData.length === 0) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-amber-900 mb-4">Family Map</h1>
        <p className="text-gray-500 mb-2">
          No location data available yet.
        </p>
        <p className="text-gray-400 text-sm">
          Add birth coordinates or current coordinates to family members to see
          them on the map. Edit a member and add latitude/longitude values.
        </p>
      </div>
    );
  }

  const center: [number, number] = [
    markersData.reduce((sum, m) => sum + m.lat, 0) / markersData.length,
    markersData.reduce((sum, m) => sum + m.lng, 0) / markersData.length,
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
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

      {mounted && (
        <div
          className="rounded-lg shadow-md overflow-hidden border border-amber-100"
          style={{ height: "70vh" }}
        >
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <MapContainer
            center={center}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markersData.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]}>
                <Popup>
                  <div className="text-sm">
                    <Link
                      href={`/persons/${m.id}`}
                      className="font-semibold text-amber-800 hover:underline"
                    >
                      {m.firstName} {m.lastName ?? ""}
                    </Link>
                    {m.place && (
                      <p className="text-gray-500 mt-1">{m.place}</p>
                    )}
                    {m.dateOfBirth && (
                      <p className="text-gray-400 text-xs">
                        Born: {m.dateOfBirth}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
