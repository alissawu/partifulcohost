'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCohostStore } from '@/lib/store'
import { Auth } from './Auth'
import { LinkPartiful } from './LinkPartiful'
import type { User } from '@supabase/supabase-js'

type Step = 'auth' | 'link_partiful' | 'choose' | 'join' | 'created'

const PENDING_SIGNUP_KEY = 'cohost_pending_signup'
const SIGNUP_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

interface PendingSignup {
  email: string
  password: string
  name: string
  timestamp: number
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('auth')
  const [user, setUser] = useState<User | null>(null)
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdAccessCode, setCreatedAccessCode] = useState('')

  const { setSession, fetchGuests } = useCohostStore()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      // Check for pending signup in sessionStorage (with expiry)
      const stored = sessionStorage.getItem(PENDING_SIGNUP_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as PendingSignup
        const isExpired = Date.now() - parsed.timestamp > SIGNUP_EXPIRY_MS
        if (!isExpired) {
          setPendingSignup(parsed)
          setStep('link_partiful')
          return
        } else {
          // Clear expired pending signup
          sessionStorage.removeItem(PENDING_SIGNUP_KEY)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // Check if Partiful is already linked
        const res = await fetch(`/api/user/profile?user_id=${user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.partiful_user_id) {
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

  // Login success - user already exists
  const handleAuthSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      // Check if Partiful is linked
      const res = await fetch(`/api/user/profile?user_id=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.partiful_user_id) {
          setStep('choose')
        } else {
          setStep('link_partiful')
        }
      } else {
        setStep('link_partiful')
      }
    }
  }

  // Signup continue - don't create account yet, store data and go to Partiful linking
  const handleSignupContinue = (data: { email: string; password: string; name: string }) => {
    const pending: PendingSignup = { ...data, timestamp: Date.now() }
    sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(pending))
    setPendingSignup(pending)
    setStep('link_partiful')
  }

  // Partiful link complete - NOW create the account
  const handlePartifulComplete = async (data: { partifulUserId: string; eventId: string; token: string }) => {
    setLoading(true)
    setError('')

    try {
      // If we have pending signup, create the account now
      if (pendingSignup) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: pendingSignup.email,
          password: pendingSignup.password,
          options: {
            data: { name: pendingSignup.name }
          }
        })
        if (signUpError) {
          if (signUpError.message?.includes('already registered')) {
            setError('Account already exists. Please log in instead.')
            sessionStorage.removeItem(PENDING_SIGNUP_KEY)
            setPendingSignup(null)
            setStep('auth')
            setLoading(false)
            return
          }
          throw signUpError
        }
        if (!signUpData.user) throw new Error('Failed to create account')

        // Clear pending signup
        sessionStorage.removeItem(PENDING_SIGNUP_KEY)
        setPendingSignup(null)
        setUser(signUpData.user)

        // Link Partiful account
        await fetch('/api/auth/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: data.token,
            cohost_user_id: signUpData.user.id,
          }),
        })

        // Create the event
        const eventRes = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partiful_event_id: data.eventId,
            name: 'My Event',
            user_id: signUpData.user.id,
            host_name: pendingSignup.name,
          }),
        })

        const eventData = await eventRes.json()
        if (!eventRes.ok) throw new Error(eventData.error || 'Failed to create event')

        setCreatedAccessCode(eventData.access_code)

        // Sync guests
        await fetch('/api/sync/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventData.event.id,
            partiful_event_id: data.eventId,
            token: data.token,
          }),
        })

        setSession(eventData.event, eventData.host)
        setStep('created')
      } else if (user) {
        // Existing user adding new event
        const eventRes = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partiful_event_id: data.eventId,
            name: 'My Event',
            user_id: user.id,
            host_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Host',
          }),
        })

        const eventData = await eventRes.json()
        if (!eventRes.ok) throw new Error(eventData.error || 'Failed to create event')

        setCreatedAccessCode(eventData.access_code)

        await fetch('/api/sync/partiful', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventData.event.id,
            partiful_event_id: data.eventId,
            token: data.token,
          }),
        })

        setSession(eventData.event, eventData.host)
        setStep('created')
      }
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
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
        <h1 className="text-2xl font-semibold mb-2">Partiful Cohost</h1>
        <p className="text-[var(--color-text-muted)] mb-8">Multi-host guest vetting</p>
        <Auth onSuccess={handleAuthSuccess} onSignupContinue={handleSignupContinue} />
      </div>
    )
  }

  if (step === 'link_partiful') {
    return (
      <LinkPartiful 
        onComplete={handlePartifulComplete} 
        isNewSignup={!!pendingSignup}
        pendingName={pendingSignup?.name}
      />
    )
  }

  if (step === 'choose') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-2">Hey {user?.user_metadata?.name || 'there'}</h1>
        <p className="text-[var(--color-text-muted)] mb-8">What would you like to do?</p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => setStep('link_partiful')}
            className="w-full py-4 bg-[#6365C0] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Add new event
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
        
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
    )
  }

  if (step === 'created') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-semibold mb-2">Event created!</h1>
        <p className="text-[var(--color-text-muted)] mb-6 text-center">
          Share this code with your co-hosts
        </p>
        
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
          <p className="text-3xl font-mono tracking-widest text-center select-all">
            {createdAccessCode}
          </p>
        </div>
        
        <button
          onClick={() => {
            navigator.clipboard.writeText(createdAccessCode)
          }}
          className="mb-4 px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          Copy code
        </button>
        
        <button
          onClick={async () => {
            await fetchGuests()
          }}
          className="px-6 py-3 bg-[#6365C0] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          View guest list →
        </button>
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
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6365C0] font-mono text-center text-lg tracking-wider"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#6365C0] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join'}
        </button>
      </form>
    </div>
  )
}
