import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * ProtectedRoute Component
 * Prevents unauthorized users from accessing the dashboard without authentication or guest access.
 */
export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Check guest mode in localStorage first
      const isGuest = localStorage.getItem('docmind_guest') === 'true'
      if (isGuest) {
        setAuthorized(true)
        setLoading(false)
        return
      }

      // 2. Check current Supabase auth session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setAuthorized(true)
      } else {
        setAuthorized(false)
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-3 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-xs text-neutral-450 font-semibold animate-pulse">Checking credentials...</p>
      </div>
    )
  }

  if (!authorized) {
    return <Navigate to="/" replace />
  }

  return children
}
