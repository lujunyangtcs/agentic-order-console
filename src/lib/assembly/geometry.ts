/**
 * The vocabulary of an engineering line sheet.
 *
 * It is a small vocabulary, which is the point. A disc is concentric ellipses
 * offset on x. A shaft is a line with a capped ellipse. A housing is a rounded
 * rect. Anything else is a path somebody drew. Five primitives cover a whole
 * assembly, and building them from helpers rather than hand-typing coordinates
 * buys three things:
 *
 * **Self-consistency.** Concentric discs and mirrored bearing races have to
 * agree with themselves or the sheet reads as amateur. A helper cannot typo a
 * `cy`.
 *
 * **Bounds.** Every station needs a bounding box — the selection halo and the
 * off-sheet edge markers both depend on it, and a hand-written `path` cannot
 * supply one without a parser we are not writing. Helpers emit the box
 * alongside the shapes.
 *
 * **Honesty about fidelity.** Nothing here implies a dimension. The sheet is
 * `illustrative`, drawn to communicate assembly structure, and the geometry is
 * deliberately schematic so it cannot be mistaken for a controlled source. The
 * skill's source-fidelity rules are explicit that tolerances, fits, thread
 * classes and materials are never inferred, and drawing something that *looks*
 * measured is the first step toward someone measuring it.
 *
 * Coordinates are station-local: the origin sits on the optical centreline,
 * +x to the right.
 */

export type Shape =
  | { kind: 'path'; d: string; fill?: string }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: string }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Drawing {
  shapes: Shape[]
  bbox: BBox
}

const EMPTY: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

function grow(b: BBox, minX: number, minY: number, maxX: number, maxY: number): BBox {
  return {
    minX: Math.min(b.minX, minX),
    minY: Math.min(b.minY, minY),
    maxX: Math.max(b.maxX, maxX),
    maxY: Math.max(b.maxY, maxY),
  }
}

/**
 * Bounds for the primitives we generate.
 *
 * `path` is the exception and it is handled by declaring its box explicitly at
 * the call site. Parsing arbitrary path data to find its extent is a real
 * parser — cubic control points do not bound the curve — and one hand-declared
 * box per organic shape is cheaper and more honest than an approximation that
 * is wrong on exactly the shapes it was written for.
 */
export function bboxOf(shapes: Shape[], pathBoxes: BBox[] = []): BBox {
  let b = shapes.reduce((acc, s) => {
    switch (s.kind) {
      case 'ellipse':
        return grow(acc, s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry)
      case 'rect':
        return grow(acc, s.x, s.y, s.x + s.width, s.y + s.height)
      case 'line':
        return grow(acc, Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2))
      case 'path':
        return acc
    }
  }, EMPTY)
  for (const p of pathBoxes) b = grow(b, p.minX, p.minY, p.maxX, p.maxY)
  return b.minX === Infinity ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : b
}

function drawing(shapes: Shape[], pathBoxes: BBox[] = []): Drawing {
  return { shapes, bbox: bboxOf(shapes, pathBoxes) }
}

/* ── Primitives ──────────────────────────────────────────────────────────── */

/**
 * A disc seen edge-on: the outer face, an inner face offset on x to suggest
 * thickness, and a bore. Three ellipses read as a solid object because the eye
 * fills in the cylinder between the two faces.
 */
export function disc(opts: { ry: number; thickness: number; bore?: number; rx?: number }): Drawing {
  const rx = opts.rx ?? Math.max(6, Math.round(opts.ry * 0.26))
  const shapes: Shape[] = [
    { kind: 'ellipse', cx: 0, cy: 0, rx, ry: opts.ry },
    { kind: 'ellipse', cx: opts.thickness, cy: 0, rx: rx * 0.55, ry: opts.ry * 0.94 },
  ]
  if (opts.bore) {
    shapes.push({ kind: 'ellipse', cx: opts.thickness, cy: 0, rx: rx * 0.36, ry: opts.bore })
  }
  return drawing(shapes)
}

/** A pair of races, mirrored about the centreline. Bearings come in twos. */
export function bearingPair(opts: { ry: number; gap: number }): Drawing {
  const rx = Math.max(5, Math.round(opts.ry * 0.32))
  const half = opts.gap / 2
  return drawing([
    { kind: 'ellipse', cx: -half - 8, cy: 0, rx, ry: opts.ry },
    { kind: 'ellipse', cx: -half, cy: 0, rx: rx * 0.8, ry: opts.ry * 0.93 },
    { kind: 'ellipse', cx: half, cy: 0, rx, ry: opts.ry },
    { kind: 'ellipse', cx: half + 8, cy: 0, rx: rx * 0.8, ry: opts.ry * 0.93 },
  ])
}

/** A body with a shaft out of one side, and an optional terminal box on top. */
export function housing(opts: {
  width: number
  height: number
  shaft?: number
  terminal?: boolean
}): Drawing {
  const halfH = opts.height / 2
  const shapes: Shape[] = [
    { kind: 'rect', x: -opts.width / 2, y: -halfH, width: opts.width, height: opts.height, rx: 3 },
    { kind: 'ellipse', cx: opts.width / 2, cy: 0, rx: 10, ry: halfH },
  ]
  if (opts.terminal) {
    shapes.push({ kind: 'rect', x: -opts.width * 0.16, y: -halfH - 22, width: opts.width * 0.42, height: 22 })
  }
  if (opts.shaft) {
    shapes.push({ kind: 'line', x1: opts.width / 2 + 10, y1: 0, x2: opts.width / 2 + 10 + opts.shaft, y2: 0 })
    shapes.push({ kind: 'ellipse', cx: opts.width / 2 + 10 + opts.shaft, cy: 0, rx: 7, ry: 6 })
  }
  return drawing(shapes)
}

/** A stack of collars on a common shaft — spacers, rollers, a fuse bank. */
export function stack(opts: { count: number; ry: number; pitch: number }): Drawing {
  const span = ((opts.count - 1) * opts.pitch) / 2
  const shapes: Shape[] = [
    { kind: 'line', x1: -span - 22, y1: 0, x2: span + 22, y2: 0 },
  ]
  for (let i = 0; i < opts.count; i++) {
    const cx = -span + i * opts.pitch
    shapes.push({ kind: 'ellipse', cx, cy: 0, rx: Math.max(5, opts.ry * 0.3), ry: opts.ry })
  }
  return drawing(shapes)
}

/** A flat plate seen edge-on, with mounting holes. Boards, guards, plates. */
export function plate(opts: { height: number; thickness: number; holes?: number }): Drawing {
  const halfH = opts.height / 2
  const shapes: Shape[] = [
    { kind: 'rect', x: -opts.thickness / 2, y: -halfH, width: opts.thickness, height: opts.height, rx: 2 },
  ]
  for (let i = 0; i < (opts.holes ?? 0); i++) {
    const cy = -halfH + ((i + 1) * opts.height) / ((opts.holes ?? 0) + 1)
    shapes.push({ kind: 'ellipse', cx: 0, cy, rx: 2.5, ry: 4 })
  }
  return drawing(shapes)
}

/** A closed loop seen edge-on — a band, a belt, a element. */
export function band(opts: { ry: number; width: number }): Drawing {
  const half = opts.width / 2
  return drawing([
    { kind: 'ellipse', cx: -half, cy: 0, rx: 4, ry: opts.ry },
    { kind: 'ellipse', cx: half, cy: 0, rx: 4, ry: opts.ry },
    { kind: 'line', x1: -half, y1: -opts.ry, x2: half, y2: -opts.ry },
    { kind: 'line', x1: -half, y1: opts.ry, x2: half, y2: opts.ry },
  ])
}

/** A coil, drawn as a run of arcs. Springs and balancers. */
export function coil(opts: { turns: number; ry: number; pitch: number }): Drawing {
  const span = ((opts.turns - 1) * opts.pitch) / 2
  let d = `M ${-span - 10} 0`
  for (let i = 0; i < opts.turns; i++) {
    const x = -span + i * opts.pitch
    d += ` C ${x - opts.pitch / 3} ${-opts.ry} ${x + opts.pitch / 3} ${-opts.ry} ${x + opts.pitch / 2} 0`
    d += ` C ${x + opts.pitch * 0.66} ${opts.ry} ${x + opts.pitch} ${opts.ry} ${x + opts.pitch} 0`
  }
  const maxX = span + opts.pitch
  return drawing(
    [{ kind: 'path', d }],
    [{ minX: -span - 10, minY: -opts.ry, maxX, maxY: opts.ry }],
  )
}

/**
 * A plug body. Three variants, and this is the one place shape genuinely
 * differs between voltage groups rather than only identity — plug bodies are a
 * published physical fact, not a spec claim.
 */
export function plug(kind: 'na' | 'eu' | 'hi'): Drawing {
  const body: Shape = { kind: 'rect', x: -18, y: -20, width: 30, height: 40, rx: kind === 'eu' ? 18 : 4 }
  const pins: Shape[] =
    kind === 'na'
      ? [
          { kind: 'line', x1: 12, y1: -10, x2: 34, y2: -10 },
          { kind: 'line', x1: 12, y1: 10, x2: 34, y2: 10 },
        ]
      : kind === 'eu'
        ? [
            { kind: 'line', x1: 12, y1: -8, x2: 32, y2: -8 },
            { kind: 'line', x1: 12, y1: 8, x2: 32, y2: 8 },
            { kind: 'ellipse', cx: 32, cy: -8, rx: 3, ry: 3 },
            { kind: 'ellipse', cx: 32, cy: 8, rx: 3, ry: 3 },
          ]
        : [
            { kind: 'line', x1: 12, y1: -13, x2: 36, y2: -13 },
            { kind: 'line', x1: 12, y1: 0, x2: 36, y2: 0 },
            { kind: 'line', x1: 12, y1: 13, x2: 36, y2: 13 },
          ]
  return drawing([body, ...pins, { kind: 'line', x1: -18, y1: 0, x2: -42, y2: 0 }])
}
