// Shared date validation used by both the person form (client) and the
// /api/persons routes (server). Dates in this app are stored as strings in
// one of these accepted formats:
//   - "YYYY-MMM-DD"    full calendar date (canonical, e.g. "1985-Apr-08")
//   - "MMM-DD"         month + day only, when the year is unknown (e.g.
//                      "Apr-08"). The calendar still surfaces these as
//                      recurring annual events.
//   - "YYYY-MM-DD"     legacy numeric-month full date (still accepted on
//                      read so existing rows keep validating; the form's
//                      PartialDatePicker re-emits these as YYYY-MMM-DD the
//                      next time the record is saved).
//   - "YYYY"           legacy year-only, when the month and day are both
//                      unknown.
// Anything else is rejected up front so bad data never lands in the DB.

const YEAR_ONLY = /^\d{4}$/;
const FULL_NUMERIC_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_MMM_DATE = /^(\d{4})-([A-Za-z]{3})-(\d{1,2})$/;
const MONTH_DAY = /^([A-Za-z]{3})-(\d{1,2})$/;

// Absolute lower bound for any family-tree year. Rejects typos like "193"
// or "19850" early.
const MIN_YEAR = 1;

const MONTH_ABBREVS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function monthAbbrevToNumber(abbrev: string): number | null {
  return MONTH_ABBREVS[abbrev.toLowerCase()] ?? null;
}

/**
 * Validate a single "partial date" string (year-only or full YYYY-MM-DD).
 * Returns an error message on failure, or null when the value is valid or
 * empty. Empty strings / null / undefined are treated as "not provided"
 * and always pass.
 */
export function validatePartialDate(
  value: string | null | undefined,
  fieldLabel: string
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  const thisYear = new Date().getFullYear();
  const maxYear = thisYear + 1; // allow "next year" for planned events

  // Year-only form: "1985"
  if (YEAR_ONLY.test(trimmed)) {
    const year = parseInt(trimmed, 10);
    if (year < MIN_YEAR || year > maxYear) {
      return `${fieldLabel}: year ${year} is out of range (expected ${MIN_YEAR}\u2013${maxYear})`;
    }
    return null;
  }

  // Canonical full date form: "1985-Apr-08"
  const canonical = trimmed.match(FULL_MMM_DATE);
  if (canonical) {
    const year = parseInt(canonical[1], 10);
    const monthNum = monthAbbrevToNumber(canonical[2]);
    const day = parseInt(canonical[3], 10);
    if (year < MIN_YEAR || year > maxYear) {
      return `${fieldLabel}: year ${year} is out of range (expected ${MIN_YEAR}\u2013${maxYear})`;
    }
    if (monthNum === null) {
      return `${fieldLabel}: "${canonical[2]}" is not a valid month abbreviation (expected Jan\u2013Dec)`;
    }
    if (day < 1 || day > 31) {
      return `${fieldLabel}: day ${day} is not valid (must be 1\u201331)`;
    }
    const d = new Date(year, monthNum - 1, day);
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== monthNum - 1 ||
      d.getDate() !== day
    ) {
      return `${fieldLabel}: ${trimmed} is not a real calendar date`;
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (d.getTime() > todayEnd.getTime()) {
      return `${fieldLabel}: date cannot be in the future`;
    }
    return null;
  }

  // Month + day form: "Apr-08". No year, so no future-date check — an
  // annual recurring birthday is always valid regardless of when it's
  // entered. Feb 29 is accepted because without a year we can't know
  // whether it was a leap year at the person's actual birth.
  const mdMatch = trimmed.match(MONTH_DAY);
  if (mdMatch) {
    const monthNum = monthAbbrevToNumber(mdMatch[1]);
    if (monthNum === null) {
      return `${fieldLabel}: "${mdMatch[1]}" is not a valid month abbreviation (expected Jan\u2013Dec)`;
    }
    const day = parseInt(mdMatch[2], 10);
    if (day < 1 || day > 31) {
      return `${fieldLabel}: day ${day} is not valid (must be 1\u201331)`;
    }
    // Use 2000 (a leap year) to allow Feb 29 under this format.
    const d = new Date(2000, monthNum - 1, day);
    if (d.getMonth() !== monthNum - 1 || d.getDate() !== day) {
      return `${fieldLabel}: ${trimmed} is not a real calendar date`;
    }
    return null;
  }

  // Legacy numeric full date form: "1985-04-08". Still accepted for
  // backward compatibility with existing rows — the PartialDatePicker will
  // re-emit these as YYYY-MMM-DD the next time the record is saved.
  const match = trimmed.match(FULL_NUMERIC_DATE);
  if (!match) {
    return `${fieldLabel}: use YYYY or YYYY-MM-DD (got "${trimmed}")`;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < MIN_YEAR || year > maxYear) {
    return `${fieldLabel}: year ${year} is out of range (expected ${MIN_YEAR}\u2013${maxYear})`;
  }
  if (month < 1 || month > 12) {
    return `${fieldLabel}: month ${month} is not valid (must be 1\u201312)`;
  }
  if (day < 1 || day > 31) {
    return `${fieldLabel}: day ${day} is not valid (must be 1\u201331)`;
  }

  // Round-trip through Date to catch impossible calendar days: Feb 30,
  // April 31, Feb 29 in a non-leap year, etc. The Date constructor silently
  // rolls these to the next real day, so a mismatch after construction
  // means the user entered a day that doesn't exist.
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return `${fieldLabel}: ${trimmed} is not a real calendar date`;
  }

  // Not in the future. We compare against end-of-today in local time so a
  // birthday entered earlier today still passes.
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  if (d.getTime() > todayEnd.getTime()) {
    return `${fieldLabel}: date cannot be in the future`;
  }

  return null;
}

// Parse any of the accepted formats (except MMM-DD, which has no year) into
// the earliest point it could represent (Jan 1 for year-only strings). Used
// to check ordering between two partial dates — MMM-DD returns null because
// without a year we can't establish when it fell in a timeline.
function parseLowerBound(value: string): Date | null {
  const trimmed = value.trim();
  if (YEAR_ONLY.test(trimmed)) {
    return new Date(parseInt(trimmed, 10), 0, 1);
  }
  const canonical = trimmed.match(FULL_MMM_DATE);
  if (canonical) {
    const monthNum = monthAbbrevToNumber(canonical[2]);
    if (monthNum !== null) {
      return new Date(
        parseInt(canonical[1], 10),
        monthNum - 1,
        parseInt(canonical[3], 10)
      );
    }
  }
  const numeric = trimmed.match(FULL_NUMERIC_DATE);
  if (numeric) {
    return new Date(
      parseInt(numeric[1], 10),
      parseInt(numeric[2], 10) - 1,
      parseInt(numeric[3], 10)
    );
  }
  return null;
}

// Parse any of the accepted formats (except MMM-DD) into the latest point
// it could represent (Dec 31 for year-only strings). See parseLowerBound.
function parseUpperBound(value: string): Date | null {
  const trimmed = value.trim();
  if (YEAR_ONLY.test(trimmed)) {
    return new Date(parseInt(trimmed, 10), 11, 31);
  }
  const canonical = trimmed.match(FULL_MMM_DATE);
  if (canonical) {
    const monthNum = monthAbbrevToNumber(canonical[2]);
    if (monthNum !== null) {
      return new Date(
        parseInt(canonical[1], 10),
        monthNum - 1,
        parseInt(canonical[3], 10)
      );
    }
  }
  const numeric = trimmed.match(FULL_NUMERIC_DATE);
  if (numeric) {
    return new Date(
      parseInt(numeric[1], 10),
      parseInt(numeric[2], 10) - 1,
      parseInt(numeric[3], 10)
    );
  }
  return null;
}

/**
 * Check that a death date is not strictly earlier than a birth date.
 * If one or both dates are year-only, we compare the widest possible
 * interpretation (birth = earliest possible instant of its year, death =
 * latest possible instant of its year) so we only reject ranges that are
 * definitely impossible.
 */
export function validateBirthDeathOrder(
  dateOfBirth: string | null | undefined,
  dateOfDeath: string | null | undefined
): string | null {
  if (!dateOfBirth || !dateOfDeath) return null;
  const trimmedBirth = String(dateOfBirth).trim();
  const trimmedDeath = String(dateOfDeath).trim();
  if (!trimmedBirth || !trimmedDeath) return null;

  const birth = parseLowerBound(trimmedBirth);
  const death = parseUpperBound(trimmedDeath);
  if (!birth || !death) return null; // format is already invalid; another check will catch it

  if (death.getTime() < birth.getTime()) {
    return "Date of death cannot be before date of birth";
  }
  return null;
}

/**
 * Run the full set of person-level date checks. Returns the first error
 * encountered, or null if everything is valid. Designed so both the form's
 * client-side submit handler and the API route handlers can share a single
 * call.
 */
export function validatePersonDates(input: {
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
}): string | null {
  const birthError = validatePartialDate(input.dateOfBirth, "Date of birth");
  if (birthError) return birthError;
  const deathError = validatePartialDate(input.dateOfDeath, "Date of death");
  if (deathError) return deathError;
  const orderError = validateBirthDeathOrder(input.dateOfBirth, input.dateOfDeath);
  if (orderError) return orderError;
  return null;
}
