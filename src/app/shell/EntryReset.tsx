import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth'

/**
 * The bare URL is the front door. Whoever types it gets the landing screen,
 * even in a tab that was signed in a minute ago; a deep link to a page keeps
 * its session across a refresh, so a rehearsal survives a reload.
 */
export function EntryReset() {
  const { session, signOut } = useAuth()
  useEffect(() => {
    if (session) signOut()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Navigate to="/login" replace />
}
