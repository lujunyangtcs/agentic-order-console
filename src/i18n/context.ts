import { createContext } from 'react'
import type { I18nKey } from './en'

export type Lang = 'en' | 'fr'

export interface LangValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: I18nKey, params?: Record<string, string | number>) => string
}

/**
 * Lives apart from the provider on purpose: this file imports no dictionary,
 * so editing a translation hot-reloads the provider without minting a new
 * context object that mounted consumers would no longer recognise.
 */
export const LangContext = createContext<LangValue | null>(null)
