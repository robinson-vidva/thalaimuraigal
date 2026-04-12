// Human-readable date formatter shared across pages. Converts the
// internal canonical strings into natural English text.
//
// This module is deliberately kept small and free of React or Prisma
// imports so it can be used on both Server Components (Generations
// page) and Client Components (Family Members table).

const MONTH_FULL: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April",
  may: "May", jun: "June", jul: "July", aug: "August",
  sep: "September", oct: "October", nov: "November", dec: "December",
};
const MONTH_BY_NUM: string[] = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Convert a stored date string to a human-friendly form:
 *
 *   "1985-Apr-08"  →  "April 8, 1985"
 *   "Apr-08"       →  "April 8"
 *   "1985-04-08"   →  "April 8, 1985"   (legacy numeric)
 *   "1985"         →  "1985"             (year-only)
 *   null / ""      →  null
 */
export function formatDateHuman(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = date.trim();
  if (!trimmed) return null;
  // Canonical YYYY-MMM-DD
  let m = trimmed.match(/^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/);
  if (m) {
    const month = MONTH_FULL[m[2].toLowerCase()] ?? m[2];
    return `${month} ${parseInt(m[3], 10)}, ${m[1]}`;
  }
  // MMM-DD
  m = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (m) {
    const month = MONTH_FULL[m[1].toLowerCase()] ?? m[1];
    return `${month} ${parseInt(m[2], 10)}`;
  }
  // Legacy YYYY-MM-DD
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const month = MONTH_BY_NUM[parseInt(m[2], 10)] ?? m[2];
    return `${month} ${parseInt(m[3], 10)}, ${m[1]}`;
  }
  // Year-only or anything else
  return trimmed;
}
