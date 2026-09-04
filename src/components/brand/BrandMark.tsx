import { cn } from '@/lib/utils'

/**
 * The application mark.
 *
 * Drawn rather than loaded. The original shipped a raster logo out of `public/`,
 * which is the right call when the artwork is real — re-tracing a logo into JSX
 * is how it quietly drifts from the brand. This reference build has no brand to
 * drift from, and a placeholder image file is a thing an integrator has to
 * remember to replace. A drawn mark inherits `currentColor`, sizes cleanly at
 * every scale, and is obviously a placeholder.
 *
 * Swap this component for your own artwork; nothing else imports the asset.
 */
export function BrandMark({
  className,
  /** A soft tile behind the mark, for surfaces where it needs separating. */
  tone = 'plain',
}: {
  className?: string
  tone?: 'plain' | 'tile'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        tone === 'tile' && 'rounded-md bg-white/10 p-1',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-full" aria-hidden>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="currentColor" strokeWidth="1.75" />
        {/* Three stacked positions — the thing this product actually reasons
            about — rather than a letterform that would read as a real brand. */}
        <path
          d="M6.75 8.5h10.5M6.75 12h10.5M6.75 15.5h6"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

/** The mark beside the product name, for the rail head and the sign-in card. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark className="size-7" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">ABC</span>
        <span className="text-[0.625rem] tracking-[0.14em] opacity-70">
          INVENTORY INTELLIGENCE
        </span>
      </span>
    </span>
  )
}
