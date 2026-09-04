import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, KeyRound, Languages, ShieldCheck, TimerReset } from 'lucide-react'
import { api } from '@/services'
import type { SecurityConfig } from '@/types/domain'
import { PageHeader } from '@/components/shell/PageHeader'
import { useActor } from '@/app/useActor'
import { ALL_ROLES, ROLE_CAPABILITIES, type Capability } from '@/app/permissions'
import { useLang, roleNameKey, type I18nKey } from '@/i18n'
import { cn } from '@/lib/utils'

const SSO: SecurityConfig['ssoProvider'][] = ['entra', 'okta', 'none']
const SESSIONS = [30, 60, 240, 480]
const CAPABILITIES: Capability[] = ['records.read', 'order.assign', 'request.respond', 'status.update', 'yard.load', 'pod.sign', 'pod.upload', 'pod.annotate', 'deviation.file', 'reports.read', 'admin.manage']

/**
 * Four settings that change how people get in, and the matrix of what each
 * role may do once they are. The default language switches the console
 * live, so the administrator sees the effect before leaving the page.
 */
export function SecurityRoute() {
  const { t, setLang } = useLang()
  const qc = useQueryClient()
  const actor = useActor()
  const cfg = useQuery({ queryKey: ['security'], queryFn: () => api.admin.security() })
  const save = useMutation({
    mutationFn: (patch: Partial<SecurityConfig>) => api.admin.setSecurity(patch, actor),
    // Show the new value at once; a checkbox that flips back while the
    // request is in flight reads as a broken control.
    onMutate: (patch) => {
      qc.setQueryData<SecurityConfig>(['security'], (old) => (old ? { ...old, ...patch } : old))
    },
    onSuccess: (next, patch) => {
      toast.success(t('security.saved'))
      if (patch.defaultLanguage) setLang(next.defaultLanguage)
      qc.invalidateQueries({ queryKey: ['security'] })
    },
  })
  const c = cfg.data
  const option = (on: boolean) => cn('rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors', on ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:bg-hover-tint')

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6">
      <PageHeader
        title={t('page.security.title')}
        description={t('page.security.desc')}
        stats={c ? [
          { label: t('security.sso'), value: t(`security.sso.${c.ssoProvider}` as I18nKey) },
          { label: t('security.mfa'), value: c.mfaRequired ? t('security.required') : t('security.optional'), tone: c.mfaRequired ? 'good' : 'attention' },
          { label: t('security.language'), value: c.defaultLanguage === 'fr' ? 'Français' : 'English' },
        ] : [{ label: t('security.sso'), value: '—' }]}
      />

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch" data-card="security">
        <Setting icon={KeyRound} title={t('security.sso')} body={t('security.ssoBody')}>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {SSO.map((p) => <button key={p} role="radio" aria-checked={c?.ssoProvider === p} data-sso={p} disabled={!c} onClick={() => save.mutate({ ssoProvider: p })} className={option(c?.ssoProvider === p)}>{t(`security.sso.${p}` as I18nKey)}</button>)}
          </div>
        </Setting>
        <Setting icon={ShieldCheck} title={t('security.mfa')} body={t('security.mfaBody')}>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={!!c?.mfaRequired} disabled={!c} onChange={(e) => save.mutate({ mfaRequired: e.target.checked })} className="accent-accent size-4" data-mfa-required />
            {t('security.mfaRequire')}
          </label>
        </Setting>
        <Setting icon={TimerReset} title={t('security.session')} body={t('security.sessionBody')}>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {SESSIONS.map((m) => <button key={m} role="radio" aria-checked={c?.sessionMinutes === m} data-session={m} disabled={!c} onClick={() => save.mutate({ sessionMinutes: m })} className={option(c?.sessionMinutes === m)}>{m < 60 ? t('security.minutes', { n: m }) : t('security.hours', { n: m / 60 })}</button>)}
          </div>
        </Setting>
        <Setting icon={Languages} title={t('security.language')} body={t('security.languageBody')}>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {(['en', 'fr'] as const).map((l) => <button key={l} role="radio" aria-checked={c?.defaultLanguage === l} data-default-lang={l} disabled={!c} onClick={() => save.mutate({ defaultLanguage: l })} className={option(c?.defaultLanguage === l)}>{l === 'en' ? 'English' : 'Français'}</button>)}
          </div>
        </Setting>
      </div>

      <section className="border-structural-border bg-surface overflow-x-auto rounded-lg border" data-card="matrix">
        <header className="border-border border-b px-5 py-3.5"><h2 className="text-sm font-semibold">{t('security.matrix')}</h2></header>
        <table className="w-full min-w-[820px] text-xs">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-2 text-left font-medium">{t('security.capability')}</th>
              {ALL_ROLES.map((r) => <th key={r} className="px-3 py-2 text-center font-medium whitespace-nowrap">{t(roleNameKey(r))}</th>)}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => (
              <tr key={cap} className="border-border border-t">
                <td className="px-4 py-2">{t(`security.cap.${cap}` as I18nKey)}</td>
                {ALL_ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center" data-cap={`${cap}:${r}`}>
                    {ROLE_CAPABILITIES[r].includes(cap) ? <Check className="text-verdict-pass mx-auto size-4" aria-label={t('common.yes')} /> : <span className="text-muted-foreground">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Setting({ icon: Icon, title, body, children }: { icon: typeof KeyRound; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="border-structural-border bg-surface flex h-full flex-col rounded-lg border p-5">
      <div className="flex items-start gap-3">
        <Icon className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0"><h2 className="text-sm font-semibold">{title}</h2><p className="text-muted-foreground mt-0.5 text-xs">{body}</p></div>
      </div>
      <div className="mt-auto pt-4">{children}</div>
    </section>
  )
}
