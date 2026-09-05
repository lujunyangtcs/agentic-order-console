import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, ChevronDown, KeyRound, Lock, LogIn, ShieldCheck, User } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BrandMark } from '@/components/brand/BrandMark'
import { DEMO_IDENTITY, useAuth } from '@/app/auth'
import { ALL_ROLES, ROLE_SLUG } from '@/app/permissions'
import { homeFor } from '@/app/nav'
import { api } from '@/services'
import { roleNameKey, useLang, type I18nKey } from '@/i18n'
import type { Role } from '@/types/domain'
import { cn } from '@/lib/utils'

const MFA_CODE = ['4', '8', '2', '9', '1', '7']
const PANELS = [
  { src: '/login/1.jpg', labelKey: 'login.panel.1', dim: 'bg-black/55' },
  { src: '/login/2.jpg', labelKey: 'login.panel.2', dim: 'bg-black/45' },
  { src: '/login/3.jpg', labelKey: 'login.panel.3', dim: 'bg-black/55' },
] as const

/**
 * A landing screen and one sign-in card over a photo triptych.
 *
 * The identity is the same for every hat; the card's dropdown picks the
 * persona, and the three lines under it say what that persona gets. Staff
 * arrive through single sign-on; a customer adds the six-digit code the
 * security settings ask for. No credentials are typed by hand or stored.
 */
export function LoginRoute() {
  const { session, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, lang, setLang } = useLang()
  const security = useQuery({ queryKey: ['security'], queryFn: () => api.admin.security() })

  const [stage, setStage] = useState<'landing' | 'signin'>('landing')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('CVC User')
  const [step, setStep] = useState<'identity' | 'mfa'>('identity')
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (stage !== 'signin') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setEmail(DEMO_IDENTITY.email)
      return
    }
    const target = DEMO_IDENTITY.email
    for (let i = 1; i <= target.length; i += 1) timers.current.push(window.setTimeout(() => setEmail(target.slice(0, i)), 200 + i * 26))
    return () => timers.current.forEach(clearTimeout)
  }, [stage])

  /* /login is always the landing screen: a signed-in tab is signed out here. */
  useEffect(() => {
    if (session) signOut()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typed = email === DEMO_IDENTITY.email
  const needsMfa = role === 'Customer' && (security.data?.mfaRequired ?? true)
  const codeComplete = code.every(Boolean)
  const slug = ROLE_SLUG[role]

  function finish() {
    signIn(role)
    navigate(homeFor(role, 'sales'), { replace: true })
  }
  function onContinue() {
    if (step === 'identity' && needsMfa) {
      setStep('mfa')
      return
    }
    finish()
  }
  function fillCode() {
    MFA_CODE.forEach((digit, i) => window.setTimeout(() => setCode((prev) => prev.map((d, j) => (j === i ? digit : d))), 90 * i))
  }

  return (
    <div className="relative min-h-full w-full overflow-hidden bg-black text-white" data-login-stage={stage}>
      {/* Photo triptych */}
      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-3">
        {PANELS.map((p, i) => (
          <div key={p.src} className={cn('relative h-full overflow-hidden', i > 0 && 'hidden md:block')} style={{ animation: `fade-in 900ms ${i * 120}ms both` }}>
            <img src={p.src} alt="" className="h-full w-full object-cover" />
            <div className={cn('absolute inset-0 transition-colors duration-500', p.dim, stage === 'signin' && 'bg-black/75')} />
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute inset-x-0 bottom-10 text-center text-[11px] font-semibold tracking-[0.3em] text-white/70 uppercase">{t(p.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between px-6 pt-6 md:px-8 md:pt-7">
        <div className="flex items-center gap-3">
          <div className="bg-accent flex size-11 items-center justify-center rounded-md text-white"><BrandMark className="size-6" /></div>
          <div>
            <div className="font-display text-[19px] leading-none font-semibold">{t('app.short')}</div>
            <div className="mt-1 text-[9.5px] font-semibold tracking-[0.22em] text-white/55 uppercase">{t('login.eyebrow')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-white/25 bg-black/30 text-[11px] font-semibold tracking-[0.12em] uppercase backdrop-blur">
            {(['en', 'fr'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} data-lang-option={l} aria-pressed={lang === l} className={cn('px-3 py-2 transition', lang === l ? 'bg-white text-black' : 'text-white/80 hover:text-white')}>{l}</button>
            ))}
          </div>
          {stage === 'landing' ? (
            <button onClick={() => setStage('signin')} data-login-enter className="rounded-md border border-white/25 bg-black/30 px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap uppercase backdrop-blur transition hover:border-white/50">
              {t('login.enter')} <ArrowRight className="ml-1.5 inline size-3.5" aria-hidden />
            </button>
          ) : (
            <button onClick={() => { setStage('landing'); setStep('identity') }} data-login-back className="rounded-md border border-white/25 bg-black/30 px-5 py-2.5 text-[11px] font-semibold tracking-[0.2em] whitespace-nowrap uppercase backdrop-blur transition hover:border-white/50">
              <ArrowLeft className="mr-1.5 inline size-3.5" aria-hidden /> {t('login.back')}
            </button>
          )}
        </div>
      </div>

      {stage === 'landing' ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-accent-bright text-[12px] font-semibold tracking-[0.34em] uppercase" style={{ animation: 'rise-in 600ms 350ms both' }}>{t('login.kicker')}</div>
          <h1 className="font-display mt-4 text-[clamp(44px,7.5vw,104px)] leading-[0.95] font-bold tracking-tight" style={{ animation: 'rise-in 700ms 450ms both' }}>{t('app.name')}</h1>
          <p className="mt-5 max-w-[640px] text-[15px] leading-relaxed text-white/85" style={{ animation: 'rise-in 600ms 600ms both' }}>{t('login.subtitle')}</p>
          <button onClick={() => setStage('signin')} data-login-signin className="bg-accent hover:bg-accent-bright mt-9 inline-flex items-center gap-2.5 rounded-full px-9 py-3.5 text-[12px] font-semibold tracking-[0.2em] text-white uppercase transition" style={{ animation: 'rise-in 550ms 750ms both' }}>
            {t('login.title')} <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto px-6 py-24">
          <div className="text-accent-bright text-[11px] font-semibold tracking-[0.3em] uppercase" style={{ animation: 'rise-in 450ms both' }}>{t('login.workspace')}</div>
          <h2 className="font-display mt-3 text-[52px] leading-none font-bold" style={{ animation: 'rise-in 500ms 80ms both' }}>{step === 'identity' ? t('login.title') : t('login.mfa')}</h2>

          <div className="mt-8 w-[440px] max-w-[92vw] rounded-xl border border-white/15 bg-white/[0.07] p-6 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md" style={{ animation: 'rise-in 550ms 180ms both' }} data-login-card>
            {step === 'identity' ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-md bg-white/10 text-white"><User className="size-5" aria-hidden /></div>
                  <span className="border-accent-bright/60 text-accent-bright rounded-full border px-3 py-1 text-[9.5px] font-semibold tracking-[0.18em] uppercase">{t('login.persona')}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" data-login-role-select aria-label={t('login.chooseRole')} className="mt-4 flex w-full items-center justify-between gap-3 rounded-md border border-white/15 bg-black/35 py-2.5 pr-3 pl-3.5 text-left text-[21px] leading-tight font-semibold text-white outline-none transition hover:border-white/40 focus-visible:border-white/60 data-[state=open]:border-white/60">
                      <span className="truncate">{t(roleNameKey(role))}</span>
                      <ChevronDown className="size-5 shrink-0 text-white/60 transition-transform duration-200 data-[state=open]:rotate-180" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-md border border-white/15 bg-[#0b1220]/95 p-1 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md" data-login-role-menu>
                    {ALL_ROLES.map((r) => (
                      <DropdownMenuItem key={r} onSelect={() => setRole(r)} data-login-role-option={r} className={cn('flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-1.5 text-[14px] font-medium text-white focus:bg-white/10 focus:text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white', role === r && 'bg-white/[0.07]')}>
                        <Check className={cn('size-4 shrink-0 text-accent-bright', role !== r && 'opacity-0')} aria-hidden />
                        <span className="truncate">{t(roleNameKey(r))}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <ul className="mt-3.5 space-y-2" data-login-bullets={slug}>
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-white/80">
                      <span className="bg-accent-bright mt-[6px] size-1.5 shrink-0 rounded-full" aria-hidden />
                      {t(`login.bullet.${slug}.${n}` as I18nKey)}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 space-y-2.5 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/35 px-3.5 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5 font-mono text-[13px]"><User className="size-3.5 shrink-0 text-white/45" aria-hidden /><span className="truncate">{email}</span></span>
                    <span className={cn('flex shrink-0 items-center gap-1 text-[9px] font-semibold tracking-[0.2em] uppercase transition-colors', typed ? 'text-emerald-400' : 'text-white/40')}><ShieldCheck className="size-3" aria-hidden />{t('login.sso')}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/35 px-3.5 py-2.5">
                    <span className="flex items-center gap-2.5 text-[13px] tracking-widest"><Lock className="size-3.5 text-white/45" aria-hidden /> ••••••••••••</span>
                    <span className="text-[9px] font-semibold tracking-[0.2em] text-white/40 uppercase">{t('login.password')}</span>
                  </div>
                  <button onClick={onContinue} disabled={!typed} data-login-continue className="bg-accent hover:bg-accent-bright mt-1 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase transition disabled:opacity-50">
                    <LogIn className="size-4" aria-hidden /> {needsMfa ? t('login.continue') : t('login.title')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-white/80">{t('login.mfaHint')}</p>
                <div className="mt-5 flex gap-2" role="group" aria-label={t('login.mfa')}>
                  {code.map((digit, i) => (
                    <input key={i} inputMode="numeric" maxLength={1} value={digit} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(-1); setCode((prev) => prev.map((d, j) => (j === i ? v : d))) }} aria-label={`Digit ${i + 1}`} className="h-12 w-full rounded-md border border-white/15 bg-black/35 text-center font-mono text-xl text-white outline-none focus:border-white/60" />
                  ))}
                </div>
                <button onClick={fillCode} data-login-fill-code className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase transition hover:border-white/50"><KeyRound className="size-3.5" aria-hidden />{t('login.useCode')}</button>
                <button onClick={onContinue} disabled={!codeComplete} data-login-continue className="bg-accent hover:bg-accent-bright mt-5 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase transition disabled:opacity-50">
                  <LogIn className="size-4" aria-hidden /> {t('login.title')}
                </button>
              </>
            )}
          </div>
          <div className="mt-7 text-center text-[10px] font-semibold tracking-[0.26em] text-white/45 uppercase" style={{ animation: 'fade-in 500ms 400ms both' }}>{t('login.tagline')}</div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-3.5 z-10 text-center text-[9.5px] font-semibold tracking-[0.3em] text-white/35 uppercase">{t('login.footnote')}</div>
    </div>
  )
}
