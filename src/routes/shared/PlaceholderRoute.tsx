import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { useT, type I18nKey } from '@/i18n'

/**
 * A titled, empty page. Every route renders one of these until its phase
 * fills it in — a real header, a real empty state, no "coming soon" copy.
 */
export function PlaceholderRoute({ titleKey, descKey }: { titleKey: I18nKey; descKey?: I18nKey }) {
  const t = useT()
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t(titleKey)}
        description={descKey ? t(descKey) : undefined}
        stats={[{ label: t('common.entries'), value: 0 }]}
      />
      <EmptyState title={t('common.empty')} />
    </div>
  )
}
