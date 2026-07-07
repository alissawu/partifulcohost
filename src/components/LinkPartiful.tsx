'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LinkPartifulProps {
  onLinked: (partifulUserId: string) => void
  onSkip?: () => void
}

export function LinkPartiful({ onLinked, onSkip }: LinkPartifulProps) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  // The console command that extracts the token and sends it to us
  const getConsoleCommand = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `new Promise(r=>indexedDB.open('firebaseLocalStorageDb').onsuccess=e=>e.target.result.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll().onsuccess=e=>r((e.target.result.find(x=>x.fbase_key?.startsWith('firebase:authUser:'))||{}).value?.stsTokenManager?.accessToken)).then(t=>t?location.assign('${baseUrl}/auth/callback#token='+encodeURIComponent(t)):alert('Not logged into Partiful'))`
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

        // Send token to our API
        try {
          const res = await fetch('/api/auth/partiful', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              cosign_user_id: user.id,
            }),
          })

          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.error || 'Failed to link account')
          }

          onLinked(data.partiful_user_id)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to link account')
        } finally {
          setChecking(false)
        }
      }
    }

    checkHash()
  }, [supabase.auth, onLinked])

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
        <p className="text-[var(--color-text-muted)]">Linking your Partiful account...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-semibold mb-2">Link your Partiful</h1>
      <p className="text-[var(--color-text-muted)] mb-8 text-center max-w-md">
        This verifies you're a real Partiful host. You only need to do this once.
      </p>

      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <p className="font-medium">1. Open partiful.com and make sure you're logged in</p>
        </div>

        <div className="space-y-2">
          <p className="font-medium">2. Open the browser console</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Mac: Cmd + Option + J<br />
            Windows: Ctrl + Shift + J
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-medium">3. Paste this command and press Enter</p>
          <div className="relative">
            <pre className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              {getConsoleCommand()}
            </pre>
            <button
              onClick={copyCommand}
              className="absolute top-2 right-2 px-3 py-1 bg-[var(--color-accent)] text-white text-xs rounded hover:opacity-90"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] text-center">
          This will redirect you back here with your Partiful account linked.
        </p>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        {onSkip && (
          <button
            onClick={onSkip}
            className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}
