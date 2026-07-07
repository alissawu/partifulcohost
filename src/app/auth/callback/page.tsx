'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const [status, setStatus] = useState('Processing...')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const processToken = async () => {
      const hash = window.location.hash
      if (!hash.includes('token=')) {
        setError('No token found')
        return
      }

      const token = decodeURIComponent(hash.split('token=')[1])
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please log in first')
        setTimeout(() => router.push('/'), 2000)
        return
      }

      setStatus('Linking your Partiful account...')

      try {
        const res = await fetch('/api/auth/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            cohost_user_id: user.id,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to link account')
        }

        setStatus('Success! Redirecting...')
        setTimeout(() => router.push('/'), 1500)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link account')
      }
    }

    processToken()
  }, [supabase.auth, router])

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
      {error ? (
        <>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-[#8B5BA5] hover:underline"
          >
            Go back
          </button>
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">{status}</p>
      )}
    </div>
  )
}
