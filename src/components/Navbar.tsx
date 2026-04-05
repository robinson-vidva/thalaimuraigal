"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/persons", label: "Family Members" },
  { href: "/persons/new", label: "Add Member" },
  { href: "/tree", label: "Tree" },
  { href: "/generations", label: "Generations" },
  { href: "/map", label: "Map" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-amber-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold tracking-wide">
            தலைமுறைகள்
            <span className="text-amber-200 text-sm ml-2 font-normal">
              Thalaimuraigal
            </span>
          </Link>
          <div className="flex space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-amber-900 text-amber-100"
                    : "text-amber-100 hover:bg-amber-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
