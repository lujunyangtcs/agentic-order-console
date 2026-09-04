import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Check, KeyRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/brand/BrandMark'
import { LangToggle } from '@/app/shell/LangToggle'
import { DEMO_IDENTITY, useAuth } from '@/app/auth'
import { ALL_ROLES } from '@/app/permissions'
import { homeFor } from '@/app/nav'
import { api } from '@/services'
import { roleNameKey, rolePurposeKey, useT } from '@/i18n'
import type { Role } from '@/types/domain'
import { cn } from '@/lib/utils'

const MFA_CODE = ['4', '8', '2', '9', '1', '7']

/**
 * One sign-in for every hat.
 *
 * Staff arrive through single sign-on: the email types itself and the SSO
 * chip turns green. Customers sign in with a password and a six-digit code,
 * which is what the requirements ask for — so choosing the Customer role
 * adds the code step. No credentials are typed by hand or stored.
 */
export function LoginRoute() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const security = useQuery({ queryKey: ['security'], queryFn: () => api.admin.security() })

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('CVC User')
  const [step, setStep] = useState<'identity' | 'mfa'>('identity')
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const timers = useRef<number[]>([])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setEmail(DEMO_IDENTITY.email)
      return
    }
    const target = DEMO_IDENTITY.email
    for (let i = 1; i <= target.length; i += 1) {
      timers.current.push(window.setTimeout(() => setEmail(target.slice(0, i)), 250 + i * 28))
    }
    return () => timers.current.forEach(clearTimeout)
  }, [])

  if (session) return <Navigate to={homeFor(session.role, session.stakeholderKind)} replace />

  const typed = email === DEMO_IDENTITY.email
  const needsMfa = role === 'Customer' && (security.data?.mfaRequired ?? true)
  const codeComplete = code.every(Boolean)

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
    MFA_CODE.forEach((digit, i) => {
      window.setTimeout(() => {
        setCode((prev) => {
          const next = [...prev]
          next[i] = digit
          return next
        })
      }, 90 * i)
    })
  }

  return (
    <div className="bg-background flex min-h-full flex-col lg:flex-row">
      <aside className="bg-primary text-primary-foreground flex flex-col justify-between px-8 py-8 lg:w-[42%] lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="text-sm font-semibold tracking-tight">{t('app.short')}</span>
        </div>
        <div className="mt-10 lg:mt-0">
          <h1 className="display text-2xl leading-tight font-semibold lg:text-4xl">{t('app.name')}</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">{t('login.subtitle')}</p>
        </div>
        <p className="mt-10 text-2xs opacity-60 lg:mt-0">{t('login.footnote')}</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-8 md:px-8">
        <div className="border-border bg-surface w-full max-w-lg rounded-lg border p-6 md:p-8" style={{ animation: 'card-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              {step === 'identity' ? t('login.title') : t('login.mfa')}
            </h2>
            <LangToggle />
          </div>

          {step === 'identity' ? (
            <>
              <label htmlFor="login-email" className="text-muted-foreground mt-6 block text-xs font-medium">
                {t('login.email')}
              </label>
              <div className="border-border bg-background mt-1.5 flex h-10 items-center gap-2 rounded-md border px-3">
                <input
                  id="login-email"
                  value={email}
                  readOnly
                  className="text-foreground min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
                  aria-describedby="login-sso"
                />
                <span
                  id="login-sso"
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium transition-colors duration-300',
                    typed ? 'bg-verdict-pass-bg text-verdict-pass' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <ShieldCheck className="size-3" aria-hidden />
                  {t('login.sso')}
                </span>
              </div>

              <div className="text-muted-foreground mt-6 text-xs font-medium">{t('login.chooseRole')}</div>
              <div role="radiogroup" aria-label={t('login.chooseRole')} className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    data-login-role={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      'flex h-full flex-col rounded-md border px-3 py-2.5 text-left transition-colors duration-150',
                      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                      role === r ? 'border-accent bg-muted' : 'border-border hover:bg-hover-tint',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Check className={cn('text-accent-text size-3.5', role !== r && 'opacity-0')} aria-hidden />
                      {t(roleNameKey(r))}
                    </span>
                    <span className="text-muted-foreground mt-0.5 pl-5 text-2xs leading-snug">{t(rolePurposeKey(r))}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mt-3 text-sm">{t('login.mfaHint')}</p>
              <div className="mt-5 flex gap-2" role="group" aria-label={t('login.mfa')}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(-1)
                      setCode((prev) => prev.map((d, j) => (j === i ? v : d)))
                    }}
                    aria-label={`Digit ${i + 1}`}
                    className="border-border bg-background text-foreground focus:border-accent h-12 w-full rounded-md border text-center font-mono text-xl outline-none"
                  />
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={fillCode} data-login-fill-code>
                <KeyRound className="size-3.5" aria-hidden />
                {t('login.useCode')}
              </Button>
            </>
          )}

          <Button
            type="button"
            className="mt-7 w-full"
            size="lg"
            disabled={step === 'identity' ? !typed : !codeComplete}
            onClick={onContinue}
            data-login-continue
          >
            {t('login.continue')}
          </Button>
        </div>
      </main>
    </div>
  )
}
