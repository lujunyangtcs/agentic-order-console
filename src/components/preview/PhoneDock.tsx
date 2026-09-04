import { useLocation } from 'react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePhone } from '@/app/phone'
import { useLang } from '@/i18n'

/**
 * The same route, in a phone, beside the desktop view.
 *
 * It is a real iframe of this app with `?embed=1`, so the phone chrome, the
 * media queries and the map all behave as they would on a device — nothing
 * is duplicated. The mock store broadcasts every change, so a click on the
 * desktop shows up in the phone without a refresh.
 */
export function PhoneDock() {
  const { open, setOpen } = usePhone()
  const { pathname, search } = useLocation()
  const { t, lang } = useLang()
  if (!open) return null
  const params = new URLSearchParams(search)
  params.set('embed', '1')
  params.set('lang', lang)
  const src = `${pathname}?${params.toString()}`

  return (
    <aside data-phone-dock className="border-structural-border bg-muted/40 relative hidden w-[440px] shrink-0 flex-col items-center border-l px-6 pt-3 pb-5 xl:flex">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => setOpen(false)} aria-label={t('common.close')} title={t('chrome.phone')} data-phone-close><X className="size-4" aria-hidden /></Button>
      <div className="border-rail mt-8 overflow-hidden rounded-xl border-[10px] bg-black shadow-lg" style={{ width: 390 + 20, height: 760 + 20 }}>
        <iframe key={src} src={src} title={t('chrome.phone')} width={390} height={760} className="block bg-white" data-phone-frame />
      </div>
    </aside>
  )
}
