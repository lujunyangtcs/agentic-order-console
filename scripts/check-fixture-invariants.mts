/**
 * The build gate.
 *
 * Runs first in `npm run build`. A demo whose numbers disagree across screens
 * is worse than one that does not build, because the disagreement is only
 * discovered in front of the client.
 *
 * Passes, each failing the build with a message that says what to change:
 *
 * 1. **Retired vocabulary.** One word per concept: Terminal (not plant),
 *    ePOD (not POD), Order or Load (not shipment), Truck (not vehicle).
 * 2. **Hardcoded system-of-record name.** The ERP's name is configuration.
 *    Components and copy read it from `SYSTEMS`; a literal fails.
 * 3. **Date literals.** Fixture dates are offsets from one anchor.
 * 4. **Radius off the scale.**
 * 5. **Fixture invariants.** The figures that appear on more than one screen,
 *    re-derived and compared. Filled in as the fixture engine lands.
 */

import { CONNECTOR_PROFILE } from '../src/app/product'
import { ORDERS } from '../src/fixtures/orders'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

type Failure = { file: string; line: number; detail: string }
const failures: Failure[] = []

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full)
  }
  return out
}

const files = walk(SRC)

/** Blank out comments while preserving line numbers. */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let mode: 'code' | 'block' | 'line' | 'str' = 'code'
  let quote = ''
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (mode === 'code') {
      if (two === '/*') { mode = 'block'; out += '  '; i += 2; continue }
      if (two === '//') { mode = 'line'; out += '  '; i += 2; continue }
      if (src[i] === '"' || src[i] === "'" || src[i] === '`') { mode = 'str'; quote = src[i] }
      out += src[i]; i++; continue
    }
    if (mode === 'str') {
      if (src[i] === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (src[i] === quote) mode = 'code'
      out += src[i]; i++; continue
    }
    if (mode === 'block') {
      if (two === '*/') { mode = 'code'; out += '  '; i += 2; continue }
      out += src[i] === '\n' ? '\n' : ' '; i++; continue
    }
    if (src[i] === '\n') { mode = 'code'; out += '\n'; i++; continue }
    out += ' '; i++
  }
  return out
}

function scan(
  pattern: RegExp,
  detail: (m: string) => string,
  opts: { skip?: (f: string) => boolean; onlyLines?: RegExp } = {},
) {
  for (const file of files) {
    if (opts.skip?.(file)) continue
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n')
    lines.forEach((text, i) => {
      if (opts.onlyLines && !opts.onlyLines.test(text)) return
      const m = text.match(pattern)
      if (m) failures.push({ file: relative(ROOT, file), line: i + 1, detail: detail(m[0]) })
    })
  }
}

// ── 1 · Retired vocabulary ──────────────────────────────────────────────────
scan(
  /\b(Plants?|POD|Shipments?|Vehicles?)\b/,
  (m) => `retired word "${m}" — say Terminal, ePOD, Order/Load or Truck`,
  { skip: (f) => f.endsWith('src/types/domain.ts') },
)

// ── 2 · Hardcoded system-of-record name ─────────────────────────────────────
scan(
  new RegExp(`\\b${CONNECTOR_PROFILE.displayName}\\b`),
  (m) => `"${m}" hardcoded — read it from SYSTEMS in src/app/product.ts`,
  { skip: (f) => f.endsWith('src/app/product.ts') },
)

// ── 3 · Date literals outside the calendar ──────────────────────────────────
scan(
  /['"`]20\d\d-\d\d-\d\d/,
  (m) => `literal date ${m.slice(1)} — author it as an offset in calendar.ts`,
  { skip: (f) => f.endsWith('src/fixtures/calendar.ts') || f.endsWith('src/app/product.ts') },
)

// ── 4 · Radius off the scale ────────────────────────────────────────────────
scan(
  /\brounded(?:-(?:[rltb]|tl|tr|bl|br))?(?![-\w[])|rounded-\[[^\]]+\]/,
  (m) => `"${m}" is off the radius scale — use rounded-xs/-sm/-md/-lg/-xl/-full`,
  { onlyLines: /className|\bcn\(/ },
)

// ── 5 · Fixture invariants ──────────────────────────────────────────────────
const inv: Failure[] = []
function expect(label: string, actual: number, want: number) {
  if (actual !== want) {
    inv.push({ file: 'src/fixtures', line: 0, detail: `${label}: derived ${actual}, expected ${want}` })
  }
}
// Every order is one order: a shared id would hand one order's proof of
// delivery to another.
expect('unique order ids', new Set(ORDERS.map((o) => o.id)).size, ORDERS.length)
expect('unique ERP references', new Set(ORDERS.map((o) => o.erpRef)).size, ORDERS.length)

failures.push(...inv)

if (failures.length) {
  console.error(`\n✗ ${failures.length} build-gate failure${failures.length === 1 ? '' : 's'}\n`)
  for (const f of failures) console.error(`  ${f.file}:${f.line}\n    ${f.detail}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ build gate clean — ${files.length} source files scanned`)
