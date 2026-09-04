import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, FileUp, Truck } from 'lucide-react'
import { api } from '@/services'
import type { WorklistRow } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { StatusChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { UploadBolDialog } from '@/components/pod/UploadBolDialog'
import { useAuth } from '@/app/auth'
import { useActor } from '@/app/useActor'
import { nextStatus, statusIndex } from '@/types/domain'
import { formatTime } from '@/fixtures/calendar'
import { productKey, statusKey, useT } from '@/i18n'

/**
 * The carrier's loads. Each card leads to the order page, where the rail is
 * the control; the two moves the carrier owns from this page are recording
 * the next status and uploading the signed bill of lading.
 */
export function LoadsRoute() {
  const t = useT()
  const { session } = useAuth()
  const actor = useActor()
  const qc = useQueryClient()
  const carrierId = session?.carrierId ?? ''
  const [uploadFor, setUploadFor] = useState<WorklistRow | null>(null)

  const loads = useQuery({ queryKey: ['loads', carrierId], queryFn: () => api.carrier.loads(carrierId) })
  const advance = useMutation({
    mutationFn: (row: WorklistRow) => api.tracking.advance(row.id, nextStatus(row.status)!, actor),
    onSuccess: (res) => {
      if (res.event) toast.success(t(statusKey(res.event.status)))
      qc.invalidateQueries()
    },
  })

  const rows = loads.data ?? []
  const active = rows.filter((r) => r.status !== 'delivery_completed')
  const delivered = rows.filter((r) => r.status === 'delivery_completed')

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.loads.title')}
        description={t('page.loads.desc')}
        stats={[
          { label: t('inbox.kpi.loads'), value: active.length },
          { label: t('loads.delivered'), value: delivered.length, tone: 'good' },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={t('loads.empty')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
          {rows.map((r) => {
            const nxt = nextStatus(r.status)
            const carrierMove = nxt && ['transit_to_terminal', 'starting_load', 'in_transit', 'on_site', 'unloading', 'unload_completed'].includes(nxt)
            const canUpload = statusIndex(r.status) >= statusIndex('unload_completed')
            return (
              <li key={r.id} className="h-full">
                <article data-load={r.id} className="border-structural-border bg-surface flex h-full flex-col rounded-lg border p-4 lift">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-muted-foreground eyebrow">{r.terminalName} → {r.shipToCity}</p>
                      <Link to={`/orders/${r.id}`} className="mt-0.5 block font-mono text-sm font-semibold hover:underline">{r.erpRef}</Link>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  <dl className="mt-3 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.customer')}</dt><dd className="truncate font-medium">{r.customerName}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.product')}</dt><dd>{r.tonnes} t {t(productKey(r.product))}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.window')}</dt><dd className="tabular">{formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.eta')}</dt><dd className="tabular">{r.eta ? formatTime(r.eta) : '—'}</dd></div>
                  </dl>
                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    {carrierMove && nxt && (
                      <Button size="sm" className="w-full" disabled={advance.isPending} onClick={() => advance.mutate(r)} data-advance-load={r.id} data-variant="primary">
                        <Truck className="size-3.5" aria-hidden />
                        {t('loads.next', { status: t(statusKey(nxt)) })}
                      </Button>
                    )}
                    {canUpload && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setUploadFor(r)} data-upload-load={r.id}>
                        <FileUp className="size-3.5" aria-hidden />
                        {t('loads.uploadBol')}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost" className="w-full">
                      <Link to={`/orders/${r.id}`}>{t('common.open')}<ArrowRight className="size-3.5" aria-hidden /></Link>
                    </Button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      <UploadBolDialog order={uploadFor} onOpenChange={(o) => !o && setUploadFor(null)} />
    </div>
  )
}
