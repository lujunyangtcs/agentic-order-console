import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/services'
import type { OrderDocument } from '@/services'
import { documentFilename, documentHtml } from '@/documents/html'
import { downloadUrl } from '@/lib/download'
import { formatDateTime } from '@/fixtures/calendar'
import { useLang } from '@/i18n'

/**
 * A document, shown as the paper it is.
 *
 * The frame renders the same HTML that Download saves and Print sends to the
 * printer, so there is exactly one rendering of every bill of lading.
 */
export function DocumentDialog({ orderId, doc, onOpenChange }: { orderId: string; doc: OrderDocument | null; onOpenChange: (o: boolean) => void }) {
  const { t, lang } = useLang()
  const frame = useRef<HTMLIFrameElement>(null)
  const model = useQuery({ queryKey: ['document', orderId, doc?.id, lang], queryFn: () => api.orders.document(orderId, doc!.id), enabled: !!doc })
  const html = model.data ? documentHtml(model.data, lang) : null

  function download() {
    if (!html || !model.data) return
    downloadUrl(URL.createObjectURL(new Blob([html], { type: 'text/html' })), documentFilename(model.data))
  }
  function print() {
    frame.current?.contentWindow?.print()
  }

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 p-4 sm:max-w-[920px]" data-dialog="document" data-document-kind={doc?.kind}>
        <DialogHeader className="pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{doc?.title}</span>
            <span className="text-muted-foreground font-mono text-xs font-normal">{doc?.reference}</span>
          </DialogTitle>
          <DialogDescription>{doc ? `${doc.source} · ${formatDateTime(doc.issuedAt, lang)}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="border-border bg-muted min-h-0 flex-1 overflow-hidden rounded-md border">
          {html ? (
            <iframe ref={frame} srcDoc={html} title={doc?.title ?? ''} className="h-[70vh] w-full bg-transparent" data-document-frame />
          ) : (
            <div className="h-[70vh] w-full animate-pulse" />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={print} disabled={!html} data-document-print><Printer className="size-3.5" aria-hidden />{t('epod.print')}</Button>
          <Button onClick={download} disabled={!html} data-document-download data-variant="primary"><Download className="size-3.5" aria-hidden />{t('common.download')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
