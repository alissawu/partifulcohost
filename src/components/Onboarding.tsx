'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCosignStore } from '@/lib/store'
import { Auth } from './Auth'
import { LinkPartiful } from './LinkPartiful'
import type { User } from '@supabase/supabase-js'

type Step = 'auth' | 'link_partiful' | 'choose' | 'create' | 'join'

export function Onboarding() {
  const [step, setStep] = useState<Step>('auth')
  const [user, setUser] = useState<User | null>(null)
  const [partifulLinked, setPartifulLinked] = useState(false)
  const [eventName, setEventName] = useState('')
  const [partifulUrl, setPartifulUrl] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdAccessCode, setCreatedAccessCode] = useState('')

  const { setSession, fetchGuests } = useCosignStore()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // Check if Partiful is already linked
        const res = await fetch(`/api/user/profile?user_id=${user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.partiful_user_id) {
            setPartifulLinked(true)
            setStep('choose')
          } else {
            setStep('link_partiful')
          }
        } else {
          setStep('link_partiful')
        }
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user && step === 'auth') {
        // Check if Partiful linked
        const res = await fetch(`/api/user/profile?user_id=${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.partiful_user_id) {
            setPartifulLinked(true)
            setStep('choose')
          } else {
            setStep('link_partiful')
          }
        } else {
          setStep('link_partiful')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, step])

  const handleAuthSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setStep('link_partiful')
    }
  }

  const handlePartifulLinked = (partifulUserId: string) => {
    setPartifulLinked(true)
    setStep('choose')
  }

  const extractEventId = (url: string): string | null => {
    const match = url.match(/partiful\.com\/e\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError('')

    const partifulEventId = extractEventId(partifulUrl)
    if (!partifulEventId) {
      setError('Invalid Partiful URL. Should be like partiful.com/e/abc123')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partiful_event_id: partifulEventId,
          name: eventName,
          user_id: user.id,
          host_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Host',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')

      // Save the access code to show
      setCreatedAccessCode(data.access_code)

      // Sync guests from Partiful
      await fetch('/api/sync/partiful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: data.event.id,
          partiful_event_id: partifulEventId,
        }),
      })

      setSession(data.event, data.host)
      await fetchGuests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_code: accessCode.trim(),
          user_id: user.id,
          host_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Host',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'PARTIFUL_NOT_LINKED') {
          setStep('link_partiful')
          return
        }
        throw new Error(data.error || 'Failed to join event')
      }

      setSession(data.event, data.host)
      await fetchGuests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-2">Cosign</h1>
        <p className="text-[var(--color-text-muted)] mb-8">Multi-host guest vetting</p>
        <Auth onSuccess={handleAuthSuccess} />
      </div>
    )
  }

  if (step === 'link_partiful') {
    return <LinkPartiful onLinked={handlePartifulLinked} />
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-2">Hey {user?.user_metadata?.name || 'there'}</h1>
        <p className="text-[var(--color-text-muted)] mb-8">What would you like to do?</p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => setStep('create')}
            className="w-full py-4 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create new event
          </button>
          <button
            onClick={() => setStep('join')}
            className="w-full py-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Join with access code
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mt-4"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <button
          onClick={() => setStep('choose')}
          className="absolute top-4 left-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back
        </button>
        
        <h1 className="text-2xl font-semibold mb-8">Create event</h1>
        
        <form onSubmit={handleCreate} className="w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder="Event name"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <input
            type="text"
            placeholder="Partiful event URL"
            value={partifulUrl}
            onChange={(e) => setPartifulUrl(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Paste your Partiful event link, like partiful.com/e/abc123
          </p>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create & sync guests'}
          </button>
        </form>
      </div>
    )
  }

  // Join step
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
      <button
        onClick={() => setStep('choose')}
        className="absolute top-4 left-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        ← Back
      </button>
      
      <h1 className="text-2xl font-semibold mb-8">Join event</h1>
      
      <form onSubmit={handleJoin} className="w-full max-w-sm space-y-4">
        <input
          type="text"
          placeholder="Access code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          required
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-center text-lg tracking-wider"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join'}
        </button>
      </form>
    </div>
  )
}
