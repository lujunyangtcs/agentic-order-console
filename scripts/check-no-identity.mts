/**
 * No real-world identity in the tree.
 *
 * This repository is a white-label reference build: every name in it is a
 * placeholder, and this gate is what keeps that true. It runs ahead of the
 * type-check on every build and fails the build rather than warning, because a
 * single pasted line carrying a real customer, plant, vendor or part number is
 * exactly the kind of thing nobody notices in review and everybody notices in a
 * handover.
 *
 * ## Why the terms are hashed
 *
 * The obvious implementation is a list of banned words. The first version of
 * this file was one, and it was self-defeating: the check became the only place
 * in the repository where those words appeared, so anyone reading the gate
 * learned precisely what it was hiding. A denylist in a shipped artifact
 * publishes its own answer.
 *
 * So the terms live as salted digests in `.identity-hashes.json`. The gate
 * tokenizes each file, hashes each token the same way, and reports a position
 * without ever holding the word it matched. It can say "this line carries a
 * name that must not ship" and point at the line; it cannot say what the name
 * is, and neither can the file.
 *
 * The cost is that this matches whole tokens rather than substrings. Splitting
 * on non-alphanumerics and on camel-case boundaries makes that generous — a
 * name inside `SO-NAME-10482`, `name_plant`, `plantName` or a bare part number
 * all tokenize apart — but a banned word welded into a longer lowercase run
 * would survive. That is the trade for not shipping the list, and it is the
 * right way round: the gate is a safety net under review, not a substitute for
 * it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'

const { salt, hashes } = JSON.parse(
  readFileSync(new URL('./.identity-hashes.json', import.meta.url), 'utf8'),
) as { salt: string; hashes: string[] }

const BANNED = new Set(hashes)
const digest = (s: string) => createHash('sha256').update(salt + s).digest('hex').slice(0, 16)

const EXTS = new Set(['.ts', '.tsx', '.css', '.json', '.md', '.html', '.mts', '.mjs', '.js'])
const SKIP = new Set(['node_modules', 'dist', '.git', 'package-lock.json', '.identity-hashes.json'])

/* Split camelCase and PascalCase too, so a name embedded as `plantName` or
 * `NameMain` comes apart rather than hiding inside a longer token. */
function tokens(line: string): string[] {
  return line
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase())
}

const failures: string[] = []
let scanned = 0

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!EXTS.has(extname(p))) continue
    scanned++
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (tokens(line).some((t) => BANNED.has(digest(t)))) {
        failures.push(`${p}:${i + 1}`)
      }
    })
  }
}

walk('.')

if (failures.length) {
  console.error(`\n✗ real-world identity found in ${failures.length} place(s):\n`)
  for (const f of failures) console.error('  ' + f)
  console.error(
    '\nThis repository ships externally. Replace the name at each position\n' +
    'with a placeholder — ABC, Plant A, Supplier B, ABC-1001.\n',
  )
  process.exit(1)
}
console.log(`✓ no real-world identity — ${scanned} files scanned`)
