'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PENDING_EVENT_URL_KEY = 'cohost_pending_event_url'

export default function AuthCallback() {
  const [status, setStatus] = useState('Processing...')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const extractEventId = (url: string): string | null => {
    const match = url.match(/partiful\.com\/e\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

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

      // Get event URL from localStorage
      const storedEventUrl = localStorage.getItem(PENDING_EVENT_URL_KEY)
      const eventId = storedEventUrl ? extractEventId(storedEventUrl) : null

      if (!eventId) {
        setError('No event URL found. Please go back and enter your Partiful event URL.')
        return
      }

      setStatus('Linking your Partiful account...')

      try {
        // Link Partiful account
        const linkRes = await fetch('/api/auth/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            cohost_user_id: user.id,
          }),
        })

        const linkData = await linkRes.json()
        if (!linkRes.ok) {
          throw new Error(linkData.error || 'Failed to link account')
        }

        setStatus('Creating event...')

        // Create event
        const eventRes = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partiful_event_id: eventId,
            name: 'My Event',
            user_id: user.id,
            host_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Host',
          }),
        })

        const eventData = await eventRes.json()
        if (!eventRes.ok) {
          throw new Error(eventData.error || 'Failed to create event')
        }

        setStatus('Syncing guest list...')

        // Sync guests
        await fetch('/api/sync/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventData.event.id,
            partiful_event_id: eventId,
            token,
          }),
        })

        // Clear stored event URL
        localStorage.removeItem(PENDING_EVENT_URL_KEY)

        // Store access code to show on redirect
        localStorage.setItem('cohost_created_access_code', eventData.access_code)

        setStatus('Success! Redirecting...')
        setTimeout(() => router.push('/?created=true'), 1000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
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
