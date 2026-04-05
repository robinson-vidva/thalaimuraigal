import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-5xl font-bold text-amber-900 mb-2">
        தலைமுறைகள்
      </h1>
      <h2 className="text-2xl text-amber-700 mb-6">Thalaimuraigal</h2>
      <p className="text-gray-600 max-w-lg mb-8">
        Preserving family history across generations. Explore your family tree,
        discover relationships, and keep the stories of your ancestors alive.
      </p>
      <div className="flex gap-4">
        <Link
          href="/persons"
          className="bg-amber-700 text-white px-6 py-3 rounded-lg hover:bg-amber-800 font-medium transition-colors"
        >
          View Family Members
        </Link>
        <Link
          href="/persons/new"
          className="border-2 border-amber-700 text-amber-700 px-6 py-3 rounded-lg hover:bg-amber-100 font-medium transition-colors"
        >
          Add a Member
        </Link>
      </div>
    </div>
  );
}
