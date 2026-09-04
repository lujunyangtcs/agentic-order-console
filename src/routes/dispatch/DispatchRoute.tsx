import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Cable, Globe, Send } from 'lucide-react'
import { api } from '@/services'
import type { DispatchColumn } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { StatusChip } from '@/components/status/StatusChip'
import { useAuth } from '@/app/auth'
import { can } from '@/app/permissions'
import { Button } from '@/components/ui/button'
import { AssignCarrierDrawer } from '@/components/orders/AssignCarrierDrawer'
import { SYSTEMS } from '@/app/product'
import { formatTime } from '@/fixtures/calendar'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

type Load = DispatchColumn['loads'][number]

/**
 * One column per carrier, one card per load. A stalled request — sent, no
 * answer for 45 minutes — is the dispatcher's cue, and the reassign drawer
 * is the same one the desk uses, so the two never disagree.
 */
export function DispatchRoute() {
  const t = useT()
  const [reassign, setReassign] = useState<Load | null>(null)
  const { session } = useAuth()
  const canAssign = !!session && can(session.role, 'order.assign')
  const board = useQuery({ queryKey: ['dispatch'], queryFn: () => api.tracking.dispatchBoard() })
  const columns = board.data ?? []
  const loads = columns.reduce((n, c) => n + c.loads.length, 0)
  const stalled = columns.reduce((n, c) => n + c.loads.filter((l) => l.stalled).length, 0)

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.dispatch.title')}
        description={t('page.dispatch.desc')}
        stats={[
          { label: t('dispatch.stat.carriers'), value: columns.length },
          { label: t('dispatch.stat.loads'), value: loads },
          { label: t('dispatch.stat.stalled'), value: stalled, tone: stalled ? 'attention' : 'good' },
        ]}
      />

      {board.isLoading ? (
        <div className="bg-surface h-72 animate-pulse rounded-lg" />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [contain:inline-size] md:-mx-6 md:px-6">
          <div className="flex items-stretch gap-4">
            {columns.map((c) => (
              <section key={c.carrierId} data-dispatch-column={c.carrierId} className="border-structural-border bg-surface flex w-[290px] shrink-0 flex-col rounded-lg border">
                <header className="border-border border-b px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold">{c.carrierName}</h2>
                    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium', c.hasTms ? 'bg-muted text-muted-foreground' : 'bg-status-pending-bg text-sev-high-on-bg')}>
                      {c.hasTms ? <Cable className="size-3" aria-hidden /> : <Globe className="size-3" aria-hidden />}
                      {c.hasTms ? SYSTEMS.carrierTms : t('dispatch.portalOnly')}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-2xs">{t('dispatch.loadsOnTime', { n: c.loads.length, pct: Math.round(c.onTimePct * 100) })}</p>
                </header>
                <ul className="flex flex-1 flex-col gap-2 p-3">
                  {c.loads.map((l) => (
                    <li key={l.orderId} data-dispatch-load={l.orderId} data-stalled={l.stalled} className={cn('rounded-md border p-3', l.stalled ? 'border-sev-high/50 bg-sev-high-bg/40' : 'border-border')}>
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/orders/${l.orderId}`} className="text-accent-text font-mono text-xs font-semibold hover:underline">{l.erpRef}</Link>
                        <StatusChip status={l.status} />
                      </div>
                      <p className="mt-1 truncate text-xs">{l.customerName}</p>
                      <p className="text-muted-foreground text-2xs">{l.shipToCity} · {t('dispatch.by', { time: formatTime(l.windowEnd) })}</p>
                      {l.stalled && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sev-high-on-bg flex items-center gap-1 text-2xs font-medium"><AlertTriangle className="size-3" aria-hidden />{t('dispatch.stalled')}</span>
                          {canAssign && (
                            <Button size="sm" variant="outline" onClick={() => setReassign(l)} data-dispatch-reassign={l.orderId}>
                              <Send className="size-3" aria-hidden />{t('order.action.reassign')}
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {reassign && (
        <AssignCarrierDrawer orderId={reassign.orderId} open onOpenChange={(o) => !o && setReassign(null)} terminalName={reassign.terminalName} city={reassign.shipToCity} />
      )}
    </div>
  )
}
