// Shop-local calendar-date helpers — 052-finance FR-027 (constitution "Time"):
// timestamps persist in UTC; the daily cash summary and date-range filters
// bucket by the shop-local calendar date (SC-012: a payment at 23:30 local
// time lands on that local date, never the UTC date).

/** Format a UTC instant as YYYY-MM-DD in the given IANA timezone. */
export function shopLocalDate(date: Date, timeZone: string): string {
  // en-CA yields ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Half-open UTC window [startOfDayUtc, startOfNextDayUtc) covering the given
 * shop-local calendar date (YYYY-MM-DD). Used to filter payments by local day.
 */
export function shopLocalDayBoundsUtc(
  localDate: string,
  timeZone: string,
): { startUtc: Date; endUtc: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error(`Invalid calendar date: ${localDate}`);
  }
  // Guess: treat the local midnight as if it were UTC, then correct by the
  // zone offset at that instant (two passes handle DST edges).
  const naiveUtc = new Date(`${localDate}T00:00:00.000Z`);
  const offsetAtGuess = zoneOffsetMs(naiveUtc, timeZone);
  let startUtc = new Date(naiveUtc.getTime() - offsetAtGuess);
  const offsetAtStart = zoneOffsetMs(startUtc, timeZone);
  if (offsetAtStart !== offsetAtGuess) {
    startUtc = new Date(naiveUtc.getTime() - offsetAtStart);
  }
  // Next local day: compute via formatting the noon of the start day + 1 day.
  const nextGuess = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  const nextLocal = shopLocalDate(nextGuess, timeZone);
  const nextNaive = new Date(`${nextLocal}T00:00:00.000Z`);
  const nextOffset = zoneOffsetMs(nextNaive, timeZone);
  const endUtc = new Date(nextNaive.getTime() - nextOffset);
  return { startUtc, endUtc };
}

/** Parse a UTC instant to the local calendar date (YYYY-MM-DD). */
export function calendarDateInZone(date: Date, timeZone: string): string {
  return shopLocalDate(date, timeZone);
}

/**
 * Normalize a user-chosen calendar date to UTC midnight of that date's
 * wall-clock representation (data-model: date-only fields store UTC midnight
 * of the chosen day; they are filtered as plain dates, never bucketed).
 */
export function calendarDateToUtcMidnight(localDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error(`Invalid calendar date: ${localDate}`);
  }
  return new Date(`${localDate}T00:00:00.000Z`);
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}
