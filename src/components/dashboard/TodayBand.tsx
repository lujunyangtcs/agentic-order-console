import { Link } from 'react-router'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { DailyRead } from './DailyRead'
import type { Severity } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useT, type I18nKey } from '@/i18n'

const DOT: Record<Severity, string> = {
  critical: 'bg-sev-critical',
  high: 'bg-sev-high',
  medium: 'bg-sev-medium',
  info: 'bg-sev-info',
}

/**
 * The only loud thing on the page.
 *
 * A reviewer opening this product has exactly one question, and it is not "how
 * many documents arrived this quarter". Everything below this band is context
 * for a decision that is stated here, once, in the largest type on the screen.
 */
export interface HeroMetric {
  label: string
  value: string | number
  tone?: 'default' | 'attention'
}

export function TodayBand({
  title, subtitle, waiting, unit, headline, severities, sentence, primaryTo, secondaryTo, metrics, primaryLabel, secondaryLabel, metricsLabel,
}: {
  /* The page title lives inside the banner. A separate heading above it would
     be a second band of mostly-empty background saying the same thing. */
  title: string
  subtitle: string
  waiting: number
  /** Pack word for what is waiting, already pluralised by the caller. */
  unit: string
  /** Full headline after the figure; replaces the "need a decision" default. */
  headline?: string
  primaryLabel?: string
  secondaryLabel?: string
  metricsLabel?: string
  severities: { severity: Severity; count: number }[]
  sentence: string | null
  primaryTo: string | null
  secondaryTo: string
  /** The standing rates, off to the side. They frame the decision; they are
   *  not the decision, so they never take the largest type. */
  metrics: HeroMetric[]
}) {
  const clear = waiting === 0
  const t = useT()

  return (
    <section
      aria-labelledby="today-heading"
      data-tour="today-band"
      className="border-ai-border ai-surface rounded-xl border px-5 py-5"
    >
      {/* The rail and the top bar already say where you are and which pack is
          active, so the title is kept for the heading outline and screen
          readers only — printing it again just pushed the decision down. */}
      <h1 id="today-heading" className="sr-only">
        {title} — {subtitle}
      </h1>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-5 lg:flex-nowrap">
        <div className="min-w-0 flex-1">
          {clear ? (
            <p className="text-foreground flex items-center gap-2 text-lg font-medium">
              <CheckCircle2 className="text-verdict-pass size-5" aria-hidden />
              {t('band.clear')}
            </p>
          ) : (
            <>
              <p className="flex items-baseline gap-2.5">
                <span className="text-foreground figure tabular text-[2.75rem] leading-none font-medium">
                  {waiting}
                </span>
                <span className="text-foreground text-lg font-medium">
                  {headline ?? t(waiting === 1 ? 'band.needsOne' : 'band.needsMany', { unit })}
                </span>
              </p>

              {severities.some((s) => s.count > 0) && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-ai-muted text-xs">{t('band.findings')}</span>
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {severities
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <li key={s.severity} className="text-ai-muted flex items-center gap-1.5 text-xs">
                        <span className={cn('size-1.5 rounded-full', DOT[s.severity])} aria-hidden />
                        <span className="text-foreground tabular font-medium">{s.count}</span>
                        {t(`severity.${s.severity}` as I18nKey).toLowerCase()}
                      </li>
                    ))}
                </ul>
              </div>}
            </>
          )}

          {sentence && <DailyRead sentence={sentence} />}

          {/* Set apart from the sentence above it. The read is a statement; these
              are what you do about it, and they should not look like the next
              line of the paragraph. */}
          <div className="mt-8 flex flex-wrap gap-2">
            {primaryTo && (
              /* Marked the way the other decision pages mark theirs. §21 wants
                 exactly one dominant CTA per decision page, and an acceptance
                 criterion that is checked by attribute has to be carried by
                 every page that claims it — this one was the dominant control
                 visually while being invisible to the check. */
              <Button asChild data-variant="primary">
                <Link to={primaryTo}>
                  {primaryLabel ?? t('band.first')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to={secondaryTo}>{secondaryLabel ?? (clear ? t('band.openQueue') : t('band.seeAll', { n: waiting }))}</Link>
            </Button>
          </div>
        </div>

        {/* Solid, not translucent. §10.5 rules out glass, and a 70% white over
            the analysis tint is glass by another name — it also made the panel
            unmeasurable, because Tailwind emits an oklab() for an alpha-modified
            colour and a naive contrast check reads that as near-black. */}
        <dl className="border-ai-border bg-surface w-full shrink-0 divide-y divide-border rounded-lg border lg:w-72">
          <div className="text-muted-foreground px-3.5 py-2 eyebrow">
            {metricsLabel ?? t('band.stands')}
          </div>
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center justify-between gap-3 px-3.5 py-2">
              <dt className="text-ai-muted min-w-0 truncate text-xs">{m.label}</dt>
              <dd
                className={cn(
                  'tabular shrink-0 text-sm font-semibold',
                  /* The amber from the severity ramp is tuned for glyphs; as
                     13px text it measures 3.0:1. The darker on-tint amber
                     clears 4.5 on both white and the wash. */
                  m.tone === 'attention' ? 'text-sev-high-on-bg' : 'text-foreground',
                )}
              >
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
