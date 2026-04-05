import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Thalaimuraigal - Family Tree",
  description:
    "Thalaimuraigal (தலைமுறைகள்) - A family tree website to preserve and explore family history across generations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-amber-50 font-sans">
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          {children}
        </main>
        <footer className="bg-amber-800 text-amber-200 text-center text-sm py-4">
          Thalaimuraigal - Preserving family history across generations
        </footer>
      </body>
    </html>
  );
}
