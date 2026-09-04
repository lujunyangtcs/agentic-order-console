import {
  disc, bearingPair, housing, stack, plate, band, coil, plug,
  type Drawing,
} from '@/lib/assembly/geometry'

/**
 * Twenty-one drawings, for twelve configurations.
 *
 * The naive count is seventeen stations times twelve configurations, or two
 * hundred and four hand-drawn parts. That is not what a configure-to-order
 * machine is. A 460 V contactor and a 220 V contactor look the same in line
 * art, and drawing them differently would invent a distinction the source
 * cannot support — the fidelity rules are explicit that geometry is not to be
 * inferred.
 *
 * So the rule is: **shape varies only where the difference is a physical fact;
 * everything else varies by identity.** Two places qualify.
 *
 * Cord sets, because plug bodies genuinely differ by voltage group — three
 * drawings. And the high-speed gearbox, which replaces the speed drive on the
 * two high-speed rows and is a different object, not a differently-labelled
 * one.
 *
 * That comes to nineteen, not the twenty-one a first count suggests — the
 * upper and lower element wheels are the same wheel, and stations that share a
 * drawing cost nothing. Everything else is a part number and a status overlay
 * on the same geometry.
 *
 * The build gate enforces this as a ceiling derived from the station table
 * rather than as a fixed number, so adding a station raises the budget by one
 * and adding a *shape* where an identity would have done still fails.
 */

export const BLUEPRINTS: Record<string, Drawing> = {
  /* 1 · guide yoke — a plate with a fork at the element line */
  'guide-yoke': (() => {
    const d = plate({ height: 96, thickness: 14, holes: 2 })
    return {
      shapes: [
        ...d.shapes,
        { kind: 'line', x1: 7, y1: -34, x2: 30, y2: -34 },
        { kind: 'line', x1: 7, y1: 34, x2: 30, y2: 34 },
        { kind: 'ellipse', cx: 30, cy: 0, rx: 5, ry: 36 },
      ],
      bbox: { ...d.bbox, maxX: 35, minY: -48, maxY: 48 },
    }
  })(),

  /* 2 & 4 · element wheel — a large disc with a tyre face and a bore */
  'element-wheel': disc({ ry: 62, thickness: 9, bore: 16 }),

  /* 3 · the element itself — a closed band seen edge-on */
  'element-band': band({ ry: 58, width: 26 }),

  /* 5 · wheel bearings — always a pair */
  'wheel-bearing': bearingPair({ ry: 30, gap: 26 }),

  /* 6 · drive motor — body, terminal box, output shaft */
  'drive-motor': housing({ width: 88, height: 92, shaft: 46, terminal: true }),

  /* 7 · pulley and belt */
  'pulley-belt': (() => {
    const p = disc({ ry: 34, thickness: 7, bore: 9 })
    const b = band({ ry: 30, width: 62 })
    return {
      shapes: [...p.shapes, ...b.shapes.map((s) => shiftX(s, 44))],
      bbox: { minX: p.bbox.minX, minY: -34, maxX: 44 + 31 + 4, maxY: 34 },
    }
  })(),

  /* 8 · speed drive — a cabinet with a vent stack */
  'drive-unit': (() => {
    const h = housing({ width: 64, height: 84 })
    return {
      shapes: [
        ...h.shapes,
        { kind: 'line', x1: -20, y1: -26, x2: 20, y2: -26 },
        { kind: 'line', x1: -20, y1: -14, x2: 20, y2: -14 },
        { kind: 'line', x1: -20, y1: -2, x2: 20, y2: -2 },
      ],
      bbox: h.bbox,
    }
  })(),

  /* 8b · high-speed gearbox — the one configuration-driven shape change */
  'gearbox-hs': (() => {
    const h = housing({ width: 74, height: 70, shaft: 30 })
    const g = disc({ ry: 26, thickness: 6, bore: 7 })
    return {
      shapes: [...h.shapes, ...g.shapes.map((s) => shiftX(s, -50))],
      bbox: { minX: -50 - 12, minY: -35, maxX: h.bbox.maxX, maxY: 35 },
    }
  })(),

  /* 9 · transformer — a laminated core block */
  'transformer': (() => {
    const h = housing({ width: 70, height: 76 })
    return {
      shapes: [
        ...h.shapes,
        { kind: 'rect', x: -22, y: -30, width: 44, height: 60, rx: 2 },
      ],
      bbox: h.bbox,
    }
  })(),

  /* 10 · contactor */
  'contactor': housing({ width: 44, height: 56, terminal: true }),

  /* 11 · fuse set — a bank on a common rail */
  'fuse-set': stack({ count: 3, ry: 22, pitch: 24 }),

  /* 12 · control board — a plate with components */
  'control-board': (() => {
    const p = plate({ height: 88, thickness: 8, holes: 4 })
    return {
      shapes: [
        ...p.shapes,
        { kind: 'rect', x: 4, y: -30, width: 16, height: 18, rx: 1 },
        { kind: 'rect', x: 4, y: 6, width: 16, height: 24, rx: 1 },
      ],
      bbox: { ...p.bbox, maxX: 20 },
    }
  })(),

  /* 13 · wiring harness — a bundle with a break-out */
  'harness': {
    shapes: [
      { kind: 'path', d: 'M -46 0 C -20 -24 14 -24 40 -6' },
      { kind: 'path', d: 'M -46 6 C -20 -14 14 -14 40 4' },
      { kind: 'path', d: 'M -46 12 C -18 -2 12 8 40 16' },
      { kind: 'ellipse', cx: -46, cy: 6, rx: 5, ry: 12 },
      { kind: 'ellipse', cx: 40, cy: 5, rx: 5, ry: 14 },
    ],
    bbox: { minX: -51, minY: -24, maxX: 45, maxY: 24 },
  },

  /* 14 · process heater — an element in a sleeve */
  'heater': (() => {
    const c = coil({ turns: 4, ry: 16, pitch: 22 })
    return {
      shapes: [
        { kind: 'rect', x: -56, y: -26, width: 112, height: 52, rx: 6 },
        ...c.shapes,
      ],
      bbox: { minX: -56, minY: -26, maxX: 56, maxY: 26 },
    }
  })(),

  /* 15 · cord sets — three real shapes, one per voltage group */
  'cordset-na': plug('na'),
  'cordset-eu': plug('eu'),
  'cordset-hi': plug('hi'),

  /* 16 · sensor pod */
  'sensor-pod': (() => {
    const h = housing({ width: 34, height: 40 })
    return {
      shapes: [
        ...h.shapes,
        { kind: 'ellipse', cx: 0, cy: 0, rx: 7, ry: 9 },
        { kind: 'line', x1: -17, y1: 0, x2: -40, y2: 0 },
      ],
      bbox: { minX: -40, minY: -20, maxX: h.bbox.maxX, maxY: 20 },
    }
  })(),

  /* 17 · tension spring and balancer */
  'spring-balancer': (() => {
    const c = coil({ turns: 5, ry: 22, pitch: 20 })
    return {
      shapes: [
        ...c.shapes,
        { kind: 'ellipse', cx: -62, cy: 0, rx: 6, ry: 10 },
        { kind: 'ellipse', cx: 62, cy: 0, rx: 6, ry: 10 },
      ],
      bbox: { minX: -68, minY: -22, maxX: 68, maxY: 22 },
    }
  })(),
}

/** Shift a shape along x, so a composed drawing can reuse a primitive. */
function shiftX(s: Drawing['shapes'][number], dx: number): Drawing['shapes'][number] {
  switch (s.kind) {
    case 'ellipse': return { ...s, cx: s.cx + dx }
    case 'rect': return { ...s, x: s.x + dx }
    case 'line': return { ...s, x1: s.x1 + dx, x2: s.x2 + dx }
    case 'path': return s
  }
}

export const BLUEPRINT_COUNT = Object.keys(BLUEPRINTS).length
