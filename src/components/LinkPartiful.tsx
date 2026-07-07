'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LinkPartifulProps {
  onComplete: (data: { partifulUserId: string; eventId: string; token: string }) => void
  isNewSignup?: boolean
  pendingName?: string
}

const PENDING_EVENT_URL_KEY = 'cohost_pending_event_url'
const LEGACY_PENDING_EVENT_URL_KEY = 'cosign_pending_event_url'

export function LinkPartiful({ onComplete, isNewSignup, pendingName }: LinkPartifulProps) {
  const [eventUrl, setEventUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [osTab, setOsTab] = useState<'mac' | 'windows'>('mac')
  const supabase = createClient()

  const extractEventId = (url: string): string | null => {
    const match = url.match(/partiful\.com\/e\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

  // The console command that extracts the token and sends it to us
  const getConsoleCommand = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `new Promise(r=>indexedDB.open('firebaseLocalStorageDb').onsuccess=e=>e.target.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll().onsuccess=e=>r((e.target.result.find(x=>x.fbase_key?.startsWith('firebase:authUser:'))||{}).value?.stsTokenManager?.accessToken)).then(t=>t?window.open('${baseUrl}/auth/callback#token='+encodeURIComponent(t),'_blank'):alert('Not logged into Partiful'))`
  }

  const copyCommand = () => {
    navigator.clipboard.writeText(getConsoleCommand())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Check for token in URL hash on mount
  useEffect(() => {
    const checkHash = async () => {
      const hash = window.location.hash
      if (hash.includes('token=')) {
        setChecking(true)
        const token = decodeURIComponent(hash.split('token=')[1])
        
        // Clear hash
        window.history.replaceState(null, '', window.location.pathname)
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Not logged in')
          setChecking(false)
          return
        }

        // Get event ID from stored URL
        const storedEventUrl =
          localStorage.getItem(PENDING_EVENT_URL_KEY) ||
          localStorage.getItem(LEGACY_PENDING_EVENT_URL_KEY)
        const eventId = storedEventUrl ? extractEventId(storedEventUrl) : null
        
        if (!eventId) {
          setError('No event URL found. Please enter your Partiful event URL and try again.')
          setChecking(false)
          return
        }

        // Send token to our API to link account
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

          localStorage.removeItem(PENDING_EVENT_URL_KEY)
          localStorage.removeItem(LEGACY_PENDING_EVENT_URL_KEY)
          onComplete({ 
            partifulUserId: data.partiful_user_id, 
            eventId,
            token 
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to link account')
        } finally {
          setChecking(false)
        }
      }
    }

    checkHash()
  }, [supabase.auth, onComplete])

  const handleContinue = () => {
    const eventId = extractEventId(eventUrl)
    if (!eventId) {
      setError('Invalid Partiful URL. Should look like partiful.com/e/abc123')
      return
    }
    // Store event URL for after redirect
    localStorage.setItem(PENDING_EVENT_URL_KEY, eventUrl)
    setError('')
  }

  const eventId = extractEventId(eventUrl)
  const showInstructions = eventId !== null

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <p className="text-[var(--color-text-muted)]">Linking your Partiful account...</p>
      </div>
    )
  }

  const handleSignOut = async () => {
    sessionStorage.removeItem('cohost_pending_signup')
    sessionStorage.removeItem(PENDING_EVENT_URL_KEY)
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
      <button
        onClick={handleSignOut}
        className="absolute top-4 right-4 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        {isNewSignup ? 'Start over' : 'Sign out'}
      </button>
      <h1 className="text-2xl font-semibold mb-2">
        {isNewSignup ? `Almost done, ${pendingName || 'there'}!` : 'Connect your event'}
      </h1>
      <p className="text-[var(--color-text-muted)] mb-8 text-center max-w-md">
        {isNewSignup 
          ? "Link your event, then verify you're a host"
          : "We'll verify you're a host and sync the guest list with real names"
        }
      </p>

      <div className="w-full max-w-md space-y-6">
        {/* Step 1: Event URL */}
        <div className="space-y-2">
          <p className="font-medium">1. Paste your Partiful event URL</p>
          <input
            type="text"
            placeholder="partiful.com/e/abc123"
            value={eventUrl}
            onChange={(e) => {
              setEventUrl(e.target.value)
              setError('')
            }}
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6365C0]"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            You can add more events later
          </p>
        </div>

        {showInstructions && (
          <>
            {/* Step 2: Open Partiful */}
            <div className="space-y-2">
              <p className="font-medium">2. Open <a href="https://partiful.com" target="_blank" rel="noopener noreferrer" className="text-[#6365C0] hover:underline">partiful.com<span className="text-xs ml-0.5">↗</span></a> and make sure you&apos;re logged in</p>
            </div>

            {/* Step 3: Console */}
            <div className="space-y-2">
              <p className="font-medium">3. Open the browser console</p>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setOsTab('mac')}
                  className={`px-3 py-1 text-sm rounded ${osTab === 'mac' ? 'bg-[#6365C0] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}
                >
                  Mac
                </button>
                <button
                  onClick={() => setOsTab('windows')}
                  className={`px-3 py-1 text-sm rounded ${osTab === 'windows' ? 'bg-[#6365C0] text-white' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'}`}
                >
                  Windows
                </button>
              </div>
              {osTab === 'mac' ? (
                <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                  <p>Right-click → Inspect Element → Console tab</p>
                  <p className="text-xs">Safari: first enable in Safari → Settings → Advanced → &quot;Show features for web developers&quot;</p>
                </div>
              ) : (
                <div className="text-sm text-[var(--color-text-muted)] space-y-1">
                  <p>Right-click → Inspect → Console tab</p>
                  <p className="text-xs">Or press F12, then click Console</p>
                </div>
              )}
            </div>

            {/* Step 4: Paste command */}
            <div className="space-y-2">
              <p className="font-medium">4. Paste this and press Enter</p>
              <div className="relative">
                <pre className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                  {getConsoleCommand()}
                </pre>
                <button
                  onClick={() => {
                    handleContinue()
                    if (extractEventId(eventUrl)) {
                      copyCommand()
                    }
                  }}
                  className="absolute top-2 right-2 px-3 py-1 bg-[#6365C0] text-white text-xs rounded hover:opacity-90"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                This will open a new tab to complete the connection
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
