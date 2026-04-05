"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons for Leaflet in webpack/Next.js
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MarkerData {
  id: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  lat: number;
  lng: number;
  place: string | null;
}

interface MapWrapperProps {
  markers: MarkerData[];
  center: [number, number];
}

export default function MapWrapper({ markers, center }: MapWrapperProps) {
  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]}>
          <Popup>
            <div className="text-sm">
              <Link
                href={`/persons/${m.id}`}
                className="font-semibold text-amber-800 hover:underline"
              >
                {m.firstName} {m.lastName ?? ""}
              </Link>
              {m.place && <p className="text-gray-500 mt-1">{m.place}</p>}
              {m.dateOfBirth && (
                <p className="text-gray-400 text-xs">Born: {m.dateOfBirth}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
