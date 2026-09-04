import { Navigate } from 'react-router'
import { useAuth } from '../auth'
import { homeFor } from '../nav'

/** `/` and every unknown path land on the acting role's home. */
export function HomeRedirect() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={homeFor(session.role, session.stakeholderKind)} replace />
}
