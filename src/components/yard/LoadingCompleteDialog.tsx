import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronRight, FileText, Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineSpinner } from '@/components/state/States'
import { api } from '@/services'
import type { OrderDocument, YardRow } from '@/services'
import { DocumentDialog } from '@/components/documents/DocumentDialog'
import { useActor } from '@/app/useActor'
import { SYSTEMS } from '@/app/product'
import { productKey, useT } from '@/i18n'

/**
 * Loading is done. The scale prints the bill of lading — that part belongs to
 * the terminal system, not to this console — and the console records the
 * milestone with the document reference that came back.
 *
 * The short "printing" pause is the round trip to the scale, shown honestly
 * as a wait rather than as a spinner that never ends.
 */
export function LoadingCompleteDialog({ row, onOpenChange }: { row: YardRow | null; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [phase, setPhase] = useState<'confirm' | 'printing' | 'printed'>('confirm')
  const [bolDoc, setBolDoc] = useState<OrderDocument | null>(null)
  const [viewing, setViewing] = useState(false)
  const bol = row ? `BOL-${row.erpRef.slice(-5)}` : ''

  useEffect(() => {
    if (row) {
      setPhase('confirm')
      setBolDoc(null)
      setViewing(false)
    }
  }, [row])

  const complete = useMutation({
    mutationFn: async () => {
      setPhase('printing')
      await new Promise((r) => setTimeout(r, 900))
      return api.tracking.advance(row!.orderId, 'load_completed', actor)
    },
    onSuccess: async (res) => {
      setPhase('printed')
      // The paper the scale just printed, so the presenter can open it here.
      const fromResult = res.documents.find((x) => x.kind === 'bol') ?? null
      if (fromResult) setBolDoc(fromResult)
      else {
        const d = await api.orders.detail(row!.orderId)
        setBolDoc(d?.documents.find((x) => x.kind === 'bol') ?? null)
      }
      toast.success(t('yard.done', { bol }))
      qc.invalidateQueries()
    },
  })

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="loading-complete" data-phase={phase}>
        <DialogHeader>
          <DialogTitle>{t('yard.complete.title')}</DialogTitle>
          <DialogDescription>{row ? t('yard.complete.desc', { order: row.erpRef, truck: row.truckPlate }) : ''}</DialogDescription>
        </DialogHeader>
        {row && (
          <dl className="bg-muted grid gap-1.5 rounded-md px-3 py-2.5 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.customer')}</dt><dd className="font-medium">{row.customerName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.product')}</dt><dd className="font-medium">{row.tonnes} t {t(productKey(row.product))}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.carrier')}</dt><dd className="font-medium">{row.carrierName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('yard.bay')}</dt><dd className="font-medium">{row.bay ?? '—'}</dd></div>
          </dl>
        )}
        {phase === 'printing' && <InlineSpinner label={t('yard.printing', { system: SYSTEMS.scale })} />}
        {phase === 'printed' && (
          <button type="button" onClick={() => bolDoc && setViewing(true)} disabled={!bolDoc} className="border-verdict-pass bg-verdict-pass-bg hover:bg-verdict-pass/15 flex w-full items-start gap-2 rounded-md border px-3 py-2.5 text-left text-xs transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none" data-printed data-yard-open-bol>
            <FileText className="text-verdict-pass mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t('yard.printed', { bol })}</span>
              <span className="text-muted-foreground block">{t('yard.printedBody', { system: SYSTEMS.scale })}</span>
              <span className="text-accent-text mt-1 block font-medium">{t('yard.openBol')}</span>
            </span>
            <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
          </button>
        )}
        <div className="flex justify-end gap-2">
          {phase === 'printed' ? (
            <Button onClick={() => onOpenChange(false)} data-yard-close><Check className="size-3.5" aria-hidden />{t('common.close')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={phase === 'printing'}>{t('common.cancel')}</Button>
              <Button disabled={phase === 'printing'} onClick={() => complete.mutate()} data-yard-confirm data-variant="primary">
                <Printer className="size-3.5" aria-hidden />{t('yard.complete.confirm')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
      {row && <DocumentDialog orderId={row.orderId} doc={viewing ? bolDoc : null} onOpenChange={(o) => !o && setViewing(false)} />}
    </Dialog>
  )
}
