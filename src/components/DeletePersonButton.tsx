"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePersonButton({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/persons/${personId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/persons");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">Delete {personName}?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-md disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-red-500 hover:text-red-700 text-sm font-medium"
    >
      Delete Profile
    </button>
  );
}
