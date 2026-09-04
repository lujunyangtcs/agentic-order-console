import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileText, MessageSquarePlus, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/state/PermissionGate'
import { api } from '@/services'
import type { OrderDetail } from '@/services'
import { useActor } from '@/app/useActor'
import { documentFilename, documentHtml } from '@/documents/html'
import { downloadUrl } from '@/lib/download'
import { formatDateTime } from '@/fixtures/calendar'
import { useLang } from '@/i18n'

/**
 * The signed bill of lading as the paper it is, with the team's notes under
 * it. The frame shows the same document that Download saves and Print
 * sends out, straight from the order record.
 */
export function PodDocumentView({ order: d }: { order: OrderDetail }) {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const actor = useActor()
  const frame = useRef<HTMLIFrameElement>(null)
  const [note, setNote] = useState('')
  const pod = d.pod
  const signedDoc = d.documents.find((x) => x.kind === 'signed_bol')
  const model = useQuery({ queryKey: ['document', d.id, signedDoc?.id, lang, pod?.annotations.length], queryFn: () => api.orders.document(d.id, signedDoc!.id), enabled: !!signedDoc })
  const html = model.data ? documentHtml(model.data, lang) : null
  const annotate = useMutation({
    mutationFn: () => api.pod.annotate(d.id, note.trim(), actor),
    onSuccess: () => { toast.success(t('epod.annotated')); setNote(''); qc.invalidateQueries() },
  })

  if (!pod) return null

  function download() {
    if (!html || !model.data) return
    downloadUrl(URL.createObjectURL(new Blob([html], { type: 'text/html' })), documentFilename(model.data))
  }

  return (
    <section data-card="epod" className="border-structural-border bg-surface rounded-lg border">
      <header className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-3.5">
        <FileText className="text-muted-foreground size-4" aria-hidden />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">{t('epod.title')} · {pod.bolNumber}</h2>
        <Button size="sm" variant="outline" onClick={download} disabled={!html} data-epod-download><Download className="size-3.5" aria-hidden />{t('common.download')}</Button>
        <Button size="sm" variant="outline" onClick={() => frame.current?.contentWindow?.print()} disabled={!html} data-epod-print><Printer className="size-3.5" aria-hidden />{t('epod.print')}</Button>
      </header>

      <div className="bg-muted p-3" data-print-sheet>
        {html ? (
          <iframe ref={frame} srcDoc={html} title={`${t('epod.title')} ${pod.bolNumber}`} className="border-border h-[960px] w-full rounded-md border bg-white" data-document-frame />
        ) : (
          <div className="h-[960px] w-full animate-pulse rounded-md" />
        )}
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
