import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Mail, MessageSquare, Smartphone } from 'lucide-react'
import { api } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { StatusChip } from '@/components/status/StatusChip'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/auth'
import { useScope } from '@/app/useActor'
import { formatDate, formatTime, TODAY } from '@/fixtures/calendar'
import { useLang, type I18nKey } from '@/i18n'
import type { Channel } from '@/types/domain'
import { cn } from '@/lib/utils'

const CHANNEL_ICON: Record<Channel, typeof Mail> = { email: Mail, portal: Bell, sms: Smartphone }

/**
 * What the acting role has been told. Every entry came from a rule firing
 * on a real event, and links to the order it fired on.
 */
export function NotificationsRoute() {
  const { t, lang } = useLang()
  const { session } = useAuth()
  const scope = useScope()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const role = session?.role ?? 'CVC User'

  const list = useQuery({ queryKey: ['notifications', role, scope], queryFn: () => api.notifications.list(role, scope) })
  const markRead = useMutation({ mutationFn: (id: string) => api.notifications.markRead(id), onSuccess: () => qc.invalidateQueries() })
  const markAll = useMutation({ mutationFn: () => api.notifications.markAllRead(role, scope), onSuccess: () => qc.invalidateQueries() })

  const rows = (list.data ?? []).filter((n) => filter === 'all' || !n.read)
  const unread = (list.data ?? []).filter((n) => !n.read).length
  const today = (list.data ?? []).filter((n) => n.at.slice(0, 10) === TODAY).length

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.notifications.title')}
        stats={[
          { label: t('notifications.unread'), value: unread, tone: unread ? 'attention' : 'default' },
          { label: t('notifications.today'), value: today },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} type="button" data-filter={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:bg-hover-tint')}>
            {t(f === 'all' ? 'notifications.filter.all' : 'notifications.filter.unread')}
          </button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()} data-mark-all>
          <CheckCheck className="size-3.5" aria-hidden />{t('notifications.markAll')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('notifications.empty')} />
      ) : (
        <ul className="border-structural-border bg-surface divide-border divide-y rounded-lg border">
          {rows.map((n) => (
            <li key={n.id} data-notification={n.id} data-read={n.read} className={cn('flex items-start gap-3 px-4 py-3', !n.read && 'bg-status-scheduled-bg/40')}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-border' : 'bg-accent')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm leading-snug">{t(n.textKey as I18nKey, n.params)}</p>
                <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs">
                  <Link to={`/orders/${n.orderId}`} className="text-accent-text font-mono hover:underline" onClick={() => !n.read && markRead.mutate(n.id)}>{n.erpRef}</Link>
                  <StatusChip status={n.status} />
                  <span className="tabular">{formatDate(n.at, lang)} {formatTime(n.at)}</span>
                  <span className="flex items-center gap-1.5">
                    {n.channels.map((c) => { const Icon = CHANNEL_ICON[c]; return <span key={c} className="flex items-center gap-0.5"><Icon className="size-3" aria-hidden />{t(`notifications.channel.${c}` as I18nKey)}</span> })}
                  </span>
                </p>
              </div>
              {!n.read && (
                <button type="button" onClick={() => markRead.mutate(n.id)} className="text-muted-foreground hover:text-foreground shrink-0 text-2xs" data-mark-read={n.id}>
                  <MessageSquare className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
