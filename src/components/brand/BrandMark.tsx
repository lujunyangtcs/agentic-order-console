import { cn } from '@/lib/utils'

/**
 * The application mark: drawn, not loaded, so it inherits `currentColor` and
 * is obviously a product mark rather than anyone's logo. Three stacked
 * route segments and a moving point — the thing the console watches.
 */
export function BrandMark({
  className,
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
        <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" strokeWidth="1.75" />
        <path d="M6 16.5h12M6 12h8M6 7.5h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="17" cy="7.5" r="1.75" fill="currentColor" />
      </svg>
    </span>
  )
}

/** The mark beside the product name, for the sign-in card. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark className="size-7" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">Order Console</span>
        <span className="text-[0.625rem] tracking-[0.14em] opacity-70">AGENTIC ORDER MANAGEMENT</span>
      </span>
    </span>
  )
}
