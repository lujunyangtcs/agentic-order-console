import type { ReactNode } from 'react'

/**
 * A section that introduces itself before it shows anything.
 *
 * Eyebrow, statement, one line of explanation, and the totals for whatever
 * follows pushed to the right — so the numbers sit in the header instead of
 * needing a strip of their own.
 */
export function SectionBand({
  eyebrow, title, description, stats, children,
}: {
  eyebrow: string
  title: string
  description: string
  stats: { label: string; value: string | number }[]
  children: ReactNode
}) {
  return (
    <section className="border-border bg-surface rounded-lg border p-5 lift">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-xl">
          <div className="text-accent-text eyebrow">
            {eyebrow}
          </div>
          <h2 className="text-foreground mt-1.5 text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
        </div>
        <dl className="flex gap-7">
          {stats.map((s) => (
            <div key={s.label} className="text-right">
              <dt className="text-muted-foreground eyebrow">
                {s.label}
              </dt>
              <dd className="text-foreground tabular mt-1 text-2xl leading-none font-semibold">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      {children}
    </section>
  )
}
