import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/services'
import { SYSTEMS } from '@/app/product'
import { useActor } from '@/app/useActor'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * The round trip to the system of record.
 *
 * Three checks, two stages, one number back. The console does not create
 * orders — it hands the request over and takes the order number that comes
 * back, which is the boundary the whole product sits on.
 */
export function SendToErpDialog({
  orderId, open, onOpenChange, terminalName,
}: {
  orderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  terminalName: string
}) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [stage, setStage] = useState<'idle' | 'validating' | 'sending' | 'done'>('idle')
  const [ref, setRef] = useState<string>('')

  useEffect(() => {
    if (!open) {
      setStage('idle')
      setRef('')
    }
  }, [open])

  const create = useMutation({
    mutationFn: () => api.orders.createInErp(orderId, actor),
    onSuccess: (res) => {
      setRef(res.audit[0]?.externalReference ?? res.documents[0]?.reference ?? '')
      setStage('done')
      qc.invalidateQueries()
    },
  })

  function run() {
    setStage('validating')
    window.setTimeout(() => {
      setStage('sending')
      window.setTimeout(() => create.mutate(), 900)
    }, 700)
  }

  const checks = [
    t('erp.check.customer', { erp: SYSTEMS.erp }),
    t('erp.check.shipTo'),
    t('erp.check.product', { terminal: terminalName }),
    t('erp.check.window'),
  ]
  const checksDone = stage !== 'idle' && stage !== 'validating'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="erp">
        <DialogHeader>
          <DialogTitle>{t('erp.title', { orders: SYSTEMS.orders, erp: SYSTEMS.erp })}</DialogTitle>
          <DialogDescription>{t('erp.desc')}</DialogDescription>
        </DialogHeader>

        <ul className="border-border divide-border divide-y rounded-md border">
          {checks.map((c, i) => {
            const state = stage === 'idle' ? 'pending' : stage === 'validating' && i >= 2 ? 'running' : 'pass'
            return (
              <li key={c} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                {state === 'pass' ? (
                  <Check className="text-verdict-pass size-3.5 shrink-0" aria-hidden />
                ) : state === 'running' ? (
                  <Loader2 className="text-accent-text size-3.5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <span className="border-structural-border size-3.5 shrink-0 rounded-full border" aria-hidden />
                )}
                <span className={cn(state === 'pending' && 'text-muted-foreground')}>{c}</span>
              </li>
            )
          })}
        </ul>

        <div className={cn('rounded-md px-4 py-3 text-xs', stage === 'done' ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')} aria-live="polite" data-erp-stage={stage}>
          {stage === 'idle' && <span>&nbsp;</span>}
          {stage === 'validating' && <span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t('erp.stage.validating')}</span>}
          {stage === 'sending' && <span className="flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t('erp.stage.sending', { erp: SYSTEMS.erp })}</span>}
          {stage === 'done' && (
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium"><Check className="size-3.5" aria-hidden />{t('erp.stage.done', { erp: SYSTEMS.erp, ref })}</span>
              <span className="text-verdict-pass/80">{t('erp.done.body')}</span>
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {stage === 'done' ? (
            <Button onClick={() => onOpenChange(false)} data-erp-open>{t('erp.open')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stage !== 'idle'}>{t('common.cancel')}</Button>
              <Button onClick={run} disabled={stage !== 'idle' || !checksDone && stage !== 'idle'} data-erp-send>{t('erp.send')}</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
