'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCohostStore } from '@/lib/store'
import { Auth } from './Auth'
import { LinkPartiful } from './LinkPartiful'
import type { User } from '@supabase/supabase-js'

type Step = 'auth' | 'link_partiful' | 'dashboard' | 'created'

interface EventWithHost {
  id: string
  name: string
  partiful_event_id: string
  access_code: string
  created_at: string
  host: {
    id: string
    name: string
    is_admin: boolean
  }
}

export function Onboarding() {
  const [step, setStep] = useState<Step>('auth')
  const [user, setUser] = useState<User | null>(null)
  const [events, setEvents] = useState<EventWithHost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createdAccessCode, setCreatedAccessCode] = useState('')

  const { setSession, fetchGuests } = useCohostStore()
  const supabase = createClient()

  // Fetch user's events
  const fetchEvents = async (userId: string) => {
    try {
      const res = await fetch(`/api/events?user_id=${userId}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Error fetching events:', err)
    }
  }

  useEffect(() => {
    const init = async () => {
      // Check if redirected from callback after event creation
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('created') === 'true') {
        const accessCode = localStorage.getItem('cohost_created_access_code')
        if (accessCode) {
          setCreatedAccessCode(accessCode)
          localStorage.removeItem('cohost_created_access_code')
          window.history.replaceState({}, '', '/')
          
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setUser(user)
            await fetchEvents(user.id)
          }
          setStep('created')
          setLoading(false)
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await fetchEvents(user.id)
        
        // Check if Partiful is linked
        const res = await fetch(`/api/user/profile?user_id=${user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.partiful_user_id) {
            setStep('dashboard')
          } else {
            setStep('link_partiful')
          }
        } else {
          setStep('link_partiful')
        }
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user && event === 'SIGNED_IN') {
        await fetchEvents(session.user.id)
        const res = await fetch(`/api/user/profile?user_id=${session.user.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.partiful_user_id) {
            setStep('dashboard')
          } else {
            setStep('link_partiful')
          }
        } else {
          setStep('link_partiful')
        }
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auth success (login or signup)
  const handleAuthSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      await fetchEvents(user.id)
      const res = await fetch(`/api/user/profile?user_id=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.partiful_user_id) {
          setStep('dashboard')
        } else {
          setStep('link_partiful')
        }
      } else {
        setStep('link_partiful')
      }
    }
  }

  // Select an event to view
  const handleSelectEvent = async (event: EventWithHost) => {
    setSession(
      { 
        id: event.id, 
        name: event.name, 
        partiful_event_id: event.partiful_event_id, 
        access_code: event.access_code,
        date: null,
        created_at: event.created_at,
        updated_at: event.created_at,
      },
      { 
        id: event.host.id, 
        event_id: event.id,
        name: event.host.name, 
        email: null,
        is_admin: event.host.is_admin,
        created_at: event.created_at,
      }
    )
    await fetchGuests()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    )
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-2">Partiful Cohost</h1>
        <p className="text-[var(--color-text-muted)] mb-8">Multi-host guest vetting</p>
        <Auth onSuccess={handleAuthSuccess} />
      </div>
    )
  }

  if (step === 'link_partiful') {
    return (
      <LinkPartiful 
        onComplete={async () => {
          // Callback page handles everything, this is just for the original tab
          if (user) {
            await fetchEvents(user.id)
            setStep('dashboard')
          }
        }}
        userName={user?.user_metadata?.name}
      />
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
          onClick={() => {
            // Find the event we just created and select it
            const createdEvent = events.find(e => e.access_code === createdAccessCode)
            if (createdEvent) {
              handleSelectEvent(createdEvent)
            } else {
              setStep('dashboard')
            }
          }}
          className="px-6 py-3 bg-[#8B5BA5] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          View guest list →
        </button>
      </div>
    )
  }

  // Dashboard - show user's events
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center p-4 pt-16">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Your Events</h1>
            <p className="text-[var(--color-text-muted)] text-sm">
              {events.length === 0 ? 'No events yet' : `${events.length} event${events.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Sign out
          </button>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-muted)] mb-6">Add your first event to get started</p>
            <button
              onClick={() => setStep('link_partiful')}
              className="px-6 py-3 bg-[#8B5BA5] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Add event
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => handleSelectEvent(event)}
                className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 text-left hover:border-[#8B5BA5]/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#8B5BA5] to-[#6B4A85] flex items-center justify-center text-white text-lg">
                    🎉
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.name}</p>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Code: {event.access_code}
                    </p>
                  </div>
                  <div className="text-[var(--color-text-muted)]">→</div>
                </div>
              </button>
            ))}
            
            <button
              onClick={() => setStep('link_partiful')}
              className="w-full border border-dashed border-[var(--color-border)] rounded-xl p-4 text-[var(--color-text-muted)] hover:border-[#8B5BA5]/50 hover:text-[var(--color-text)] transition-colors"
            >
              + Add another event
            </button>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  )
}
