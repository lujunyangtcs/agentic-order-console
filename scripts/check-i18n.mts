/**
 * The language gate.
 *
 * Two checks, both of which fail the build:
 *
 * 1. Every key the English dictionary defines has a French value that is not
 *    empty and not identical to a `[[key]]` marker. TypeScript already forces
 *    the key set to match; this catches a blank or copy-pasted value.
 *
 * 2. Every navigation label is at most three words in both languages. A rail
 *    label that wraps or truncates reads as unfinished, and it is the one
 *    place the French text is very likely to be longer than the English.
 *
 * 3. Every `t('…')` call in the source names a key that exists.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { en } from '../src/i18n/en'
import { fr } from '../src/i18n/fr'

const ROOT = join(import.meta.dirname, '..')
const failures: string[] = []

for (const [key, value] of Object.entries(en)) {
  const f = (fr as Record<string, string>)[key]
  if (!f || !f.trim()) failures.push(`fr missing value for "${key}"`)
  if (f && f.startsWith('[[')) failures.push(`fr has a marker for "${key}"`)
  if (key.startsWith('nav.') && !key.startsWith('nav.group.')) {
    for (const [lang, v] of [['en', value], ['fr', f]] as const) {
      const words = String(v).trim().split(/\s+/)
      if (words.length > 3) failures.push(`${lang} nav label "${v}" is ${words.length} words (max 3)`)
      if (/[↔→←·|]/.test(String(v))) failures.push(`${lang} nav label "${v}" carries a symbol`)
    }
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full)
  }
  return out
}

const known = new Set(Object.keys(en))
for (const file of walk(join(ROOT, 'src'))) {
  if (file.includes('/i18n/')) continue
  const src = readFileSync(file, 'utf8')
  const re = /\bt\(\s*'([a-zA-Z0-9_.]+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (!known.has(m[1])) failures.push(`${relative(ROOT, file)}: unknown key "${m[1]}"`)
  }
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} language-gate failure(s)\n`)
  for (const f of failures) console.error('  ' + f)
  console.error('')
  process.exit(1)
}
console.log(`✓ language gate clean — ${Object.keys(en).length} keys in en and fr`)
