import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRight, ArrowLeft } from 'lucide-react'
import { api } from '@/services'
import type { ArchModule } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const W = 960
const H = 560
const CX = W / 2
const CY = H / 2
const R = 200

/**
 * The console at the hub, everything it talks to around it. Solid spokes
 * are live in this build; dashed ones are modules that can be added
 * without changing the hub. Click a node for what actually flows along it.
 */
export function ArchitectureRoute() {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const modules = useQuery({ queryKey: ['architecture'], queryFn: () => api.admin.architecture() })
  const all = modules.data ?? []
  const hub = all.find((m) => m.kind === 'hub')
  const spokes = all.filter((m) => m.kind !== 'hub')
  const open = all.find((m) => m.id === openId) ?? null
  const live = spokes.filter((m) => m.state === 'live').length
  const planned = spokes.length - live

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.architecture.title')}
        description={t('page.architecture.desc')}
        stats={[
          { label: t('arch.live'), value: live, tone: 'good' },
          { label: t('arch.planned'), value: planned },
        ]}
      />

      <section className="border-structural-border bg-surface overflow-x-auto rounded-lg border p-4" data-card="architecture">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[960px] min-w-[640px]" role="img" aria-label={t('page.architecture.title')}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted-foreground)" /></marker>
          </defs>
          {spokes.map((m, i) => {
            const a = (i / spokes.length) * Math.PI * 2 - Math.PI / 2
            const x = CX + Math.cos(a) * R
            const y = CY + Math.sin(a) * R
            const planned = m.state === 'planned'
            const sel = m.id === openId
            const ux = Math.cos(a)
            const uy = Math.sin(a)
            const x1 = CX + ux * 74
            const y1 = CY + uy * 46
            const x2 = x - ux * 78
            const y2 = y - uy * 30
            return (
              <g key={m.id} data-arch-node={m.id} className="cursor-pointer" onClick={() => setOpenId(m.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(m.id)}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={sel ? 'var(--accent)' : 'var(--muted-foreground)'} strokeWidth={sel ? 2 : 1.4} strokeDasharray={planned ? '6 5' : undefined} markerEnd={m.direction !== 'in' ? 'url(#arr)' : undefined} markerStart={m.direction !== 'out' ? 'url(#arr)' : undefined} opacity={planned ? 0.7 : 1} />
                <rect x={x - 78} y={y - 30} width={156} height={60} rx={8} fill={planned ? 'var(--muted)' : 'var(--surface)'} stroke={sel ? 'var(--accent)' : planned ? 'var(--border)' : 'var(--structural-border)'} strokeWidth={sel ? 2 : 1.2} strokeDasharray={planned ? '6 4' : undefined} />
                <text x={x} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--foreground)">{m.name}</text>
                <text x={x} y={y + 12} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">{t(`arch.kind.${m.kind}` as I18nKey)} · {t(planned ? 'arch.state.planned' : 'arch.state.live')}</text>
              </g>
            )
          })}
          {hub && (
            <g data-arch-node="hub" className="cursor-pointer" onClick={() => setOpenId('hub')} role="button" tabIndex={0}>
              <ellipse cx={CX} cy={CY} rx={76} ry={48} fill="var(--accent)" stroke={openId === 'hub' ? 'var(--foreground)' : 'var(--accent)'} strokeWidth={2} />
              <text x={CX} y={CY - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--accent-foreground)">{hub.name}</text>
              <text x={CX} y={CY + 14} textAnchor="middle" fontSize={10} fill="var(--accent-foreground)" opacity={0.85}>{t('arch.hubSub')}</text>
            </g>
          )}
        </svg>
        <ul className="text-muted-foreground mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-2xs">
          <li className="flex items-center gap-1.5"><span className="bg-muted-foreground h-px w-5" aria-hidden />{t('arch.state.live')}</li>
          <li className="flex items-center gap-1.5"><span className="border-muted-foreground h-0 w-5 border-t border-dashed" aria-hidden />{t('arch.state.planned')}</li>
          <li className="flex items-center gap-1.5"><ArrowLeftRight className="size-3" aria-hidden />{t('arch.clickHint')}</li>
        </ul>
      </section>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-[460px]" data-drawer="module">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">{open.name}<span className={cn('rounded-xs px-1.5 py-0.5 text-2xs font-medium', open.state === 'live' ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')}>{t(`arch.state.${open.state}` as I18nKey)}</span></SheetTitle>
                <SheetDescription>{open.detail}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4 text-xs">
                <p className="flex items-center gap-2"><Direction d={open.direction} />{t(`arch.direction.${open.direction}` as I18nKey)}</p>
                <div>
                  <p className="eyebrow text-muted-foreground">{t('arch.exchanges')}</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {open.exchanges.map((x) => <li key={x} className="bg-muted rounded-md px-3 py-1.5">{x}</li>)}
                  </ul>
                </div>
                <p className="text-muted-foreground">{t(open.state === 'live' ? 'arch.liveNote' : 'arch.plannedNote')}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Direction({ d }: { d: ArchModule['direction'] }) {
  const Icon = d === 'both' ? ArrowLeftRight : d === 'in' ? ArrowLeft : ArrowRight
  return <Icon className="text-accent-text size-3.5" aria-hidden />
}
