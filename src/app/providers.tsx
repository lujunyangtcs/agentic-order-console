import { useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from './auth'
import { LangProvider } from '@/i18n'
import { onExternalChange } from '@/services/mock/store'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

/** When another document (the phone preview, or the desktop behind it) writes
 *  to the store, every query here is stale. */
function ExternalStoreSync() {
  const qc = useQueryClient()
  useEffect(() => onExternalChange(() => qc.invalidateQueries()), [qc])
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ExternalStoreSync />
      <LangProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  )
}
