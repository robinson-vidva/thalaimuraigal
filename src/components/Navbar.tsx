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
  { href: "/calendar", label: "Calendar" },
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
    <nav className="bg-amber-900 text-white shadow-lg border-b-2 border-amber-600/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-bold tracking-wide flex items-baseline gap-2">
            <span>தலைமுறைகள்</span>
            <span className="text-amber-300/80 text-xs font-normal hidden sm:inline">Thalaimuraigal</span>
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-0.5">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={`px-3 py-1.5 rounded-md text-xs font-medium tracking-wide uppercase transition-colors ${pathname === link.href ? "bg-amber-700/60 text-white" : "text-amber-200 hover:bg-amber-800 hover:text-white"}`}>{link.label}</Link>
            ))}
            <div className="w-px h-5 bg-amber-700 mx-2" />
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-md text-xs font-medium text-amber-300/70 hover:bg-amber-800 hover:text-white transition-colors">Logout</button>
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
