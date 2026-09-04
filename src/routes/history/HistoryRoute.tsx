import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, Download, FileText, Search, X } from 'lucide-react'
import { api } from '@/services'
import type { HistoryRow, OrderDocument } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/app/auth'
import { useScope } from '@/app/useActor'
import { downloadUrl } from '@/lib/download'
import { DocumentDialog } from '@/components/documents/DocumentDialog'
import { documentFilename, documentHtml } from '@/documents/html'
import { formatDateTime } from '@/fixtures/calendar'
import { useLang } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Completed orders and their documents. The donor's list page: a search
 * box, a pinned-column table, and a drawer for the row you open.
 */
export function HistoryRoute() {
  const { t, lang } = useLang()
  const { session } = useAuth()
  const scope = useScope()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [openRow, setOpenRow] = useState<HistoryRow | null>(null)

  const filter = session?.role === 'Customer' ? { customerId: scope, q } : session?.role === 'Carrier' ? { carrierId: scope, q } : { q }
  const rows = useQuery({ queryKey: ['history', filter], queryFn: () => api.orders.history(filter) })
  const data = rows.data ?? []
  const onTime = data.length ? data.filter((r) => r.onTime).length / data.length : 0

  const columns = useMemo<ColumnDef<HistoryRow>[]>(() => [
    { key: 'order', header: t('col.order'), width: '130px', pinned: 'left', sortValue: (r) => r.erpRef, render: (r) => <span className="font-mono text-xs font-medium">{r.erpRef}</span> },
    { key: 'customer', header: t('col.customer'), width: '200px', sortValue: (r) => r.customerName, render: (r) => <span className="text-xs">{r.customerName}</span> },
    { key: 'shipTo', header: t('col.shipTo'), width: '210px', sortValue: (r) => r.shipToName, render: (r) => <span className="text-muted-foreground text-xs">{r.shipToName}</span> },
    { key: 'carrier', header: t('col.carrier'), width: '190px', sortValue: (r) => r.carrierName, render: (r) => <span className="text-xs">{r.carrierName}</span> },
    { key: 'delivered', header: t('history.delivered'), width: '170px', numeric: true, sortValue: (r) => r.deliveredAt, render: (r) => <span className="tabular text-xs">{formatDateTime(r.deliveredAt, lang)}</span> },
    { key: 'onTime', header: t('history.onTime'), width: '110px', sortValue: (r) => (r.onTime ? 1 : 0), render: (r) => (
      <span className={cn('inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium', r.onTime ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-sev-high-bg text-sev-high-on-bg')}>
        {r.onTime ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}{r.onTime ? t('history.yes') : t('history.late')}
      </span>
    ) },
    { key: 'tonnes', header: t('col.tonnes'), width: '90px', numeric: true, sortValue: (r) => r.tonnes, render: (r) => <span className="tabular text-xs">{r.tonnes} t</span> },
    { key: 'docs', header: t('history.documents'), width: '120px', pinned: 'right', render: (r) => <span className="text-accent-text text-xs font-medium">{r.documents.length} <FileText className="inline size-3" aria-hidden /></span> },
  ], [t, lang])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.history.title')}
        description={t('page.history.desc')}
        stats={[
          { label: t('history.count'), value: data.length },
          { label: t('history.onTimePct'), value: `${Math.round(onTime * 100)}%`, tone: onTime >= 0.9 ? 'good' : 'attention' },
        ]}
      />
      <form className="flex max-w-md items-center gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="border-border bg-surface flex h-9 flex-1 items-center gap-2 rounded-md border px-2.5">
          <Search className="text-muted-foreground size-3.5" aria-hidden />
          <input
            value={q}
            onChange={(e) => { const next = new URLSearchParams(params); if (e.target.value) next.set('q', e.target.value); else next.delete('q'); setParams(next, { replace: true }) }}
            placeholder={t('history.search')}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            data-history-search
          />
        </div>
      </form>
      {rows.isLoading ? <LoadingRows rows={6} /> : (
        <DataTable name="history" rows={data} columns={columns} rowKey={(r) => r.id} maxHeight={440} empty={t('common.empty')} onRowClick={(r) => setOpenRow(r)} />
      )}

      <Sheet open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[500px]" data-drawer="documents">
          <SheetHeader>
            <SheetTitle>{openRow?.erpRef}</SheetTitle>
            <SheetDescription>{openRow ? `${openRow.customerName} · ${openRow.shipToName} · ${openRow.carrierName}` : ''}</SheetDescription>
          </SheetHeader>
          <ul className="divide-border divide-y px-4">
            {(openRow?.documents ?? []).map((doc) => <DocRow key={doc.id} doc={doc} orderId={openRow!.id} />)}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DocRow({ doc, orderId }: { doc: OrderDocument; orderId: string }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  async function download() {
    const model = await api.orders.document(orderId, doc.id)
    downloadUrl(URL.createObjectURL(new Blob([documentHtml(model, lang)], { type: 'text/html' })), documentFilename(model))
  }
  return (
    <li className="flex items-center gap-3 py-2.5 text-xs">
      <FileText className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <button type="button" onClick={() => setOpen(true)} data-open-doc={doc.kind} className="min-w-0 flex-1 text-left">
        <span className="hover:text-accent-text block font-medium">{doc.title}</span>
        <span className="text-muted-foreground block text-2xs">{doc.source} · {formatDateTime(doc.issuedAt, lang)}</span>
      </button>
      <Button size="sm" variant="ghost" onClick={download} aria-label={t('common.download')}><Download className="size-3.5" aria-hidden /></Button>
      <DocumentDialog orderId={orderId} doc={open ? doc : null} onOpenChange={(o) => !o && setOpen(false)} />
    </li>
  )
}
