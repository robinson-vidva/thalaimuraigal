// Shared loading spinner used across all pages. Renders a CSS-animated
// circular spinner with an optional label below it. Pure Tailwind — no
// external dependencies or keyframe definitions needed (uses the built-in
// `animate-spin` utility).

export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-700 rounded-full animate-spin" />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  );
}
