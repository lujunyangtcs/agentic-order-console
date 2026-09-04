import { useLang, type Lang } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * English / French, as a two-segment control.
 *
 * The switch takes effect immediately on every rendered string; data values
 * (names, addresses, notes) are not translated and do not change.
 */
export function LangToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { lang, setLang, t } = useLang()
  const options: Lang[] = ['en', 'fr']
  return (
    <div
      role="radiogroup"
      aria-label={t('chrome.language')}
      className={cn('border-border bg-background inline-flex shrink-0 rounded-md border p-0.5', className)}
    >
      {options.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          data-lang-option={l}
          onClick={() => setLang(l)}
          className={cn(
            'rounded-xs font-medium uppercase transition-colors duration-150 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            compact ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-2xs',
            lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
