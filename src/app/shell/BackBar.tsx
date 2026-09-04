import { useLocation, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../auth'
import { homeFor, navFor } from '../nav'
import { useT } from '@/i18n'

/**
 * The way back out of a record.
 *
 * Only on records (an order, a proof of delivery). It goes back the way you
 * came, and only falls back to the acting role's home when there is nowhere
 * to go back to — a deep link, a refresh, or the first page of the session.
 */
const RECORD = [/^\/orders\/[^/]+$/, /^\/epod\/[^/]+$/]

export function BackBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const t = useT()

  if (!session || !RECORD.some((r) => r.test(pathname))) return null

  const home = homeFor(session.role, session.stakeholderKind)
  const homeItem = navFor(session.role).flatMap((g) => g.items).find((i) => i.to === home)
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const canGoBack = idx > 0

  return (
    <div className="shrink-0 px-4 pt-3 md:px-6">
      <button
        type="button"
        data-back-bar
        onClick={() => (canGoBack ? navigate(-1) : navigate(home))}
        className="text-muted-foreground hover:text-foreground hover:bg-hover-tint focus-visible:ring-ring -ml-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {canGoBack || !homeItem ? t('chrome.back') : t('chrome.backTo', { page: t(homeItem.labelKey) })}
      </button>
    </div>
  )
}
