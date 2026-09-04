import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, FileText, FileUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/services'
import type { WorklistRow } from '@/services'
import { useActor } from '@/app/useActor'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * A carrier hands in the signed bill of lading.
 *
 * Drop a file or take the sample; either way the document lands in the
 * store and every other screen — the desk's order page, the customer's
 * portal — shows it on the next render.
 */
export function UploadBolDialog({ order, onOpenChange }: { order: WorklistRow | null; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [file, setFile] = useState<{ name: string; sizeKb: number } | null>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (!order) setFile(null)
  }, [order])

  const upload = useMutation({
    mutationFn: () => api.pod.upload(order!.id, file!, actor),
    onSuccess: () => {
      toast.success(t('loads.upload.done', { name: file?.name ?? '' }))
      qc.invalidateQueries()
      onOpenChange(false)
    },
  })

  const sample = () => order && setFile({ name: `BOL-${order.erpRef.slice(-5)}-signed.pdf`, sizeKb: 214 })

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-dialog="upload-bol">
        <DialogHeader>
          <DialogTitle>{t('loads.upload.title')}</DialogTitle>
          <DialogDescription>{t('loads.upload.desc')}</DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) setFile({ name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) })
          }}
          className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors', over ? 'border-accent bg-muted' : 'border-structural-border')}
          data-dropzone
        >
          {file ? (
            <>
              <FileText className="text-verdict-pass size-6" aria-hidden />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground text-2xs">{file.sizeKb} KB</p>
            </>
          ) : (
            <>
              <FileUp className="text-muted-foreground size-6" aria-hidden />
              <p className="text-muted-foreground text-xs">{t('loads.upload.drop')}</p>
              <Button size="sm" variant="outline" onClick={sample} data-upload-sample>{t('loads.upload.sample')}</Button>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()} data-upload-send>
            <Check className="size-3.5" aria-hidden />
            {t('loads.upload.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
