import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ShieldCheck, Ticket as TicketIcon, UserPlus } from 'lucide-react'
import { api } from '@/services'
import type { NewUser } from '@/services'
import type { Role, StakeholderKind, Ticket, User } from '@/types/domain'
import { PageHeader } from '@/components/shell/PageHeader'
import { Panel } from '@/components/dashboard/Panel'
import { DataTable, type ColumnDef } from '@/components/table/DataTable'
import { LoadingRows } from '@/components/state/States'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useActor } from '@/app/useActor'
import { ALL_ROLES } from '@/app/permissions'
import { SYSTEMS } from '@/app/product'
import { STAKEHOLDER_KINDS } from '@/types/domain'
import { formatDateTime } from '@/fixtures/calendar'
import { kindKey, roleNameKey, useLang } from '@/i18n'
import { cn } from '@/lib/utils'

const REGIONS: NewUser['region'][] = ['ALL', 'ECAN', 'WCAN']
const FIELD = 'border-border bg-background text-foreground h-9 w-full rounded-md border px-2 text-sm'

/**
 * Who can sign in, as what. Adding a person creates the account and the
 * service ticket that records why, in the same click — the ticket card is
 * the proof that the access request went through the proper channel.
 */
export function UsersRoute() {
  const { t, lang } = useLang()
  const qc = useQueryClient()
  const actor = useActor()
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<{ user: User; ticket: Ticket } | null>(null)
  const [draft, setDraft] = useState<NewUser>({ name: '', email: '', role: 'CVC User', region: 'ALL' })

  const users = useQuery({ queryKey: ['users'], queryFn: () => api.admin.users() })
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => api.admin.tickets() })
  const create = useMutation({
    mutationFn: () => api.admin.createUser({ ...draft, name: draft.name.trim(), email: draft.email.trim() }, actor),
    onSuccess: (res) => { setCreated(res); toast.success(t('users.created', { name: res.user.name, key: res.ticket.key })); qc.invalidateQueries() },
  })
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.admin.setRole(userId, role, actor),
    onSuccess: (u) => { toast.success(t('users.roleChanged', { name: u.name, role: t(roleNameKey(u.role)) })); qc.invalidateQueries() },
  })

  const rows = users.data ?? []
  const ticketById = new Map((tickets.data ?? []).map((tk) => [tk.id, tk]))

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { key: 'name', header: t('users.name'), width: '200px', pinned: 'left', sortValue: (r) => r.name, render: (r) => <span className="text-xs font-medium">{r.name}</span> },
    { key: 'email', header: t('login.email'), width: '240px', render: (r) => <span className="text-muted-foreground text-xs">{r.email}</span> },
    { key: 'role', header: t('users.role'), width: '210px', sortValue: (r) => r.role, render: (r) => (
      <select value={r.role} onChange={(e) => setRole.mutate({ userId: r.id, role: e.target.value as Role })} onClick={(e) => e.stopPropagation()} className="border-border bg-background h-8 rounded-md border px-1.5 text-xs" data-user-role={r.id} aria-label={t('users.role')}>
        {ALL_ROLES.map((role) => <option key={role} value={role}>{t(roleNameKey(role))}{role === 'Other Stakeholder' && r.stakeholderKind ? ` · ${t(kindKey(r.stakeholderKind))}` : ''}</option>)}
      </select>
    ) },
    { key: 'region', header: t('users.region'), width: '110px', sortValue: (r) => r.region, render: (r) => <span className="text-xs">{t(`users.region.${r.region}` as 'users.region.ALL')}</span> },
    { key: 'mfa', header: t('users.mfa'), width: '130px', sortValue: (r) => (r.mfaEnrolled ? 1 : 0), render: (r) => (
      <span className={cn('inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium', r.mfaEnrolled ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground')}>
        {r.mfaEnrolled && <ShieldCheck className="size-3" aria-hidden />}{r.mfaEnrolled ? t('users.enrolled') : t('users.notEnrolled')}
      </span>
    ) },
    { key: 'ticket', header: t('users.ticket'), width: '150px', pinned: 'right', render: (r) => { const tk = r.ticketId ? ticketById.get(r.ticketId) : null; return tk ? <span className="font-mono text-2xs">{tk.system} {tk.key}</span> : <span className="text-muted-foreground text-2xs">—</span> } },
  ], [t, setRole, ticketById])

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.users.title')}
        description={t('page.users.desc')}
        action={<Button onClick={() => { setCreated(null); setDraft({ name: '', email: '', role: 'CVC User', region: 'ALL' }); setAdding(true) }} data-user-add data-variant="primary"><UserPlus className="size-4" aria-hidden />{t('users.add')}</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-stretch">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span>{t('users.count', { n: rows.length })}</span>
            <span>{t('users.activeCount', { n: rows.filter((r) => r.active).length })}</span>
            <span>{t('users.mfaCount', { n: rows.filter((r) => r.mfaEnrolled).length })}</span>
          </div>
          {users.isLoading ? <LoadingRows rows={6} /> : (
            <DataTable name="users" rows={rows} columns={columns} rowKey={(r) => r.id} maxHeight={480} empty={t('common.empty')} />
          )}
        </section>

        <Panel title={t('users.tickets')} className="h-full">
          {(tickets.data ?? []).length === 0 ? <p className="text-muted-foreground text-xs">{t('common.empty')}</p> : (
            <ul className="divide-border divide-y">
              {(tickets.data ?? []).slice(0, 8).map((tk) => (
                <li key={tk.id} className="flex items-start gap-2 py-2 text-xs" data-ticket={tk.key}>
                  <TicketIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{tk.system} · <span className="font-mono">{tk.key}</span></span>
                    <span className="text-muted-foreground block text-2xs">{tk.subject} · {formatDateTime(tk.createdAt, lang)}</span>
                  </span>
                  <span className={cn('shrink-0 rounded-xs px-1.5 py-0.5 text-2xs font-medium', tk.state === 'approved' || tk.state === 'closed' ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-status-pending-bg text-sev-high-on-bg')}>{t(`users.ticket.${tk.state}` as 'users.ticket.open')}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent side="right" className="w-full sm:max-w-[500px]" data-drawer="add-user">
          <SheetHeader>
            <SheetTitle>{t('users.add')}</SheetTitle>
            <SheetDescription>{t('users.addDesc', { system: SYSTEMS.itsm })}</SheetDescription>
          </SheetHeader>
          {created ? (
            <div className="flex flex-col gap-4 px-4 pb-4" data-user-created>
              <div className="border-verdict-pass bg-verdict-pass-bg flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs">
                <Check className="text-verdict-pass mt-0.5 size-4 shrink-0" aria-hidden />
                <span><span className="block font-medium">{t('users.createdTitle', { name: created.user.name })}</span><span className="text-muted-foreground block">{created.user.email} · {t(roleNameKey(created.user.role))}</span></span>
              </div>
              <div className="border-structural-border bg-surface rounded-md border p-3 text-xs" data-ticket-card>
                <p className="eyebrow text-muted-foreground">{created.ticket.system}</p>
                <p className="mt-1 font-mono text-sm font-semibold">{created.ticket.key}</p>
                <p className="mt-1">{created.ticket.subject}</p>
                <p className="text-muted-foreground mt-1 text-2xs">{t(`users.ticket.${created.ticket.state}` as 'users.ticket.open')} · {formatDateTime(created.ticket.createdAt, lang)}</p>
              </div>
              <Button variant="outline" onClick={() => setAdding(false)}>{t('common.close')}</Button>
            </div>
          ) : (
            <form className="flex flex-col gap-3 px-4 pb-4" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
              <label className="grid gap-1 text-xs"><span className="text-muted-foreground">{t('users.name')}</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} data-user-name required /></label>
              <label className="grid gap-1 text-xs"><span className="text-muted-foreground">{t('login.email')}</span><input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={FIELD} data-user-email required /></label>
              <label className="grid gap-1 text-xs"><span className="text-muted-foreground">{t('users.role')}</span>
                <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role, stakeholderKind: e.target.value === 'Other Stakeholder' ? 'sales' : undefined })} className={FIELD} data-user-role-select>
                  {ALL_ROLES.map((role) => <option key={role} value={role}>{t(roleNameKey(role))}</option>)}
                </select>
              </label>
              {draft.role === 'Other Stakeholder' && (
                <label className="grid gap-1 text-xs"><span className="text-muted-foreground">{t('users.kind')}</span>
                  <select value={draft.stakeholderKind ?? 'sales'} onChange={(e) => setDraft({ ...draft, stakeholderKind: e.target.value as StakeholderKind })} className={FIELD} data-user-kind>
                    {STAKEHOLDER_KINDS.map((k) => <option key={k} value={k}>{t(kindKey(k))}</option>)}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-xs"><span className="text-muted-foreground">{t('users.region')}</span>
                <select value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value as NewUser['region'] })} className={FIELD} data-user-region>
                  {REGIONS.map((r) => <option key={r} value={r}>{t(`users.region.${r}` as 'users.region.ALL')}</option>)}
                </select>
              </label>
              <p className="text-muted-foreground text-2xs">{t('users.ticketNote', { system: SYSTEMS.itsm })}</p>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={!draft.name.trim() || !draft.email.trim() || create.isPending} data-user-create data-variant="primary"><UserPlus className="size-3.5" aria-hidden />{t('users.create')}</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
