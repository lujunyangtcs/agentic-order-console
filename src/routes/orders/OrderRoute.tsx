import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { TrackMap } from '@/components/map/TrackMap'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Bell, Check, CircleAlert, Download, FileText, Lock, Send, Zap } from 'lucide-react'
import { api } from '@/services'
import type { OrderDetail, OrderDocument } from '@/services'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { EmptyState } from '@/components/state/States'
import { PermissionGate } from '@/components/state/PermissionGate'
import { StatusChip, PriorityChip } from '@/components/status/StatusChip'
import { StatusStepper } from '@/components/status/StatusStepper'
import { GatedReveal } from '@/components/ai/GatedReveal'
import { AssignCarrierDrawer } from '@/components/orders/AssignCarrierDrawer'
import { SendToErpDialog } from '@/components/orders/SendToErpDialog'
import { UploadBolDialog } from '@/components/pod/UploadBolDialog'
import { SignDeliveryDialog } from '@/components/pod/SignDeliveryDialog'
import { DeviationDialog } from '@/components/pod/DeviationDialog'
import { useAuth } from '@/app/auth'
import { useActor } from '@/app/useActor'
import { SYSTEMS } from '@/app/product'
import { ORDER_STATUSES, PRIORITIES, statusIndex, nextStatus, type OrderStatus, type Priority, type StatusEvent } from '@/types/domain'
import { formatDateTime, formatTime, formatDate } from '@/fixtures/calendar'
import { relativeAge } from '@/lib/format'
import { priorityKey, productKey, statusKey, useLang, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * One order, every hat.
 *
 * The same record for the service desk, the carrier, the customer and the
 * teams around them; only the actions change. Same composition as the
 * donor's record page: header, the rail, readiness, the tables, and a sticky
 * column with the facts and the handoff.
 */
export function OrderRoute() {
  const { orderId = '' } = useParams()
  const { t, lang } = useLang()
  const { session } = useAuth()
  const actor = useActor()
  const qc = useQueryClient()
  const [assignOpen, setAssignOpen] = useState(false)
  const [erpOpen, setErpOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [deviationOpen, setDeviationOpen] = useState(false)

  const detail = useQuery({ queryKey: ['order', orderId], queryFn: () => api.orders.detail(orderId) })
  const d = detail.data ?? null
  const status = d?.status ?? 'order_created'
  const etaWanted = !!d && !d.isRequest && statusIndex(status) < statusIndex('on_site')
  const eta = useQuery({ queryKey: ['eta', orderId, status], queryFn: () => api.tracking.eta(orderId), enabled: etaWanted })

  const refresh = () => qc.invalidateQueries()
  const setPriority = useMutation({
    mutationFn: (p: Priority) => api.orders.setPriority(orderId, p, actor),
    onSuccess: (_r, p) => { toast.success(t('order.toast.priority', { priority: t(priorityKey(p)) })); refresh() },
  })
  const remind = useMutation({
    mutationFn: (requestId: string) => api.carrier.remind(requestId, actor),
    onSuccess: (r) => { toast.success(t('order.toast.reminder', { carrier: r.carrierName })); refresh() },
  })
  const expedite = useMutation({
    mutationFn: ({ requestId, on }: { requestId: string; on: boolean }) => api.carrier.expedite(requestId, on, actor),
    onSuccess: () => { toast.success(t('order.toast.expedite')); refresh() },
  })
  const advance = useMutation({
    mutationFn: (next: OrderStatus) => api.tracking.advance(orderId, next, actor),
    onSuccess: (res) => {
      if (res.event) toast.success(t(statusKey(res.event.status)))
      refresh()
    },
  })

  const eventColumns = useMemo<ColumnDef<StatusEvent>[]>(() => [
    { key: 'at', header: t('col.when'), width: '160px', pinned: 'left', sortValue: (e) => e.at, render: (e) => <span className="tabular text-xs">{formatDateTime(e.at, lang)}</span> },
    { key: 'status', header: t('col.status'), width: '170px', sortValue: (e) => ORDER_STATUSES.indexOf(e.status), render: (e) => <StatusChip status={e.status} /> },
    { key: 'actor', header: t('col.who'), width: '190px', sortValue: (e) => e.actor, render: (e) => <span className="text-xs">{e.actor}</span> },
    { key: 'source', header: t('col.source'), width: '110px', render: (e) => <span className="text-muted-foreground text-xs capitalize">{e.source === 'erp' ? SYSTEMS.erp : e.source}</span> },
    { key: 'note', header: t('col.note'), width: '320px', render: (e) => <span className="text-muted-foreground text-xs">{e.note ?? '—'}</span> },
  ], [t, lang])

  if (detail.isLoading) {
    return <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6"><div className="bg-surface h-64 animate-pulse rounded-lg" /></div>
  }
  if (!d) {
    return <div className="mx-auto max-w-2xl px-6 py-10"><EmptyState title={t('order.notFound')} /></div>
  }

  const reachedAt: Partial<Record<OrderStatus, string>> = {}
  for (const e of d.events) reachedAt[e.status] = e.at
  const openRequest = d.requests.find((r) => r.state === 'sent')
  const lastRejected = [...d.requests].reverse().find((r) => r.state === 'rejected')
  const role = session?.role ?? 'CVC User'
  const isDesk = role === 'CVC User' || role === 'Administrator'
  const isOwnCarrier = role === 'Carrier' && d.carrierId === session?.carrierId
  const isYard = role === 'Other Stakeholder' && session?.stakeholderKind === 'shipping_point'
  const nxt = nextStatus(status)

  /* Who may record the next status: the carrier for the truck's own moves,
   * the terminal for the scale, the desk never (it watches), the admin for
   * rehearsal. */
  const actionable: OrderStatus[] = []
  if (nxt && !d.isRequest) {
    const carrierMoves: OrderStatus[] = ['transit_to_terminal', 'starting_load', 'in_transit', 'on_site', 'unloading', 'unload_completed']
    if ((isOwnCarrier && carrierMoves.includes(nxt)) || (isYard && nxt === 'load_completed') || role === 'Administrator') actionable.push(nxt)
  }

  const readiness = [
    { key: 'carrier', label: t('order.ready.carrier'), done: statusIndex(status) >= statusIndex('order_scheduled') },
    { key: 'truck', label: t('order.ready.truck'), done: !!d.truck },
    { key: 'bol', label: t('order.ready.bol'), done: d.documents.some((x) => x.kind === 'bol') },
    { key: 'signed', label: t('order.ready.signed'), done: !!d.pod },
  ]

  const handoff = (() => {
    if (d.isRequest) return { title: t('order.next.erp'), body: t('order.next.erpBody'), action: 'erp' as const }
    if (status === 'delivery_completed') return { title: t('order.next.done'), body: t('order.next.doneBody', { time: formatTime(d.statusAt) }), action: null }
    if (isDesk) {
      if (status === 'order_created' && d.rejected && lastRejected) return { title: t('order.next.reassign'), body: t('order.next.reassignBody', { carrier: lastRejected.carrierName }), action: 'assign' as const }
      if (status === 'order_created') return { title: t('order.next.assign'), body: t('order.next.assignBody'), action: 'assign' as const }
      if (status === 'pending_carrier' && openRequest) return { title: t('order.next.pending', { carrier: openRequest.carrierName }), body: t('order.next.pendingBody', { ago: relativeAge(openRequest.sentAt) }), action: 'pending' as const }
      return { title: t('order.next.watch'), body: t('order.next.watchBody'), action: null }
    }
    if (isOwnCarrier && actionable.length) return { title: t('order.next.carrier'), body: t('order.next.carrierBody'), action: null }
    if (isOwnCarrier && statusIndex(status) >= statusIndex('unload_completed') && !d.pod) return { title: t('loads.uploadBol'), body: t('loads.upload.desc'), action: 'upload' as const }
    if (role === 'Customer' && statusIndex(status) >= statusIndex('on_site')) return { title: t('order.next.sign'), body: t('order.next.signBody'), action: 'sign' as const }
    return { title: t('order.next.watch'), body: t('order.next.watchBody'), action: null }
  })()

  return (
    <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 md:px-6 md:py-6 xl:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-1">
          <p className="text-muted-foreground eyebrow">{t('order.eyebrow')} · {d.id}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-semibold">{d.isRequest ? t('worklist.request') : d.erpRef}</h1>
            <StatusChip status={status} rejected={d.rejected} />
            <PriorityChip priority={d.priority} />
          </div>
          <p className="text-muted-foreground text-sm">
            {t('order.subtitle', { customer: d.customerName, tonnes: d.tonnes, product: t(productKey(d.product)), terminal: d.terminalName, city: d.shipToCity })}
          </p>
        </header>

        {d.lockedBy && (
          <p data-lock-banner className="bg-sev-high-bg text-sev-high-on-bg flex items-center gap-2 rounded-md px-3 py-2 text-xs">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            {t('order.locked', { name: d.lockedBy, ago: relativeAge(d.statusAt) })}
          </p>
        )}

        {!d.isRequest && (
          <section data-card="stepper" className="border-structural-border bg-surface rounded-lg border p-4">
            <StatusStepper current={status} reachedAt={reachedAt} actionable={actionable} onAdvance={(s) => advance.mutate(s)} busy={advance.isPending} rejected={d.rejected} />
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <section data-card="readiness" className="border-structural-border bg-surface flex h-full flex-col rounded-lg border p-4">
            <h2 className="text-sm font-semibold">{t('order.readiness')}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {readiness.map((r) => (
                <li key={r.key} data-ready={r.key} data-ready-state={r.done ? 'done' : 'pending'} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs', r.done ? 'border-verdict-pass/30 bg-verdict-pass-bg text-verdict-pass' : 'border-border text-muted-foreground')}>
                  {r.done ? <Check className="size-3.5 shrink-0" aria-hidden /> : <span className="border-structural-border size-3.5 shrink-0 rounded-full border" aria-hidden />}
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="ml-auto shrink-0 text-2xs">{r.done ? t('order.ready.yes') : t('order.ready.no')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section data-card="eta" className="ai-surface flex h-full flex-col rounded-lg p-4">
            {etaWanted ? (
              <GatedReveal ready={!!eta.data || eta.isFetched} gateLabel={t('order.eta.gate')} doneLabel={t('order.eta.done')}>
                {eta.data ? (
                  <div>
                    <p className="figure tabular text-2xl leading-none font-medium">{formatTime(eta.data.at)}</p>
                    <p className="text-ai-muted mt-1 text-xs">{t('order.eta.window', { low: formatTime(eta.data.lowAt), high: formatTime(eta.data.highAt) })} · {formatDate(eta.data.at, lang)}</p>
                    <p className="text-ai-muted mt-2 text-2xs">{eta.data.basis}</p>
                  </div>
                ) : (
                  <p className="text-ai-muted text-xs">{t('order.eta.none')}</p>
                )}
              </GatedReveal>
            ) : (
              <div>
                <p className="text-ai-muted eyebrow">{t('order.eta.done')}</p>
                <p className="text-ai-muted mt-2 text-xs">{t('order.eta.none')}</p>
              </div>
            )}
          </section>
        </div>

        {!d.isRequest && statusIndex(status) >= statusIndex('order_scheduled') && status !== 'delivery_completed' && (
          <section data-card="tracking" className="border-structural-border bg-surface flex flex-col rounded-lg border">
            <header className="border-border flex items-baseline justify-between border-b px-5 py-3.5">
              <h2 className="text-sm font-semibold">{t('order.tracking')}</h2>
              <Link to={`/track?order=${d.id}`} className="text-accent-text text-xs font-medium hover:underline">{t('nav.track')} →</Link>
            </header>
            <div className="p-2">
              <TrackMap
                terminals={[d.lane.terminal]}
                sites={[d.lane.shipTo]}
                routes={[{ orderId: d.id, erpRef: d.erpRef, path: d.lane.path, progress: d.etaDetail?.progress ?? (statusIndex(status) >= statusIndex('on_site') ? 1 : 0), status, carrierName: d.carrierName ?? '—', customerName: d.customerName, eta: d.eta, atTerminal: statusIndex(status) < statusIndex('in_transit') }]}
                focusOrderId={d.id}
                className="h-[300px]"
              />
            </div>
          </section>
        )}

        {!d.isRequest && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">{t('order.timeline')}</h2>
              <span className="text-muted-foreground text-xs">{t('order.timeline.sub')}</span>
            </div>
            <DataTable name="timeline" rows={[...d.events].reverse()} columns={eventColumns} rowKey={(e) => e.id} maxHeight={308} empty={t('common.empty')} />
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <section data-card="documents" className="border-structural-border bg-surface flex h-full flex-col rounded-lg border">
            <header className="border-border border-b px-5 py-3.5"><h2 className="text-sm font-semibold">{t('order.documents')}</h2></header>
            {d.documents.length === 0 ? (
              <p className="text-muted-foreground px-5 py-4 text-xs">{t('order.documents.empty')}</p>
            ) : (
              <ul className="divide-border flex-1 divide-y">
                {d.documents.map((doc) => <DocumentRow key={doc.id} doc={doc} order={d} />)}
              </ul>
            )}
          </section>

          <section data-card="requests" className="border-structural-border bg-surface flex h-full flex-col rounded-lg border">
            <header className="border-border border-b px-5 py-3.5"><h2 className="text-sm font-semibold">{t('order.requests')}</h2></header>
            {d.requests.length === 0 ? (
              <p className="text-muted-foreground px-5 py-4 text-xs">{t('order.requests.empty')}</p>
            ) : (
              <ul className="divide-border flex-1 divide-y">
                {d.requests.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.carrierName}</span>
                      <span className="text-muted-foreground block text-2xs">
                        {t('col.sent')} {formatTime(r.sentAt)}{r.respondedAt ? ` · ${t('col.answered')} ${formatTime(r.respondedAt)}` : ''}{r.reason ? ` · ${r.reason}` : ''}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-xs px-2 py-0.5 text-2xs font-medium', r.state === 'accepted' ? 'bg-verdict-pass-bg text-verdict-pass' : r.state === 'rejected' ? 'bg-sev-critical-bg text-sev-critical-on-bg' : r.state === 'sent' ? 'bg-status-pending-bg text-sev-high-on-bg' : 'bg-muted text-muted-foreground')}>
                      {r.state}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {d.deviations.length > 0 && (
          <section data-card="deviations" className="border-structural-border bg-surface rounded-lg border">
            <header className="border-border border-b px-5 py-3.5"><h2 className="text-sm font-semibold">{t('order.deviations')}</h2></header>
            <ul className="divide-border divide-y">
              {d.deviations.map((dv) => (
                <li key={dv.id} className="flex items-start gap-3 px-5 py-2.5 text-xs">
                  <CircleAlert className="text-sev-high mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t(`deviation.kind.${dv.kind}` as I18nKey)}{dv.qtyDelta ? ` (${dv.qtyDelta > 0 ? '+' : ''}${dv.qtyDelta} t)` : ''}</span>
                    <span className="text-muted-foreground block text-2xs">{dv.note} · {dv.filedBy} · {formatDateTime(dv.filedAt, lang)}</span>
                  </span>
                  <span className="bg-muted text-muted-foreground shrink-0 rounded-xs px-2 py-0.5 text-2xs capitalize">{dv.state}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <section data-card="handoff" className="ai-surface rounded-lg p-5">
          <p className="text-ai-muted eyebrow">{t('order.next')}</p>
          <h2 className="mt-1 text-sm font-semibold">{handoff.title}</h2>
          <p className="text-ai-muted mt-1 text-xs leading-relaxed">{handoff.body}</p>
          {handoff.action === 'assign' && (
            <PermissionGate capability="order.assign" className="mt-4">
              <Button size="sm" className="mt-4 w-full" data-variant="primary" onClick={() => setAssignOpen(true)} data-action="assign">
                {d.rejected ? t('order.action.reassign') : t('order.action.assign')}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </PermissionGate>
          )}
          {handoff.action === 'erp' && (
            <PermissionGate capability="order.assign" className="mt-4">
              <Button size="sm" className="mt-4 w-full" data-variant="primary" onClick={() => setErpOpen(true)} data-action="erp">
                {t('order.action.erp', { orders: SYSTEMS.orders })}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </PermissionGate>
          )}
          {handoff.action === 'upload' && (
            <Button size="sm" className="mt-4 w-full" data-variant="primary" onClick={() => setUploadOpen(true)} data-action="upload">
              {t('loads.uploadBol')}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          )}
          {handoff.action === 'sign' && (
            <PermissionGate capability="pod.sign" className="mt-4">
              <Button size="sm" className="mt-4 w-full" data-variant="primary" onClick={() => setSignOpen(true)} data-action="sign">
                {t('order.action.sign')}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </PermissionGate>
          )}
          {statusIndex(status) >= statusIndex('on_site') && !d.isRequest && (
            <PermissionGate capability="deviation.file" className="mt-2">
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setDeviationOpen(true)} data-action="report">
                <CircleAlert className="size-3.5" aria-hidden />
                {t('order.action.report')}
              </Button>
            </PermissionGate>
          )}
          {handoff.action === 'pending' && openRequest && (
            <div className="mt-4 flex flex-col gap-2">
              <Button size="sm" variant="outline" className="w-full" disabled={remind.isPending} onClick={() => remind.mutate(openRequest.id)} data-action="remind">
                <Bell className="size-3.5" aria-hidden />
                {t('order.action.remind')}
              </Button>
              <Button size="sm" variant="outline" className="w-full" disabled={expedite.isPending} onClick={() => expedite.mutate({ requestId: openRequest.id, on: !openRequest.expedited })} data-action="expedite">
                <Zap className="size-3.5" aria-hidden />
                {openRequest.expedited ? t('order.action.unexpedite') : t('order.action.expedite')}
              </Button>
              <Button size="sm" variant="ghost" className="w-full" onClick={() => setAssignOpen(true)} data-action="reassign">
                <Send className="size-3.5" aria-hidden />
                {t('order.action.reassign')}
              </Button>
            </div>
          )}
        </section>

        <section data-card="order-context" className="border-structural-border bg-surface rounded-lg border p-5">
          <h2 className="text-sm font-semibold">{t('order.facts')}</h2>
          <dl className="divide-border mt-3 divide-y text-sm">
            {[
              [t('order.fact.customer'), d.customerName],
              [t('order.fact.shipTo'), d.shipToAddress],
              [t('order.fact.terminal'), d.terminalName],
              [t('order.fact.product'), t(productKey(d.product))],
              [t('order.fact.tonnes'), `${d.tonnes} t`],
              [t('order.fact.window'), `${formatDate(d.windowStart, lang)} ${formatTime(d.windowStart)}–${formatTime(d.windowEnd)}`],
              [t('order.fact.carrier'), d.carrierName ?? '—'],
              [t('order.fact.truck'), d.truck ? `${d.truck.plate} · ${d.truck.driver}` : '—'],
              [t('order.fact.owner'), d.cvrName],
              [t('order.fact.erp'), d.isRequest ? '—' : `${SYSTEMS.erp} ${d.erpRef}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground shrink-0 text-xs">{k}</dt>
                <dd className="tabular min-w-0 text-right text-xs font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {isDesk && !d.isRequest && status !== 'delivery_completed' && (
            <div className="mt-4">
              <p className="text-muted-foreground eyebrow">{t('order.action.priority')}</p>
              <div role="radiogroup" className="mt-1.5 flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={d.priority === p}
                    data-priority-option={p}
                    disabled={setPriority.isPending}
                    onClick={() => d.priority !== p && setPriority.mutate(p)}
                    className={cn('flex-1 rounded-md border px-2 py-1 text-2xs font-medium transition-colors duration-150', d.priority === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-hover-tint')}
                  >
                    {t(priorityKey(p))}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </aside>

      <AssignCarrierDrawer orderId={d.id} open={assignOpen} onOpenChange={setAssignOpen} terminalName={d.terminalName} city={d.shipToCity} />
      <SendToErpDialog orderId={d.id} open={erpOpen} onOpenChange={setErpOpen} terminalName={d.terminalName} />
      <UploadBolDialog order={uploadOpen ? d : null} onOpenChange={(o) => !o && setUploadOpen(false)} />
      <SignDeliveryDialog order={d} open={signOpen} onOpenChange={setSignOpen} defaultName={session?.role === 'Customer' ? d.customerContact : session?.name ?? ''} />
      <DeviationDialog orderId={d.id} open={deviationOpen} onOpenChange={setDeviationOpen} />
    </div>
  )
}

const DOC_ICON: Record<OrderDocument['kind'], typeof FileText> = {
  erp_order: FileText, bol: FileText, signed_bol: Check, delivery_record: FileText, invoice: FileText,
}

function DocumentRow({ doc, order }: { doc: OrderDocument; order: OrderDetail }) {
  const { t, lang } = useLang()
  const Icon = DOC_ICON[doc.kind]
  function download() {
    const html = `<!doctype html><meta charset="utf-8"><title>${doc.title}</title><body style="font-family:Inter,system-ui;padding:32px;color:#0b1220"><h1 style="font-size:20px">${doc.title}</h1><p>${t('col.reference')}: <b>${doc.reference}</b></p><p>${t('col.source')}: ${doc.source} · ${formatDateTime(doc.issuedAt, lang)}</p><hr><p>${order.customerName} · ${order.shipToAddress}</p><p>${order.tonnes} t ${order.product} · ${order.terminalName}</p></body>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.reference}.html`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <li className="flex items-center gap-3 px-5 py-2.5 text-xs">
      <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{doc.title}</span>
        <span className="text-muted-foreground block text-2xs">{doc.source} · {formatDateTime(doc.issuedAt, lang)}</span>
      </span>
      <span className="text-muted-foreground shrink-0 font-mono text-2xs">{doc.reference}</span>
      {doc.kind === 'signed_bol' ? (
        <Button asChild size="sm" variant="outline" className="shrink-0" data-open-epod>
          <Link to={`/epod/${order.id}`}>{t('common.open')}</Link>
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="shrink-0" onClick={download} aria-label={t('common.download')} data-download={doc.kind}>
          <Download className="size-3.5" aria-hidden />
        </Button>
      )}
    </li>
  )
}
