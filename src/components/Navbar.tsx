"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-amber-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold tracking-wide">
            தலைமுறைகள்
            <span className="text-amber-200 text-sm ml-2 font-normal">Thalaimuraigal</span>
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === link.href ? "bg-amber-900 text-amber-100" : "text-amber-100 hover:bg-amber-700"}`}>{link.label}</Link>
            ))}
            <button onClick={handleLogout} className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-amber-200 hover:bg-amber-700 transition-colors">Logout</button>
          </div>
          {/* Hamburger button */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-md hover:bg-amber-700 transition-colors" aria-label="Toggle menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-amber-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${pathname === link.href ? "bg-amber-900 text-amber-100" : "text-amber-100 hover:bg-amber-700"}`}>{link.label}</Link>
            ))}
            <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-amber-200 hover:bg-amber-700 transition-colors">Logout</button>
          </div>
        </div>
      )}
    </nav>
  );
}
