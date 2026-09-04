import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Inbox, Truck, Wifi, WifiOff, X, Zap } from 'lucide-react'
import { api } from '@/services'
import type { InboxRow } from '@/services'
import { TodayBand } from '@/components/dashboard/TodayBand'
import { KpiTile } from '@/components/dashboard/KpiTile'
import { EmptyState } from '@/components/state/States'
import { PriorityChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/app/auth'
import { useActor } from '@/app/useActor'
import { formatTime, formatDate } from '@/fixtures/calendar'
import { relativeAge } from '@/lib/format'
import { productKey, useLang, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const REASONS: I18nKey[] = ['inbox.reason.capacity', 'inbox.reason.hours', 'inbox.reason.distance', 'inbox.reason.equipment']

/**
 * The carrier's inbox: requests waiting for an answer, answered with one
 * click each. Carriers with a connected system see the same list their
 * system would show; carriers without one use this page as their system.
 */
export function InboxRoute() {
  const { t, lang } = useLang()
  const { session } = useAuth()
  const actor = useActor()
  const qc = useQueryClient()
  const carrierId = session?.carrierId ?? ''
  const [accepting, setAccepting] = useState<InboxRow | null>(null)
  const [declining, setDeclining] = useState<InboxRow | null>(null)
  const [truckId, setTruckId] = useState('')
  const [reason, setReason] = useState<I18nKey>(REASONS[0])

  const inbox = useQuery({ queryKey: ['inbox', carrierId], queryFn: () => api.carrier.inbox(carrierId) })
  const loads = useQuery({ queryKey: ['loads', carrierId], queryFn: () => api.carrier.loads(carrierId) })
  const scorecard = useQuery({ queryKey: ['scorecard'], queryFn: () => api.carrier.scorecard() })

  const respond = useMutation({
    mutationFn: ({ row, decision, opts }: { row: InboxRow; decision: 'accept' | 'reject'; opts: { truckId?: string; reason?: string } }) =>
      api.carrier.respond(row.requestId, decision, opts, actor),
    onSuccess: (_res, vars) => {
      toast.success(t(vars.decision === 'accept' ? 'inbox.accepted' : 'inbox.rejected', { order: vars.row.erpRef }))
      setAccepting(null)
      setDeclining(null)
      qc.invalidateQueries()
    },
  })

  const waiting = (inbox.data ?? []).filter((r) => r.state === 'sent')
  const answered = (inbox.data ?? []).filter((r) => r.state !== 'sent')
  const oldest = [...waiting].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt))[0]
  const me = scorecard.data?.find((r) => r.carrierId === carrierId)
  const onRoad = (loads.data ?? []).filter((r) => r.status !== 'delivery_completed').length
  const channel = session?.noTms ? t('inbox.channel.portal') : t('inbox.channel.edi')

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
      <TodayBand
        title={t('page.inbox.title')}
        subtitle={t('page.inbox.desc')}
        waiting={waiting.length}
        unit={waiting.length === 1 ? t('inbox.unit.one') : t('inbox.unit.many')}
        severities={[{ severity: 'high', count: waiting.filter((r) => r.expedited).length }]}
        sentence={inbox.data ? (oldest ? t(waiting.length === 1 ? 'inbox.readOne' : 'inbox.read', { n: waiting.length, ago: relativeAge(oldest.sentAt), customer: oldest.customerName }) : t('inbox.readClear', { loads: onRoad })) : null}
        primaryTo={null}
        secondaryTo="/carrier/loads"
        metrics={[
          { label: t('inbox.metric.answer'), value: me ? t('requests.minutes', { n: me.acceptanceMinutes }) : '—' },
          { label: t('inbox.metric.rank'), value: me ? `#${me.rank}` : '—' },
          { label: t('inbox.via', { channel }), value: session?.noTms ? t('assign.portal') : t('assign.tms') },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiTile label={t('inbox.kpi.waiting')} value={waiting.length} icon={Inbox} tone={waiting.length ? 'warning' : 'good'} footnote={t('inbox.kpi.waitingFoot')} />
        <KpiTile label={t('inbox.kpi.loads')} value={onRoad} icon={Truck} tone="neutral" footnote={t('inbox.kpi.loadsFoot')} />
        <KpiTile label={t('inbox.kpi.onTime')} value={me?.onTimePct ?? 0} unit="%" icon={Check} tone={(me?.onTimePct ?? 0) >= 0.9 ? 'good' : 'warning'} footnote={t('inbox.kpi.onTimeFoot')} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t('inbox.waiting')}</h2>
        {waiting.length === 0 ? (
          <EmptyState title={t('inbox.empty')} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 md:items-stretch">
            {waiting.map((r) => (
              <li key={r.requestId} className="h-full">
                <RequestCard row={r} onAccept={() => { setTruckId(r.trucks[0]?.id ?? ''); setAccepting(r) }} onDecline={() => setDeclining(r)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {answered.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{t('inbox.answered')}</h2>
          <ul className="border-structural-border bg-surface divide-border divide-y rounded-lg border">
            {answered.map((r) => (
              <li key={r.requestId} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                <span className={cn('size-2 shrink-0 rounded-full', r.state === 'accepted' ? 'bg-verdict-pass' : 'bg-sev-critical')} aria-hidden />
                <Link to={`/orders/${r.orderId}`} className="font-mono font-medium hover:underline">{r.erpRef}</Link>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">{r.customerName} · {r.shipToCity} · {r.tonnes} t {t(productKey(r.product))}</span>
                <span className="text-muted-foreground shrink-0">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</span>
                <span className={cn('shrink-0 rounded-xs px-2 py-0.5 text-2xs font-medium', r.state === 'accepted' ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-sev-critical-bg text-sev-critical-on-bg')}>
                  {t(`requests.state.${r.state}` as I18nKey)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={!!accepting} onOpenChange={(o) => !o && setAccepting(null)}>
        <DialogContent className="sm:max-w-md" data-dialog="accept">
          <DialogHeader>
            <DialogTitle>{t('inbox.acceptTitle', { order: accepting?.erpRef ?? '' })}</DialogTitle>
            <DialogDescription>{t('inbox.acceptDesc')}</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label={t('inbox.truck')} className="flex flex-col gap-1.5">
            {(accepting?.trucks ?? []).map((tr) => (
              <button
                key={tr.id}
                type="button"
                role="radio"
                aria-checked={truckId === tr.id}
                data-truck={tr.id}
                onClick={() => setTruckId(tr.id)}
                className={cn('flex items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors', truckId === tr.id ? 'border-accent bg-muted' : 'border-border hover:bg-hover-tint')}
              >
                <Truck className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="font-mono font-medium">{tr.plate}</span>
                <span className="text-muted-foreground">{tr.driver}</span>
                <Check className={cn('text-accent-text ml-auto size-3.5', truckId !== tr.id && 'opacity-0')} aria-hidden />
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccepting(null)}>{t('common.cancel')}</Button>
            <Button disabled={!truckId || respond.isPending} onClick={() => accepting && respond.mutate({ row: accepting, decision: 'accept', opts: { truckId } })} data-confirm-accept>
              <Check className="size-3.5" aria-hidden />
              {t('inbox.accept')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!declining} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent className="sm:max-w-md" data-dialog="reject">
          <DialogHeader>
            <DialogTitle>{t('inbox.rejectTitle', { order: declining?.erpRef ?? '' })}</DialogTitle>
            <DialogDescription>{t('inbox.rejectDesc')}</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label={t('inbox.reason')} className="flex flex-col gap-1.5">
            {REASONS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={reason === k}
                data-reason={k}
                onClick={() => setReason(k)}
                className={cn('flex items-center gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors', reason === k ? 'border-accent bg-muted' : 'border-border hover:bg-hover-tint')}
              >
                <span className="flex-1">{t(k)}</span>
                <Check className={cn('text-accent-text size-3.5', reason !== k && 'opacity-0')} aria-hidden />
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeclining(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" disabled={respond.isPending} onClick={() => declining && respond.mutate({ row: declining, decision: 'reject', opts: { reason: t(reason) } })} data-confirm-reject>
              <X className="size-3.5" aria-hidden />
              {t('inbox.reject')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RequestCard({ row: r, onAccept, onDecline }: { row: InboxRow; onAccept: () => void; onDecline: () => void }) {
  const { t, lang } = useLang()
  const { session } = useAuth()
  return (
    <article data-request={r.requestId} className="border-structural-border bg-surface flex h-full flex-col rounded-lg border p-4 lift">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground eyebrow">{t('inbox.sentAgo', { ago: relativeAge(r.sentAt) })}</p>
          <Link to={`/orders/${r.orderId}`} className="mt-0.5 block font-mono text-sm font-semibold hover:underline">{r.erpRef}</Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {r.expedited && (
            <span className="bg-sev-critical-bg text-sev-critical-on-bg flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium">
              <Zap className="size-3" aria-hidden />{t('inbox.expedited')}
            </span>
          )}
          <PriorityChip priority={r.priority} />
        </div>
      </div>

      <dl className="mt-3 flex flex-col gap-1 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.customer')}</dt><dd className="truncate font-medium">{r.customerName}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.terminal')}</dt><dd className="truncate">{r.terminalName} → {r.shipToCity}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.product')}</dt><dd>{r.tonnes} t {t(productKey(r.product))}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t('col.window')}</dt><dd className="tabular">{formatDate(r.windowStart, lang)} {formatTime(r.windowStart)}–{formatTime(r.windowEnd)}</dd></div>
      </dl>

      <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-2xs">
        {session?.noTms ? <WifiOff className="size-3" aria-hidden /> : <Wifi className="size-3" aria-hidden />}
        {r.reminders > 0 ? t('inbox.reminders', { n: r.reminders }) : t('inbox.via', { channel: session?.noTms ? t('inbox.channel.portal') : t('inbox.channel.edi') })}
      </p>

      <div className="mt-auto flex gap-2 pt-4">
        <Button size="sm" className="flex-1" onClick={onAccept} data-accept={r.requestId} data-variant="primary">
          <Check className="size-3.5" aria-hidden />{t('inbox.accept')}
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onDecline} data-reject={r.requestId}>
          <X className="size-3.5" aria-hidden />{t('inbox.reject')}
        </Button>
      </div>
    </article>
  )
}
