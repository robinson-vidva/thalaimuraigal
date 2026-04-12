import PersonForm from "@/components/PersonForm";
import Link from "next/link";

export default function NewPersonPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/persons" className="text-amber-700 hover:underline text-sm">&larr; Back to Family Members</Link>
      </div>
      <h1 className="text-2xl font-bold text-amber-900 mb-6">Add Family Member</h1>
      <PersonForm />
    </div>
  );
}
