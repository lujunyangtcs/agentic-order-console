/**
 * The build gate.
 *
 * Runs first in `npm run build`, in the slot the donor repo used for its pack
 * boundary check. Same idea, different subject: a demo whose numbers disagree
 * across screens is worse than one that does not build, because the
 * disagreement is only discovered in front of the client.
 *
 * Four passes. Each fails the build with a message that says what to change.
 *
 * 1. **Retired vocabulary.** §7.3 settled on one word, `Blocked`, for the
 *    data-quality concept. Seven other spellings were in circulation and every
 *    one of them will creep back in unless something objects.
 *
 * 2. **Hardcoded ERP vendor.** FR-038 requires every vendor-specific string to
 *    come from the connector profile. the tenant's ERP is a Low-confidence
 *    assumption (§1.1 A-01); a component that names it in a layout has turned
 *    a guess into a fact.
 *
 * 3. **Date literals.** §8.2 requires fixture dates to be offsets from a single
 *    anchor so the demo does not silently expire. A literal year in a fixture
 *    is how that guarantee is lost.
 *
 * 4. **Fixture invariants.** §8.6's cross-screen numbers. Empty until P3 —
 *    deliberately, because a gate you trust is one that was passing before it
 *    had anything to check.
 */

import { CONNECTOR_PROFILE } from '../src/app/product'
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

/**
 * Blank out comments while preserving line numbers.
 *
 * Comments explain these rules, at length, so a naive scan reports the
 * documentation as a violation of itself. Per-line stripping is not enough
 * either: a block comment that spans lines leaves its middle looking like code,
 * which is how the word "rounded" inside a paragraph about rounding became a
 * radius-scale failure.
 */
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
    /* line comment */
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
      /* Some rules are about class names, and a class name only ever appears
       * beside `className` or inside `cn(`. Without that constraint the radius
       * check matches the word "rounded" in a sentence like "rounded up from
       * 20", which is prose in a template string and not a styling decision. */
      if (opts.onlyLines && !opts.onlyLines.test(text)) return
      const m = text.match(pattern)
      if (m) failures.push({ file: relative(ROOT, file), line: i + 1, detail: detail(m[0]) })
    })
  }
}

// ── 1 · Retired status vocabulary ───────────────────────────────────────────
scan(
  /\b(Data issues?|Blocking Issues|Blocked by Data Quality|Data-quality Blockers|Blocked Recommendations)\b/,
  (m) => `retired label "${m}" — §7.3 settled on "Blocked" everywhere`,
)

// ── 2 · Hardcoded system-of-record name ─────────────────────────────────────
/* The name of the customer's ERP is configuration, not code: it appears in
 * button labels, connector cards and audit rows, and a build that needs a code
 * change to rename it has failed FR-038.
 *
 * This rule used to enumerate the real vendor names it was banning, which made
 * the rule itself the only place in the repository where those names appeared —
 * caught by the identity gate on the first build after the scrub. It now checks
 * the inverse and stronger property: the profile's own display name must not be
 * repeated anywhere outside the profile. */
scan(
  new RegExp(`\\b${CONNECTOR_PROFILE.displayName}\\b|\\b${CONNECTOR_PROFILE.shortName}\\b`),
  (m) => `"${m}" hardcoded — read it from CONNECTOR_PROFILE (FR-038)`,
  { skip: (f) => f.endsWith('src/app/product.ts') },
)

// ── 3 · Date literals outside the calendar ──────────────────────────────────
scan(
  /['"`]20\d\d-\d\d-\d\d/,
  (m) => `literal date ${m.slice(1)} — author it as an offset in calendar.ts (§8.2)`,
  { skip: (f) => f.endsWith('src/fixtures/calendar.ts') || f.endsWith('src/app/product.ts') },
)

// ── 4 · Radius off the scale ────────────────────────────────────────────────
// A bare `rounded` is Tailwind's 4px default, not our 2px. One of those in a
// row of chips is the sort of thing nobody sees and everybody feels.
scan(
  /\brounded(?:-(?:[rltb]|tl|tr|bl|br))?(?![-\w[])|rounded-\[[^\]]+\]/,
  (m) => `"${m}" is off the radius scale — use rounded-xs/-sm/-md/-lg/-xl/-full (§10.5)`,
  { onlyLines: /className|\bcn\(/ },
)

// ── 5 · Fixture invariants ──────────────────────────────────────────────────
// The figures that appear on more than one screen, re-derived and compared.
// A fixture edit that breaks a cross-screen number fails the build here rather
// than surfacing as a contradiction in front of the client.

const inv: Failure[] = []
function expect(label: string, actual: number, want: number) {
  if (actual !== want) {
    inv.push({ file: 'src/fixtures', line: 0, detail: `${label}: derived ${actual}, expected ${want}` })
  }
}

{
  const { readinessOf, buildRequisitionSet, exposureOf } = await import('../src/fixtures/derive')
  const { HERO_ORDER, openOrders } = await import('../src/fixtures/orders')
  const { HERO_PART } = await import('../src/fixtures/parts')

  const r = readinessOf(HERO_ORDER)
  expect('analysed component lines', r.analysedLines, 250)
  expect('covered', r.covered, 236)
  expect('below safety after build', r.belowSafetyAfterBuild, 9)
  expect('short', r.short, 5)
  expect('part-resolution review', r.partResolutionReview, 1)
  expect('blocked', r.blocked, 1)

  // The two axes are independent; only the exclusive one sums to the total.
  expect(
    'coverage axis sums to analysed lines',
    r.covered + r.belowSafetyAfterBuild + r.short,
    r.analysedLines,
  )

  const set = buildRequisitionSet(HERO_ORDER)
  expect('requisition lines', set.lines.length, 8)
  expect('lines protecting the order', set.lines.filter((l) => l.reason === 'protect_order').length, 5)
  expect('lines restoring safety', set.lines.filter((l) => l.reason === 'restore_safety').length, 3)
  expect('supplier-scoped requisitions', set.requisitions.length, 3)

  /* Builds protected was a typed literal until it was caught in the visual
   * pass — hardcoded at the set, and a distinct-site count at the group, which
   * is a different quantity under the same label. Asserted here so the two can
   * never diverge again, and so the subset relation is checked rather than
   * assumed. */
  const { buildsProtectedBy } = await import('../src/fixtures/derive')
  expect('builds protected by the whole set', buildsProtectedBy(set.lines), 3)
  for (const req of set.requisitions) {
    const groupLines = set.lines.filter((l) => l.requisitionId === req.id)
    if (buildsProtectedBy(groupLines) > buildsProtectedBy(set.lines)) {
      inv.push({
        file: 'src/fixtures', line: 0,
        detail: `${req.id} protects more builds than the set containing it`,
      })
    }
  }

  const ex = exposureOf(HERO_PART)
  expect('configurations consuming the hero part', ex.configurationCount, 11)
  expect('configurations with live orders', ex.configurationsWithOrders, 3)
  expect('open customer orders', openOrders().length, 6)

  // ── 6 · Subset arithmetic ─────────────────────────────────────────────────
  // §8.6: a group that protects more orders than the requisition containing it
  // is the single most visible arithmetic error the demo can make. It is made
  // impossible by deriving both, and checked here in case that ever changes.
  const { ordersProtectedBy } = await import('../src/fixtures/derive')
  const whole = ordersProtectedBy(set.lines).length
  for (const req of set.requisitions) {
    const group = ordersProtectedBy(set.lines.filter((l) => l.requisitionId === req.id)).length
    if (group > whole) {
      inv.push({
        file: 'src/fixtures', line: 0,
        detail: `${req.id} protects ${group} orders but the whole set protects ${whole} — a subset cannot exceed its superset`,
      })
    }
  }
}

// ── 7 · The assembly sheet ──────────────────────────────────────────────────
// Validated at build time by the same validator the skill ships, so an invalid
// sheet fails here rather than rendering as a blank SVG nobody notices until
// the walk-through.
{
  const { buildAssemblySheet } = await import('../src/fixtures/assembly/buildSheet')
  const { validateSheet } = await import('./validate-exploded-view.mjs')
  const { CONFIGURATIONS } = await import('../src/fixtures/configurations')
  const { BLUEPRINT_COUNT } = await import('../src/fixtures/assembly/blueprints')

  for (const c of CONFIGURATIONS) {
    if (!c.finishedPart) continue
    const { sheet } = buildAssemblySheet(c.finishedPart)
    for (const problem of validateSheet(sheet) as string[]) {
      inv.push({ file: `assembly sheet ${c.finishedPart}`, line: 0, detail: problem })
    }
  }

  const { sheet } = buildAssemblySheet('ABC-6107')

  // §11.8's worked example names station 3 as the hero element. If the layout is
  // ever reordered, that example silently becomes wrong.
  const s3 = sheet.stations.find((st) => st.station === 3)
  if (s3?.partId !== 'ABC-1001') {
    inv.push({ file: 'assembly sheet', line: 0, detail: `station 3 is ${s3?.partId}, expected the hero element ABC-1001` })
  }

  // Every station needs bounds, or the selection halo and the off-sheet
  // markers have nothing to size themselves against.
  for (const st of sheet.stations) {
    const b = st.bbox as { minX: number; maxX: number; minY: number; maxY: number }
    if (!b || b.maxX <= b.minX || b.maxY <= b.minY) {
      inv.push({ file: 'assembly sheet', line: 0, detail: `station ${st.station} (${st.partId}) has no usable bbox` })
    }
  }

  // The blueprint budget, expressed as the rule rather than as a number.
  //
  // Shape varies only where the difference is a physical fact. Two places
  // qualify: plug bodies genuinely differ by voltage group (three drawings
  // where one station sits), and the high-speed rows carry a gearbox rather
  // than a speed drive. Everything else varies by part number on the same
  // geometry.
  //
  // So the ceiling is: one drawing per distinct station blueprint, plus those
  // three extras. Stations that share a drawing — the upper and lower element
  // wheels are the same wheel — cost nothing, which is the point. A count
  // above the ceiling means somebody drew a shape where an identity would
  // have done, and 204 hand-drawn parts is where that road ends.
  const { STATIONS } = await import('../src/fixtures/parts')
  const distinctStationDrawings = new Set(
    STATIONS.map((st) => st.blueprint).filter((b) => b !== 'cordset'),
  ).size
  /* Four: the three cord bodies (the `cordset` station has no drawing of its
   * own — it resolves to one of the three) and the high-speed gearbox. */
  const ALLOWED_SHAPE_VARIANTS = 4
  const ceiling = distinctStationDrawings + ALLOWED_SHAPE_VARIANTS
  if (BLUEPRINT_COUNT > ceiling) {
    inv.push({
      file: 'blueprints', line: 0,
      detail: `${BLUEPRINT_COUNT} blueprints against a ceiling of ${ceiling} ` +
              `(${distinctStationDrawings} station drawings + ${ALLOWED_SHAPE_VARIANTS} physical variants). ` +
              `Shape should vary only where the difference is physical.`,
    })
  }
}

failures.push(...inv)

if (failures.length) {
  console.error(`\n✗ ${failures.length} build-gate failure${failures.length === 1 ? '' : 's'}\n`)
  for (const f of failures) console.error(`  ${f.file}:${f.line}\n    ${f.detail}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ build gate clean — ${files.length} source files scanned`)
