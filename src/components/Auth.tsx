'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'

interface AuthProps {
  onSuccess: () => void
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const validateEmail = (email: string): boolean => {
    return EMAIL_REGEX.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate required fields
    if (mode === 'signup' && !name.trim()) {
      setError('Name is required')
      return
    }
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      // Check if email exists
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { exists } = await checkRes.json()

      if (mode === 'signup') {
        if (exists) {
          setMode('login')
          setError('Account already exists. Please log in.')
          setLoading(false)
          return
        }
        
        // Create account immediately
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        })
        
        if (signUpError) {
          throw signUpError
        }
        
        onSuccess()
      } else {
        if (!exists) {
          setMode('signup')
          setError('No account found. Please sign up.')
          setLoading(false)
          return
        }
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (signInError) {
          if (signInError.message?.includes('Invalid login credentials')) {
            setError('Wrong password.')
          } else {
            throw signInError
          }
          setLoading(false)
          return
        }
        
        onSuccess()
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setMode('login'); setError('') }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            mode === 'login'
              ? 'bg-[#8B5BA5] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
          }`}
        >
          Log in
        </button>
        <button
          onClick={() => { setMode('signup'); setError('') }}
          className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
            mode === 'signup'
              ? 'bg-[#8B5BA5] text-white'
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
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5BA5]"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5BA5]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B5BA5]"
        />

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#8B5BA5] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
    </div>
  )
}
