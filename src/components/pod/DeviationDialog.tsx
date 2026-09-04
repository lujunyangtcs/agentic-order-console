import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, CircleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/services'
import { useActor } from '@/app/useActor'
import type { DeviationKind } from '@/types/domain'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const KINDS: DeviationKind[] = ['wrong_product', 'short_quantity', 'excess_quantity', 'handover_issue']

/** A problem at the point of delivery, reported by whoever is standing there. */
export function DeviationDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [kind, setKind] = useState<DeviationKind>('short_quantity')
  const [qty, setQty] = useState('1.2')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setKind('short_quantity')
      setQty('1.2')
      setNote('')
    }
  }, [open])

  const file = useMutation({
    mutationFn: () => api.pod.fileDeviation(orderId, {
      kind,
      qtyDelta: kind === 'short_quantity' ? -Math.abs(Number(qty) || 0) : kind === 'excess_quantity' ? Math.abs(Number(qty) || 0) : null,
      note: note.trim() || t(`deviation.default.${kind}` as I18nKey),
    }, actor),
    onSuccess: () => {
      toast.success(t('deviation.done'))
      qc.invalidateQueries()
      onOpenChange(false)
    },
  })

  const needsQty = kind === 'short_quantity' || kind === 'excess_quantity'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="deviation">
        <DialogHeader>
          <DialogTitle>{t('deviation.title')}</DialogTitle>
          <DialogDescription>{t('deviation.desc')}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t('deviation.kind')} className="grid gap-1.5 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} data-deviation-kind={k} onClick={() => setKind(k)} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors', kind === k ? 'border-accent bg-muted' : 'border-border hover:bg-hover-tint')}>
              <CircleAlert className={cn('size-3.5 shrink-0', kind === k ? 'text-accent-text' : 'text-muted-foreground')} aria-hidden />
              {t(`deviation.kind.${k}` as I18nKey)}
            </button>
          ))}
        </div>
        {needsQty && (
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('deviation.qty')}</span>
            <input type="number" step="0.1" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="border-border bg-background h-9 w-32 rounded-md border px-2 text-sm" data-deviation-qty />
          </label>
        )}
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t('deviation.note')}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t(`deviation.default.${kind}` as I18nKey)} className="border-border bg-background w-full rounded-md border px-2 py-1.5 text-sm" data-deviation-note />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={file.isPending} onClick={() => file.mutate()} data-deviation-send>
            <Check className="size-3.5" aria-hidden />{t('deviation.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
