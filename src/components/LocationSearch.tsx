"use client";

import { useState, useRef, useEffect } from "react";

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

interface LocationData {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface LocationSearchProps {
  label: string;
  onSelect: (location: LocationData) => void;
  placeholder?: string;
}

export default function LocationSearch({ label, onSelect, placeholder }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5`,
          { headers: { "User-Agent": "Thalaimuraigal/1.0" } }
        );
        const data: LocationResult[] = await res.json();
        setResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function handleSelect(result: LocationResult) {
    const city = result.address?.city || result.address?.town || result.address?.village || "";
    const state = result.address?.state || "";
    const country = result.address?.country || "";

    setQuery(result.display_name);
    setShowDropdown(false);

    onSelect({
      city,
      state,
      country,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      displayName: result.display_name,
    });
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder={placeholder || "Search city, state, or country..."}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {searching && (
        <span className="absolute right-3 top-8 text-xs text-gray-400">Searching...</span>
      )}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b border-gray-100 last:border-0"
            >
              <span className="text-gray-800">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
