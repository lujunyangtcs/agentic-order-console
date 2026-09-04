# Verification

The build is checked in a real browser against the production bundle, not in
unit tests. What follows is the standing protocol and, more usefully, the
measurement bugs found while writing it — every one of which reported a problem
that did not exist, or hid one that did.

## Protocol

In this order, every time:

1. `npm run build` first. Never audit the dev server; the production bundle is
   what breaks.
2. Serve it: `npm run preview`.
3. Set the viewport to 1440×900, then repeat the geometry checks at 1280×720.
4. Clear session storage and reload, so persisted decisions do not mask a seed
   problem.
5. One route per evaluation call. Long-running page scripts get truncated
   silently, which produces false passes.

## The twelve assertions

| | |
|---|---|
| V1 | No page-level horizontal overflow: `body.scrollWidth === body.clientWidth` |
| V2 | Every horizontal scroller sets `overscroll-behavior-x: contain` |
| V3 | Same-row cards differ in height by 0px |
| V4 | No void larger than 15px inside a card — the fix is more real content, never a taller spacer |
| V5 | Zero console errors; hydration warnings count |
| V6 | WCAG 2.1 AA contrast, computed per node |
| V7 | A visible 2px focus indicator on every focusable element |
| V8 | Drawers trap focus, are 480–520px wide, and return focus on close |
| V9 | Reduced motion degrades a marquee into a real scroller, never the reverse |
| V10 | Copy and nav laws: ≤3 words, no symbols, no truncation |
| V11 | One title per card |
| V12 | Gradients only where named |

## The colour parser, and why it is not three lines

Three bugs, all of which produced false failures. The same mistakes produce
false *passes* in the other direction, which is worse.

**First**, Tailwind v4 emits `oklab(0.999994 … / 0.7)` for any alpha-modified
colour. Pulling the first three numbers out of the string and treating them as
RGB reads near-white as near-black, and reported 1.3:1 on text that renders at
about 16:1.

**Second**, converting oklab correctly but ignoring alpha treats a ten-percent
tint as the full-strength colour. Dark teal text on a 10% teal ground measured
1.78:1 — teal on teal — for a chip that actually renders at about 5.8:1.

**Third**, the subtlest: the ground has to be computed from the element
*itself*, not its parent. A badge carrying both a background and a text colour
has its text sitting on its own background; starting the ancestor walk one level
up measures white-on-white and reports a ratio of exactly 1.00.

A ratio of exactly 1.00 is the tell. Real designs land on awkward numbers like
3.7 or 4.2; a clean 1.00 means the two colours being compared are literally the
same value, which almost always means the ground came from the wrong node.

```js
const srgb = c => c <= 0.0031308 ? 12.92*c : 1.055*Math.pow(c, 1/2.4) - 0.055
function oklabToRgb(L, a, b) {
  const l = (L + 0.3963377774*a + 0.2158037573*b)**3
  const m = (L - 0.1055613458*a - 0.0638541728*b)**3
  const s = (L - 0.0894841775*a - 1.2914855480*b)**3
  return [
    srgb(+4.0767416621*l - 3.3077115913*m + 0.2309699292*s),
    srgb(-1.2684380046*l + 2.6097574011*m - 0.3413193965*s),
    srgb(-0.0041960863*l - 0.7034186147*m + 1.7076147010*s),
  ].map(v => Math.max(0, Math.min(255, Math.round(v*255))))
}

const unparseable = []
function parse(str) {
  const s = String(str)
  const n = (s.match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number)
  if (s.startsWith('oklab')) return { rgb: oklabToRgb(n[0], n[1], n[2]), a: s.includes('/') ? (n[3] ?? 1) : 1 }
  if (s.startsWith('rgb'))   return { rgb: n.slice(0, 3), a: n.length > 3 ? n[3] : 1 }
  unparseable.push(s.slice(0, 32))
  return null
}

const over = (fg, bg, a) => fg.map((c, i) => Math.round(c*a + bg[i]*(1 - a)))

/* Starts at `el`, not `el.parentElement` — see the third bug above. */
function bgOf(el) {
  const layers = []
  for (let n = el; n; n = n.parentElement) {
    const p = parse(getComputedStyle(n).backgroundColor)
    if (!p || p.a === 0) continue
    layers.push(p)
    if (p.a === 1) break
  }
  let out = [255, 255, 255]
  for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i].rgb, out, layers[i].a)
  return out
}
```

Collect anything the parser could not read. A silent `null` is how a whole
class of colours ends up unchecked.

## Other measurement traps

**Measure at the right width.** A collapsed browser pane reported 105px of page
overflow that did not exist. Set the viewport explicitly before trusting any
geometry.

**Programmatic focus is not `:focus-visible`.** Calling `.focus()` in a loop and
reading the computed style reports no focus ring on elements that ring correctly
under real keyboard tabbing. Press Tab.

**Read the whole box-shadow.** Truncating the value at 80 characters hid a solid
2px ring behind three leading transparent entries and reported a missing focus
indicator.

**A synthetic navigation loop reads stale DOM on its first iteration.** Prime it
with a throwaway navigation and discard that reading.

## Screenshots

The production bundle, captured at the real viewport size:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=7000 \
  --screenshot=out.png http://localhost:4173/command-center
```

`--virtual-time-budget` is the part that matters: without it the shutter fires
before the queries resolve and every capture is a skeleton.

Look at them. Two defects survived eight rounds of DOM assertions and were
obvious in a picture: a floating badge sitting on top of a drawing, and two
adjacent cards reporting the same column label for quantities three orders of
magnitude and one meaning apart. Neither was visible to a query.

## Print

Print is checked by actually printing:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf=out.pdf http://localhost:4173/assemblies/abc-6107
pdftoppm -jpeg -r 80 out.pdf page
```

Checking that the print rules *apply* is not the same as checking that the page
prints. The rules applied and the output was still wrong three ways: the
activity ticker printed, a list capped by `max-height` clipped at nine rows of
seventeen, and the drawing itself was missing — `height: auto` on an inline SVG
resolves to zero without an intrinsic ratio to work from.
