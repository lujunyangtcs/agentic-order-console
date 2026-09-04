import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { api } from '@/services'
import { PageHeader } from '@/components/shell/PageHeader'
import { EmptyState } from '@/components/state/States'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useActor } from '@/app/useActor'
import { ALL_ROLES } from '@/app/permissions'
import { EXTRA_TRIGGERS, ORDER_STATUSES, type Channel, type NotificationRule, type Priority, type Role, type RuleTrigger } from '@/types/domain'
import { roleNameKey, statusKey, useT, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const CHANNELS: Channel[] = ['email', 'portal', 'sms']

function triggerKey(tr: RuleTrigger): I18nKey {
  return (EXTRA_TRIGGERS as readonly string[]).includes(tr) ? (`rules.trigger.${tr}` as I18nKey) : statusKey(tr as never)
}

function blank(): NotificationRule {
  return { id: `RULE-${Date.now().toString(36)}`, name: '', trigger: 'in_transit', conditions: {}, audience: 'Customer', channels: ['email', 'portal'], enabled: true }
}

/**
 * Who is told what, when. A rule is a sentence with four blanks — when,
 * if, notify, via — and the console evaluates it on every status change.
 */
export function RulesRoute() {
  const t = useT()
  const qc = useQueryClient()
  const actor = useActor()
  const [editing, setEditing] = useState<NotificationRule | null>(null)
  void actor

  const rules = useQuery({ queryKey: ['rules'], queryFn: () => api.notifications.rules() })
  const save = useMutation({
    mutationFn: (r: NotificationRule) => api.notifications.saveRule(r),
    onSuccess: () => { toast.success(t('rules.saved')); setEditing(null); qc.invalidateQueries() },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.notifications.deleteRule(id),
    onSuccess: () => { toast.success(t('rules.deleted')); qc.invalidateQueries() },
  })

  const list = rules.data ?? []

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.rules.title')}
        description={t('page.rules.desc')}
        action={<Button size="sm" onClick={() => setEditing(blank())} data-rule-new><Plus className="size-3.5" aria-hidden />{t('rules.new')}</Button>}
      />

      {list.length === 0 ? (
        <EmptyState title={t('rules.empty')} />
      ) : (
        <ul className="border-structural-border bg-surface divide-border divide-y rounded-lg border">
          {list.map((r) => (
            <li key={r.id} data-rule={r.id} className={cn('flex items-center gap-4 px-5 py-3', !r.enabled && 'opacity-60')}>
              <Bell className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('rules.preview', {
                    audience: t(roleNameKey(r.audience)),
                    channels: r.channels.map((c) => t(`notifications.channel.${c}` as I18nKey)).join(' + '),
                    trigger: t(triggerKey(r.trigger)).toLowerCase(),
                  })}
                  {r.conditions.priorityAtLeast ? ` · ${t(r.conditions.priorityAtLeast === 'urgent' ? 'rules.condition.urgent' : 'rules.condition.priority')}` : ''}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={r.enabled}
                data-rule-toggle={r.id}
                onClick={() => save.mutate({ ...r, enabled: !r.enabled })}
                className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', r.enabled ? 'bg-accent' : 'bg-structural-border')}
              >
                <span className={cn('absolute top-0.5 size-4 rounded-full bg-white transition-transform', r.enabled ? 'left-4.5' : 'left-0.5')} />
              </button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(r)} data-rule-edit={r.id}>{t('rules.edit')}</Button>
              <Button size="sm" variant="ghost" aria-label={t('rules.delete')} onClick={() => remove.mutate(r.id)} data-rule-delete={r.id}><Trash2 className="size-3.5" aria-hidden /></Button>
            </li>
          ))}
        </ul>
      )}

      <RuleDialog rule={editing} onClose={() => setEditing(null)} onSave={(r) => save.mutate(r)} busy={save.isPending} />
    </div>
  )
}

function RuleDialog({ rule, onClose, onSave, busy }: { rule: NotificationRule | null; onClose: () => void; onSave: (r: NotificationRule) => void; busy: boolean }) {
  const t = useT()
  const [draft, setDraft] = useState<NotificationRule>(blank())
  useEffect(() => { if (rule) setDraft(rule) }, [rule])
  const triggers: RuleTrigger[] = [...ORDER_STATUSES, ...EXTRA_TRIGGERS]
  const cond = draft.conditions.priorityAtLeast ?? 'none'
  const selectClass = 'border-border bg-background text-foreground h-9 w-full rounded-md border px-2 text-xs'

  return (
    <Dialog open={!!rule} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-dialog="rule">
        <DialogHeader>
          <DialogTitle>{rule?.name ? t('rules.edit') : t('rules.new')}</DialogTitle>
          <DialogDescription>{t('page.rules.desc')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">{t('rules.name')}</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={selectClass} data-rule-name />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('rules.when')}</span>
              <select value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value as RuleTrigger })} className={selectClass} data-rule-trigger>
                {triggers.map((tr) => <option key={tr} value={tr}>{t(triggerKey(tr))}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('rules.if')}</span>
              <select value={cond} onChange={(e) => setDraft({ ...draft, conditions: e.target.value === 'none' ? {} : { priorityAtLeast: e.target.value as Priority } })} className={selectClass} data-rule-condition>
                <option value="none">{t('rules.condition.none')}</option>
                <option value="priority">{t('rules.condition.priority')}</option>
                <option value="urgent">{t('rules.condition.urgent')}</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('rules.notify')}</span>
              <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Role })} className={selectClass} data-rule-audience>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{t(roleNameKey(r))}</option>)}
              </select>
            </label>
            <div className="grid gap-1 text-xs">
              <span className="text-muted-foreground">{t('rules.via')}</span>
              <div className="flex h-9 items-center gap-3">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={draft.channels.includes(c)} data-rule-channel={c} onChange={(e) => setDraft({ ...draft, channels: e.target.checked ? [...draft.channels, c] : draft.channels.filter((x) => x !== c) })} />
                    {t(`notifications.channel.${c}` as I18nKey)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-xs" data-rule-preview>
            {t('rules.preview', { audience: t(roleNameKey(draft.audience)), channels: draft.channels.map((c) => t(`notifications.channel.${c}` as I18nKey)).join(' + ') || '—', trigger: t(triggerKey(draft.trigger)).toLowerCase() })}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={busy || !draft.name.trim() || draft.channels.length === 0} onClick={() => onSave(draft)} data-rule-save>{t('common.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
