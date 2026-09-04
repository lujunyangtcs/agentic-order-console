import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services'
import { PodDocumentView } from '@/components/pod/PodDocumentView'
import { EmptyState } from '@/components/state/States'
import { useT } from '@/i18n'

/** The proof of delivery on its own page: for the stakeholder who only
 *  needs the document, and for a deep link from an email. */
export function EpodRoute() {
  const { orderId = '' } = useParams()
  const t = useT()
  const detail = useQuery({ queryKey: ['order', orderId], queryFn: () => api.orders.detail(orderId) })
  const d = detail.data

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      {detail.isLoading ? (
        <div className="bg-surface h-64 animate-pulse rounded-lg" />
      ) : !d || !d.pod ? (
        <EmptyState title={t('epod.none')} description={t('epod.noneDesc')} />
      ) : (
        <PodDocumentView order={d} />
      )}
    </div>
  )
}
