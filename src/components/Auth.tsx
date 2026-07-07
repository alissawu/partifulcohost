'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'check_email'

interface AuthProps {
  onSuccess: () => void
}

function getEmailProviderUrl(email: string): { name: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  const providers: Record<string, { name: string; url: string }> = {
    'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
    'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com' },
    'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'live.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'msn.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
    'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
    'me.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
    'mac.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
    'proton.me': { name: 'Proton Mail', url: 'https://mail.proton.me' },
    'protonmail.com': { name: 'Proton Mail', url: 'https://mail.proton.me' },
    'aol.com': { name: 'AOL Mail', url: 'https://mail.aol.com' },
    'zoho.com': { name: 'Zoho Mail', url: 'https://mail.zoho.com' },
  }

  // Check for exact match first
  if (providers[domain]) {
    return providers[domain]
  }

  // Check for edu domains (likely Google Workspace or Outlook)
  if (domain.endsWith('.edu')) {
    return { name: 'your email', url: `https://${domain}` }
  }

  return null
}

export function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          }
        })
        if (signUpError) throw signUpError
        
        // Show check email screen
        setMode('check_email')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        onSuccess()
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Check email confirmation screen
  if (mode === 'check_email') {
    const provider = getEmailProviderUrl(email)
    
    return (
      <div className="w-full max-w-sm mx-auto text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-[var(--color-text-muted)] mb-6">
          We sent a confirmation link to <span className="text-[var(--color-text)]">{email}</span>
        </p>
        
        {provider && (
          <a
            href={provider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity mb-4"
          >
            Open {provider.name} →
          </a>
        )}
        
        <button
          onClick={() => {
            setMode('login')
            setError('')
          }}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            mode === 'login'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
          }`}
        >
          Log in
        </button>
        <button
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            mode === 'signup'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
    </div>
  )
}
