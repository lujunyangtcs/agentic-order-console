import { useMemo } from 'react'
import { useAuth } from './auth'
import type { Actor } from '@/services'
import { CARRIER_BY_ID, CUSTOMER_BY_ID } from '@/fixtures/network'

/** Who is clicking, for audit entries and event actors. */
export function useActor(): Actor {
  const { session } = useAuth()
  return useMemo<Actor>(() => {
    if (!session) return { name: 'Service desk', role: 'CVC User' }
    if (session.role === 'Carrier') return { name: CARRIER_BY_ID[session.carrierId]?.name ?? session.name, role: 'Carrier' }
    if (session.role === 'Customer') return { name: CUSTOMER_BY_ID[session.customerId]?.name ?? session.name, role: 'Customer' }
    return { name: session.name, role: session.role }
  }, [session])
}

/** Scope for notifications and lists: the carrier or customer being acted for. */
export function useScope(): string | undefined {
  const { session } = useAuth()
  if (!session) return undefined
  if (session.role === 'Carrier') return session.carrierId
  if (session.role === 'Customer') return session.customerId
  return undefined
}
