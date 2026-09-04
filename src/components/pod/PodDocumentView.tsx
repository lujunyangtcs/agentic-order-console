import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, MessageSquarePlus, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/state/PermissionGate'
import { api } from '@/services'
import type { OrderDetail } from '@/services'
import { useActor } from '@/app/useActor'
import { PRODUCT, SYSTEMS } from '@/app/product'
import { downloadUrl } from '@/lib/download'
import { formatDateTime, formatTime } from '@/fixtures/calendar'
import { productKey, statusKey, useLang } from '@/i18n'

/**
 * The signed bill of lading as a document: letterhead, the load, the
 * milestones, the signature, and whatever the stakeholders have added. The
 * same view downloads as HTML and prints through the template's print CSS.
 */
export function PodDocumentView({ order: d }: { order: OrderDetail }) {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const actor = useActor()
  const [note, setNote] = useState('')
  const pod = d.pod
  const annotate = useMutation({
    mutationFn: () => api.pod.annotate(d.id, note.trim(), actor),
    onSuccess: () => { toast.success(t('epod.annotated')); setNote(''); qc.invalidateQueries() },
  })

  if (!pod) return null

  function download() {
    const sheet = document.querySelector('[data-print-sheet]')
    const html = `<!doctype html><meta charset="utf-8"><title>${pod!.bolNumber}</title><style>body{font-family:Inter,system-ui;color:#0b1220;padding:32px;max-width:760px;margin:auto}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}img{max-width:320px}.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#555}</style><body>${sheet?.innerHTML ?? ''}</body>`
    downloadUrl(URL.createObjectURL(new Blob([html], { type: 'text/html' })), `${pod!.bolNumber}-signed.html`)
  }

  return (
    <section data-card="epod" className="border-structural-border bg-surface rounded-lg border">
      <header className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
        <FileText className="text-muted-foreground size-4" aria-hidden />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('epod.title')} · {pod.bolNumber}</h2>
        <Button size="sm" variant="outline" onClick={download} data-epod-download><Download className="size-3.5" aria-hidden />{t('common.download')}</Button>
        <Button size="sm" variant="outline" onClick={() => window.print()} data-epod-print><Printer className="size-3.5" aria-hidden />{t('epod.print')}</Button>
      </header>

      <div data-print-sheet className="px-6 py-5">
        <p className="eyebrow text-muted-foreground">{PRODUCT.name}</p>
        <h1 className="font-display mt-1 text-xl font-semibold">{t('epod.heading')}</h1>
        <p className="text-muted-foreground text-xs">{pod.bolNumber} · {SYSTEMS.erp} {d.erpRef} · {formatDateTime(pod.signedAt, lang)}</p>

        <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
          {[
            [t('order.fact.customer'), d.customerName],
            [t('order.fact.shipTo'), d.shipToAddress],
            [t('order.fact.terminal'), d.terminalName],
            [t('order.fact.product'), `${d.tonnes} t · ${t(productKey(d.product))}`],
            [t('order.fact.carrier'), d.carrierName ?? '—'],
            [t('order.fact.truck'), d.truck ? `${d.truck.plate} · ${d.truck.driver}` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed py-1"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>

        <h3 className="mt-5 text-xs font-semibold">{t('epod.milestones')}</h3>
        <table className="mt-1.5 w-full text-xs">
          <tbody>
            {d.events.map((e) => (
              <tr key={e.id} className="border-border border-b"><td className="tabular py-1 pr-3 text-muted-foreground">{formatTime(e.at)}</td><td className="py-1 pr-3">{t(statusKey(e.status))}</td><td className="text-muted-foreground py-1">{e.actor}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="eyebrow text-muted-foreground">{t('epod.signedBy')}</p>
            <p className="mt-1 text-sm font-medium">{pod.signedBy}</p>
            <p className="text-muted-foreground text-2xs">{formatDateTime(pod.signedAt, lang)}</p>
          </div>
          <div className="border-border rounded-md border border-dashed p-2">
            {pod.signaturePng ? (
              <img src={pod.signaturePng} alt={t('epod.signature')} className="mx-auto h-20 object-contain" />
            ) : pod.file ? (
              <p className="text-muted-foreground flex h-20 items-center justify-center gap-2 text-xs"><FileText className="size-4" aria-hidden />{pod.file.name} · {pod.file.sizeKb} KB · {SYSTEMS.carrierTms}</p>
            ) : (
              <p className="text-muted-foreground flex h-20 items-center justify-center text-xs">{t('epod.signedOnDevice')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-border border-t px-5 py-4">
        <h3 className="text-xs font-semibold">{t('epod.annotations')}</h3>
        {pod.annotations.length === 0 ? (
          <p className="text-muted-foreground mt-1 text-xs">{t('epod.noAnnotations')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {pod.annotations.map((a, i) => (
              <li key={i} className="bg-muted rounded-md px-3 py-2 text-xs"><span className="font-medium">{a.by}</span> · <span className="text-muted-foreground">{formatDateTime(a.at, lang)}</span><br />{a.text}</li>
            ))}
          </ul>
        )}
        <PermissionGate capability="pod.annotate" className="mt-3">
          <div className="mt-3 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('epod.annotatePlaceholder')} className="border-border bg-background h-9 min-w-0 flex-1 rounded-md border px-2 text-xs" data-epod-note />
            <Button size="sm" variant="outline" disabled={!note.trim() || annotate.isPending} onClick={() => annotate.mutate()} data-epod-annotate>
              <MessageSquarePlus className="size-3.5" aria-hidden />{t('epod.annotate')}
            </Button>
          </div>
        </PermissionGate>
      </div>
    </section>
  )
}
