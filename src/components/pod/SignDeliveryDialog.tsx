import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, PenLine } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SignaturePad } from './SignaturePad'
import { api } from '@/services'
import type { OrderDetail } from '@/services'
import { useActor } from '@/app/useActor'
import { useT } from '@/i18n'

/**
 * Signing for the delivery.
 *
 * One name, one signature, one click. The signed bill of lading is created
 * the moment the button is pressed and is visible to the desk, the carrier
 * and the customer's own history from then on.
 */
export function SignDeliveryDialog({ order, open, onOpenChange, defaultName }: { order: OrderDetail; open: boolean; onOpenChange: (o: boolean) => void; defaultName: string }) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [name, setName] = useState(defaultName)
  const [png, setPng] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setPng(null)
    }
  }, [open, defaultName])

  const sign = useMutation({
    mutationFn: () => api.pod.sign(order.id, { signedBy: name.trim(), signaturePng: png! }, actor),
    onSuccess: (res) => {
      toast.success(t('sign.done', { bol: res.documents.find((d) => d.kind === 'signed_bol')?.reference ?? '' }))
      qc.invalidateQueries()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="sign">
        <DialogHeader>
          <DialogTitle>{t('sign.title')}</DialogTitle>
          <DialogDescription>{t('sign.desc', { order: order.erpRef, tonnes: order.tonnes })}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t('sign.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="border-border bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm" data-sign-name />
        </label>
        <SignaturePad onChange={setPng} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={!png || !name.trim() || sign.isPending} onClick={() => sign.mutate()} data-sign-confirm data-variant="primary">
            {sign.isPending ? <PenLine className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            {t('sign.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
