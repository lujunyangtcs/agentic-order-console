import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/services'
import { SHIP_TOS } from '@/fixtures/network'
import { ahead } from '@/fixtures/calendar'
import type { Product } from '@/types/domain'
import { productKey, useT } from '@/i18n'

const PRODUCTS: Product[] = ['GU', 'HE', 'GUL', 'MS']

/**
 * A customer asks for cement.
 *
 * This is a request, not an order: it lands on the desk's worklist, the desk
 * sends it to the system of record, and the order number comes back from
 * there. The form only captures what the desk would otherwise take by phone.
 */
export function RaiseOrderDialog({ customerId, open, onOpenChange }: { customerId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const sites = SHIP_TOS.filter((s) => s.customerId === customerId)
  const [shipToId, setShipToId] = useState(sites[0]?.id ?? '')
  const [product, setProduct] = useState<Product>('GU')
  const [tonnes, setTonnes] = useState('34')
  const [startIn, setStartIn] = useState('360')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setShipToId(sites[0]?.id ?? '')
      setProduct('GU')
      setTonnes('34')
      setStartIn('360')
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customerId])

  const raise = useMutation({
    mutationFn: () => api.orders.raiseRequest({
      customerId, shipToId, product, tonnes: Number(tonnes) || 34,
      windowStart: ahead(Number(startIn)), windowEnd: ahead(Number(startIn) + 240), note: note.trim(),
    }),
    onSuccess: (row) => {
      toast.success(t('raise.done', { id: row.id }))
      qc.invalidateQueries()
      onOpenChange(false)
      navigate(`/orders/${row.id}`)
    },
  })

  const selectClass = 'border-border bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="raise">
        <DialogHeader>
          <DialogTitle>{t('raise.title')}</DialogTitle>
          <DialogDescription>{t('raise.desc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('raise.shipTo')}</span>
            <select value={shipToId} onChange={(e) => setShipToId(e.target.value)} className={selectClass} data-raise-shipto>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.city}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('raise.product')}</span>
              <select value={product} onChange={(e) => setProduct(e.target.value as Product)} className={selectClass} data-raise-product>
                {PRODUCTS.map((p) => <option key={p} value={p}>{t(productKey(p))}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('raise.tonnes')}</span>
              <input type="number" min="20" max="40" step="2" value={tonnes} onChange={(e) => setTonnes(e.target.value)} className={selectClass} data-raise-tonnes />
            </label>
          </div>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('raise.window')}</span>
            <select value={startIn} onChange={(e) => setStartIn(e.target.value)} className={selectClass} data-raise-window>
              <option value="240">{t('raise.window.4h')}</option>
              <option value="360">{t('raise.window.6h')}</option>
              <option value="1440">{t('raise.window.tomorrow')}</option>
              <option value="2880">{t('raise.window.2days')}</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('raise.note')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('raise.notePlaceholder')} className="border-border bg-background w-full rounded-md border px-2 py-1.5 text-sm" data-raise-note />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={raise.isPending || !shipToId} onClick={() => raise.mutate()} data-raise-send data-variant="primary">
            <Send className="size-3.5" aria-hidden />{t('raise.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
