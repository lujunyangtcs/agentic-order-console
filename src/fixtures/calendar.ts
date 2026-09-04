/**
 * The only place a date is created.
 *
 * ## The problem this solves
 *
 * A demo whose dates are literals expires. Not loudly — it keeps working, and
 * then one day the "urgent" order is three months overdue, the "confirmed
 * yesterday" supplier email is from last quarter, and the presenter finds out
 * in the room. Literal dates and a hardcoded "now" are what cause that: the
 * dataset stays pinned to the day it was written while `relativeAge()` reads
 * the real clock, and the two disagree a little more every day.
 *
 * ## How it works
 *
 * Everything is authored as an **offset from one anchor**. `d(23)` is
 * twenty-three days after the anchor, `d(-104)` is a hundred and four days
 * before it. At render time the offset is resolved against *today*, so the
 * whole dataset slides forward and every relative relationship survives intact
 * — the 21-day uncovered window stays 21 days, the 34-day lead time stays 34
 * days, the 104-day-old evidence stays 104 days old.
 *
 * Run the demo on the anchor date and every literal in the the design notes reproduces
 * exactly. Run it eleven months later and it is still internally correct.
 *
 * ## Why an anchor at all, rather than just using today
 *
 * The the design notes fixes specific dates — 08 Sep 2026, 29 Sep 2026, 21 Aug 2026 — and
 * those are what a reviewer checks the build against. The anchor is what makes
 * the document and the build agree on the day it was written, while the offsets
 * are what keep the build honest afterwards.
 *
 * The build gate refuses a literal `20xx-xx-xx` anywhere in `src/fixtures`
 * outside this file.
 */

/** §8.2. The day the fixture's literals were written against. */
export const ANCHOR = '2026-09-04'

const DAY_MS = 86_400_000

function anchorMs(): number {
  return Date.parse(`${ANCHOR}T00:00:00Z`)
}

/**
 * Today, at UTC midnight.
 *
 * Read once per session rather than per call: a walk that crosses midnight
 * should not have half its dates shift underneath the presenter.
 */
const TODAY_MS = (() => {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
})()

/** How far the whole dataset slides. Zero when run on the anchor date. */
export const DRIFT_MS = TODAY_MS - anchorMs()

/** Days offset from today. `d(0)` is today; `d(-5)` is five days ago. */
export function d(offsetDays: number): string {
  return new Date(TODAY_MS + offsetDays * DAY_MS).toISOString().slice(0, 10)
}

/** Offset from today with a wall-clock time, as an ISO timestamp. */
export function ts(offsetDays: number, hhmm = '09:00'): string {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(TODAY_MS + offsetDays * DAY_MS + h * 3_600_000 + m * 60_000).toISOString()
}

/** Today, for the `Data as of` stamp every data-dependent page carries (§6.3). */
export const TODAY = d(0)

/** Whole days between two ISO dates. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

/** Days from today. Negative for the past. */
export function daysFromToday(iso: string): number {
  return daysBetween(TODAY, iso.slice(0, 10))
}

/**
 * `DD MMM YYYY`. The year is never omitted — §8.2 calls a bare `Sep 18` in an
 * audit column a defect, and it is right: a timestamp without a year is a
 * timestamp you cannot check.
 */
const MONTHS = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  fr: ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],
} as const

export type DateLang = 'en' | 'fr'

export function formatDate(iso: string, lang: DateLang = 'en'): string {
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  const dt = new Date(t)
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${MONTHS[lang][dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

/** `HH:MM` in UTC — the demo clock is UTC throughout so timestamps never
 *  shift between the presenter's laptop and the projector. */
export function formatTime(iso: string): string {
  const dt = new Date(Date.parse(iso))
  return `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
}

export function formatDateTime(iso: string, lang: DateLang = 'en'): string {
  return `${formatDate(iso, lang)} ${formatTime(iso)}`
}

/** The wall clock, as an ISO timestamp. The only place `new Date()` is read
 *  for a mutation stamp; the mock clamps it after the last authored event. */
export function nowIso(): string {
  return new Date().toISOString()
}

/** "3 days ago", "in 2 weeks". For activity rails and evidence ages. */
export function relativeAge(iso: string): string {
  const n = daysFromToday(iso)
  if (n === 0) return 'today'
  if (n === -1) return 'yesterday'
  if (n === 1) return 'tomorrow'
  const abs = Math.abs(n)
  const unit = abs >= 60 ? `${Math.round(abs / 30)} months` : abs >= 14 ? `${Math.round(abs / 7)} weeks` : `${abs} days`
  return n < 0 ? `${unit} ago` : `in ${unit}`
}

/** Open-ended validity, for revision-versioned records. */
export const FOREVER = '9999-12-31'
