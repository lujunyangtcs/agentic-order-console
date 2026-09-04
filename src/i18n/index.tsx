import { use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type I18nKey } from './en'
import { fr } from './fr'
import type { OrderStatus, Priority, Product, Role, StakeholderKind } from '@/types/domain'
import { ROLE_SLUG } from '@/app/permissions'

import { LangContext, type Lang, type LangValue } from './context'

export type { I18nKey, Lang }

const DICT: Record<Lang, Record<I18nKey, string>> = { en, fr }

const KEY = 'aoc.lang.v1'

/**
 * Translate a key in a given language, with `{param}` interpolation.
 *
 * A missing key renders as `[[key]]` rather than throwing, so a screen with
 * one untranslated label still renders — and the marker is what the
 * verification sweep greps for.
 */
export function translate(lang: Lang, key: I18nKey, params?: Record<string, string | number>): string {
  const raw = DICT[lang][key] ?? DICT.en[key]
  if (raw === undefined) return `[[${key}]]`
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] === undefined ? `{${k}}` : String(params[k])))
}


function initial(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'en' || q === 'fr') return q
    const stored = sessionStorage.getItem(KEY)
    if (stored === 'en' || stored === 'fr') return stored
  } catch {
    /* ignore */
  }
  return 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      sessionStorage.setItem(KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: I18nKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LangContext value={value}>{children}</LangContext>
}

export function useLang(): LangValue {
  const v = use(LangContext)
  if (!v) throw new Error('useLang must be used inside <LangProvider>')
  return v
}

/** The translate function alone — what most components need. */
export function useT() {
  return useLang().t
}

// ── enum → label helpers. Stored values are never translated; only labels. ──
export const statusKey = (s: OrderStatus) => `status.${s}` as I18nKey
export const priorityKey = (p: Priority) => `priority.${p}` as I18nKey
export const productKey = (p: Product) => `product.${p}` as I18nKey
export const roleNameKey = (r: Role) => `role.${ROLE_SLUG[r]}.name` as I18nKey
export const rolePurposeKey = (r: Role) => `role.${ROLE_SLUG[r]}.purpose` as I18nKey
export const kindKey = (k: StakeholderKind) => `kind.${k}` as I18nKey
