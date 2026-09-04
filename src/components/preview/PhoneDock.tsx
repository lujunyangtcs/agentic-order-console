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
    <aside data-phone-dock className="border-structural-border bg-muted/40 hidden w-[440px] shrink-0 flex-col items-center border-l px-6 py-5 xl:flex">
      <div className="flex w-full items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{t('chrome.phone')}</p>
          <p className="text-muted-foreground text-2xs">{t('chrome.phoneSub')}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('common.close')} data-phone-close><X className="size-4" aria-hidden /></Button>
      </div>
      <div className="border-rail mt-4 overflow-hidden rounded-xl border-[10px] bg-black shadow-lg" style={{ width: 390 + 20, height: 760 + 20 }}>
        <iframe key={src} src={src} title={t('chrome.phone')} width={390} height={760} className="block bg-white" data-phone-frame />
      </div>
    </aside>
  )
}
