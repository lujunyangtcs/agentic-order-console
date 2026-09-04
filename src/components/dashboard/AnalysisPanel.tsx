import { Link } from 'react-router'
import { Boxes, PauseCircle, PenLine, Sparkle, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AnalysisSentence, Observation } from '@/services'
import { cn } from '@/lib/utils'

/**
 * What the account's own numbers say, as cards rather than paragraphs.
 *
 * This was four dense sentences in a bulleted list. Nobody reads four dense
 * sentences: the figure carrying each one is buried mid-clause, every item is
 * the same shape as every other, and there is nothing for the eye to land on —
 * so the panel with the product's best material in it was the panel a viewer
 * skipped.
 *
 * A card gives the same content a reading order — how big, of what, on what
 * basis — and lets the figure be the size of its importance. The prose is not
 * lost; it is the evidence line under the rule, for the reader who wants it.
 *
 * The two halves the panel used to have are still deliberately separate. The
 * cards are arithmetic over this account's own data, so every one can be
 * checked against a screen. Written analysis stays labelled as absent rather
 * than mocked up, because a placeholder that reads like a real analysis is the
 * one thing that would make a reviewer distrust the cards above it.
 *
 * ## The rail scrolls
 *
 * Four cards sit open at 1440 and scroll below it. They are sized to fit that
 * width exactly rather than to a round number — a rail that overflows by
 * fourteen pixels reads as a rendering fault, not as an invitation to scroll.
 *
 * §19.3 governs the containment: the rail scrolls inside itself, contains its
 * overscroll, and the page never gains horizontal overflow.
 *
 * The rail carries its own top padding, and that is not decoration. Setting
 * `overflow-x: auto` computes `overflow-y` to `auto` as well, so the container
 * clips vertically too — with the cards flush against its top edge, the hover
 * lift's 2px rise and the upward half of its shadow were cut off along a hard
 * line. The gap below the header is the same as it was; it simply lives inside
 * the scroll container now, where the shadow has room to render.
 */

const ICON: Record<Observation['tone'], LucideIcon> = {
  act: Truck,
  watch: Boxes,
  held: PauseCircle,
}

const CHIP: Record<Observation['tone'], { label: string; className: string }> = {
  act: { label: 'Act now', className: 'bg-sev-critical-bg text-sev-critical-on-bg' },
  watch: { label: 'Watch', className: 'bg-sev-high-bg text-sev-high-on-bg' },
  /* Not a failure state. A withheld recommendation is the product working. */
  held: { label: 'Held', className: 'bg-muted text-muted-foreground' },
}

export interface AnalysisCopy {
  title: string
  subtitle: string
  empty: string
  written: string
  chip: string
  foot: string
  toneLabels: Record<Observation['tone'], string>
}

export function AnalysisPanel({ observations, analysis, copy }: {
  observations: Observation[]
  analysis: AnalysisSentence[]
  copy: AnalysisCopy
}) {
  return (
    <section
      data-card="analysis"
      className="border-structural-border bg-surface flex flex-col rounded-lg border"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 pt-4 pb-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkle className="text-accent-text size-4" aria-hidden />
          {copy.title}
        </h2>
        <p className="text-muted-foreground text-xs">{copy.subtitle}</p>
      </header>

      {observations.length === 0 ? (
        <p className="text-muted-foreground px-5 pb-5 text-sm">{copy.empty}</p>
      ) : (
        <div
          data-x-scroll="analysis-rail"
          className="flex gap-3 overflow-x-auto overscroll-x-contain px-5 pt-2.5 pb-4"
        >
          {observations.map((o) => (
            <ObservationCard key={o.key} observation={o} toneLabel={copy.toneLabels[o.tone]} />
          ))}
        </div>
      )}

      <div className="border-border bg-muted/30 mx-5 mb-5 rounded-md border px-4 py-3.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <PenLine className="size-3.5" aria-hidden />
          {copy.written}
          <span className="border-border bg-surface text-muted-foreground ml-auto rounded-full border px-1.5 py-0.5 text-2xs">
            {copy.chip}
          </span>
        </div>

        <div className="text-foreground mt-2.5 flex flex-col gap-1.5 text-sm leading-relaxed">
          {analysis.map((a) => (
            <Sentence key={a.key} sentence={a} />
          ))}
        </div>

        <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-2xs leading-snug">{copy.foot}</p>
      </div>
    </section>
  )
}

function ObservationCard({ observation: o, toneLabel }: { observation: Observation; toneLabel: string }) {
  const Icon = ICON[o.tone]
  const chip = { className: CHIP[o.tone].className, label: toneLabel }

  return (
    <Link
      to={o.href}
      data-observation={o.key}
      className={cn(
        'border-structural-border bg-background focus-visible:ring-ring flex',
        'w-[16.25rem] shrink-0 flex-col rounded-lg border p-4',
        /* The house hover, not a bespoke one: border darkens, a small shadow
           appears, the card rises 2px — and `lift` already drops the rise
           under reduced motion, which a one-off would have forgotten. */
        'lift lift-link focus-visible:ring-2 focus-visible:outline-none',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="border-border bg-surface flex size-8 items-center justify-center rounded-md border">
          <Icon className="text-muted-foreground size-4" aria-hidden />
        </span>
        <span className={cn('rounded-xs px-2 py-0.5 text-2xs font-medium', chip.className)}>
          {chip.label}
        </span>
      </div>

      <p className="text-muted-foreground eyebrow mt-3.5">{o.eyebrow}</p>
      <p className="text-foreground mt-1 text-sm leading-snug font-medium">{o.title}</p>

      {/* The figure is the size of its importance, and it never appears without
          its unit — a bare number is not a fact. */}
      <p className="text-foreground figure tabular mt-auto pt-4 text-2xl leading-none font-medium">
        {o.figure}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{o.unit}</p>

      {/* No hover arrow. One was floated in the top-right and landed on top of
          the status chip. The card answers the pointer as a whole instead —
          which is the honest affordance, since the whole card is the link. */}
      <p className="border-border text-muted-foreground mt-3 border-t pt-2.5 text-2xs leading-relaxed">
        {o.meta}
      </p>
    </Link>
  )
}

/**
 * One sentence, with its source inside it.
 *
 * The link is a span of the sentence rather than a trailing "view" — a
 * citation reads as part of the claim, and a row of identical trailing links
 * teaches the reader to ignore all of them. `linkText` has to appear in `text`
 * verbatim; if it ever does not, the sentence still renders in full and simply
 * carries no link, which is the safe failure.
 */
function Sentence({ sentence: a }: { sentence: AnalysisSentence }) {
  const at = a.text.indexOf(a.linkText)
  if (at === -1) return <p>{a.text}</p>

  return (
    <p>
      {a.text.slice(0, at)}
      <Link
        to={a.href}
        className="text-accent-text hover:text-accent decoration-accent/40 rounded-xs underline underline-offset-2"
      >
        {a.linkText}
      </Link>
      {a.text.slice(at + a.linkText.length)}
    </p>
  )
}
