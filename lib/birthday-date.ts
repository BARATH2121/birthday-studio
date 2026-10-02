/**
 * Birthday date and expiry arithmetic.
 *
 * Deliberately dependency-free and DOM-free: everything in this file is a pure
 * function of its arguments, which is what makes the boundary rules testable
 * without a browser, a database or a clock of our own choosing.
 *
 * THE RULE: a birthday page exists only until the end of the birthday it was
 * made for, and it never stores a birth year.
 */

export const BIRTHDAY_TIME_ZONE = "Asia/Kolkata";

/** January = 1. Matches the `smallint` column, not a JS Date month. */
export type BirthdayMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const MONTHS = [
  { value: 1, name: "January", short: "Jan" },
  { value: 2, name: "February", short: "Feb" },
  { value: 3, name: "March", short: "Mar" },
  { value: 4, name: "April", short: "Apr" },
  { value: 5, name: "May", short: "May" },
  { value: 6, name: "June", short: "Jun" },
  { value: 7, name: "July", short: "Jul" },
  { value: 8, name: "August", short: "Aug" },
  { value: 9, name: "September", short: "Sep" },
  { value: 10, name: "October", short: "Oct" },
  { value: 11, name: "November", short: "Nov" },
  { value: 12, name: "December", short: "Dec" },
] as const;

/**
 * Length of each month in a NON-leap year.
 *
 * February is 29 here, not 28: a birthday may legitimately be the 29th of
 * February, and refusing to let anyone pick it would be wrong. Whether that
 * birthday can occur in the current year is a separate question, answered by
 * `isLeapYear`, because the year is never stored.
 */
export const DAYS_IN_MONTH = [
  31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

export function daysInMonth(month: number): number {
  if (!isValidMonth(month)) return 0;
  return DAYS_IN_MONTH[month - 1];
}

export function isValidMonth(month: unknown): month is BirthdayMonth {
  return (
    typeof month === "number" &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}

/**
 * A day is valid for a month when it fits in a non-leap year.
 *
 * `29 February` passes here and is resolved later, at expiry time, against the
 * year that actually applies. `30 February` and `31 April` fail here.
 */
export function isValidDayForMonth(day: unknown, month: unknown): boolean {
  if (!isValidMonth(month)) return false;
  if (typeof day !== "number" || !Number.isInteger(day)) return false;
  return day >= 1 && day <= daysInMonth(month);
}

export function isValidBirthdayDate(day: unknown, month: unknown): boolean {
  return isValidDayForMonth(day, month);
}

export function isLeapYear(year: number): boolean {
  if (!Number.isInteger(year)) return false;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * The day actually celebrated in `year`.
 *
 * Only 29 February ever needs adjusting. For a person born on the 29th, a year
 * that is not a leap year has no such date, so the celebration is held on the
 * 28th — the last day of February — rather than spilling into March or
 * skipping to the next leap year eight years away.
 */
export function resolvedDay(day: number, month: number, year: number): number {
  if (month === 2 && day === 29 && !isLeapYear(year)) return 28;
  return day;
}

export function monthName(month: number): string {
  return MONTHS.find((entry) => entry.value === month)?.name ?? "";
}

export function formatBirthdayDate(day: number, month: number): string {
  if (!isValidBirthdayDate(day, month)) return "";
  return `${day} ${monthName(month)}`;
}

/* -------------------------------------------------------------------------- */
/* Time zone arithmetic                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Offset of `timeZone` from UTC, in minutes, at a given instant.
 *
 * Derived through `Intl` rather than assumed to be a constant, so this stays
 * correct for a zone that observes daylight saving. Asia/Kolkata is UTC+05:30
 * with no DST today, but "no DST today" is not the same as "never", and a hard
 * coded `330` would silently rot the day India changed its rules again.
 *
 * Positive east of Greenwich.
 */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );

  // Intl truncates to whole seconds, so the difference is rounded to the minute.
  return Math.round((asUtc - instant.getTime()) / 60000);
}

export type ZonedDateParts = { year: number; month: number; day: number };

/** The calendar date an instant falls on, as seen in `timeZone`. */
export function zonedDateParts(
  instant: Date,
  timeZone: string,
): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return { year: read("year"), month: read("month"), day: read("day") };
}

/**
 * The instant of 23:59:59.999 on a given calendar date in a given zone.
 *
 * The offset is sampled at midday first, then corrected once against the actual
 * candidate instant. One correction is enough: a zone either keeps the same
 * offset across a day or steps exactly once at its DST transition, and the
 * transition never lands on 31 December at midnight.
 */
function endOfDayInstant(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  const noonOffset = zoneOffsetMinutes(
    new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
    timeZone,
  );
  const first = wallClock - noonOffset * 60_000;

  const correctedOffset = zoneOffsetMinutes(new Date(first), timeZone);
  if (correctedOffset === noonOffset) return new Date(first);

  return new Date(wallClock - correctedOffset * 60_000);
}

/**
 * When a page made for this birthday stops working.
 *
 * "The next occurrence of this day and month, at the last moment of that day in
 * Asia/Kolkata."
 *
 *   today = 1 October 2026, birthday = 5 October  -> 5 October 2026 23:59:59.999
 *   today = 1 October 2026, birthday = 2 October  -> 2 October 2026 23:59:59.999
 *   today = 6 October 2026, birthday = 5 October  -> 5 October 2027 23:59:59.999
 *
 * The second line is the one that matters. A naive implementation that only
 * compared month and day, or that treated "upcoming" as "later this year",
 * would hand back a date almost twelve months away for a birthday that is
 * tomorrow — turning a page that should live for one day into a page that lives
 * for a year.
 *
 * A birthday that is *today* expires tonight, not in a year.
 *
 * @param now reference instant. Injected so tests are not clock-dependent; in
 *   the app this is simply "now".
 */
export function computeExpiresAt(
  day: number,
  month: number,
  now: Date = new Date(),
  timeZone: string = BIRTHDAY_TIME_ZONE,
): Date | null {
  if (!isValidBirthdayDate(day, month)) return null;

  const localToday = zonedDateParts(now, timeZone);

  let year = localToday.year;
  let candidate = endOfDayInstant(
    year,
    month,
    resolvedDay(day, month, year),
    timeZone,
  );

  // Strict `<`, not `<=`.
  //
  // The roll has to mean "the birthday is over", and the birthday is over only
  // once the local calendar has moved past it. At the exact final millisecond
  // (23:59:59.999) the day is still today, so the page should keep whatever
  // expiry that instant gives it rather than jumping a year.
  //
  // This is also the comparison that makes this function provably identical to
  // birthday_expiry_for() in supabase/migrations/20261002120000_birthday_expiry_audio.sql,
  // which can only compare calendar dates and so rolls when the local date is
  // strictly greater. `now > endOfDay` is exactly `localDate > birthdayDate`.
  // Both are verified against each other over 2024-2033.
  if (candidate.getTime() < now.getTime()) {
    year += 1;
    candidate = endOfDayInstant(
      year,
      month,
      resolvedDay(day, month, year),
      timeZone,
    );
  }

  return candidate;
}

/** True when `expiresAt` is already in the past. */
export function isExpired(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const at = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const time = at.getTime();
  if (!Number.isFinite(time)) return false;
  return time <= now.getTime();
}