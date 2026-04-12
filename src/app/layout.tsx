import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Thalaimuraigal - Family Tree",
  description: "A family tree website to preserve and explore family history across generations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50 to-orange-50/30">
        <Navbar />
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">{children}</main>
        <footer className="bg-amber-900 text-amber-300/80 text-center text-xs py-5 tracking-wide">
          <span className="font-semibold text-amber-200">Thalaimuraigal</span> &mdash; Preserving family history across generations
        </footer>
      </body>
    </html>
  );
}
