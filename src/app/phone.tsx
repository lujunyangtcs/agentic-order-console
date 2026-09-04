import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

const KEY = 'aoc.phone.v1'

interface PhoneValue {
  open: boolean
  setOpen: (o: boolean) => void
  toggle: () => void
}

const PhoneContext = createContext<PhoneValue | null>(null)

/** Whether the phone preview column is showing. Remembered for the session
 *  so a presenter who opened it keeps it across page changes and reloads. */
export function PhoneProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const setOpen = useCallback((o: boolean) => {
    setOpenState(o)
    try {
      sessionStorage.setItem(KEY, o ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])
  const value = useMemo(() => ({ open, setOpen, toggle: () => setOpen(!open) }), [open, setOpen])
  return <PhoneContext value={value}>{children}</PhoneContext>
}

export function usePhone(): PhoneValue {
  const v = use(PhoneContext)
  if (!v) throw new Error('usePhone must be used inside <PhoneProvider>')
  return v
}
