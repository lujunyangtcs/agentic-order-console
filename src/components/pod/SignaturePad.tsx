import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * A signature, drawn with a finger, a stylus or a mouse.
 *
 * The canvas is scaled to the device pixel ratio so a signature captured on
 * a phone prints cleanly, and pointer capture keeps the stroke attached even
 * when the pointer leaves the box.
 */
export function SignaturePad({ onChange, className }: { onChange: (dataUrl: string | null) => void; className?: string }) {
  const t = useT()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const inked = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = Math.round(rect.width * dpr)
    c.height = Math.round(rect.height * dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0b1220'
  }, [])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    drawing.current = true
    const ctx = e.currentTarget.getContext('2d')!
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')!
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (!inked.current) {
      inked.current = true
      setEmpty(false)
    }
  }
  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    onChange(inked.current ? e.currentTarget.toDataURL('image/png') : null)
  }
  function clear() {
    const c = canvas.current!
    const ctx = c.getContext('2d')!
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.restore()
    inked.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="border-structural-border bg-surface relative h-40 w-full rounded-md border">
        <canvas
          ref={canvas}
          data-signature-pad
          className="h-full w-full touch-none rounded-md"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {empty && <p className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-3 text-center text-2xs">{t('sign.hint')}</p>}
        <span className="border-border pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed" aria-hidden />
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={clear} disabled={empty} data-signature-clear>
          <Eraser className="size-3.5" aria-hidden />{t('sign.clear')}
        </Button>
      </div>
    </div>
  )
}
