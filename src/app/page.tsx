'use client'

import { useEffect, useState } from 'react'
import { useCohostStore } from '@/lib/store'
import { GuestCard } from '@/components/GuestCard'
import { Onboarding } from '@/components/Onboarding'
import type { PartifulStatus } from '@/types'

const STATUS_ORDER: PartifulStatus[] = ['approved', 'pending', 'waitlist', 'invited', 'rejected', 'cant_go']

const STATUS_EMOJI: Record<PartifulStatus, string> = {
  approved: '✓',
  pending: '⏳',
  waitlist: '📋',
  rejected: '✗',
  invited: '✉️',
  cant_go: '🚫',
}

const STATUS_LABELS: Record<PartifulStatus, string> = {
  approved: 'Approved',
  pending: 'Pending',
  waitlist: 'Waitlist',
  rejected: 'Rejected',
  invited: 'Invited',
  cant_go: "Can't Go",
}

export default function Home() {
  const { 
    event, 
    currentHost, 
    hosts,
    guests, 
    filter, 
    searchQuery, 
    isLoading,
    setFilter, 
    setSearchQuery,
    fetchGuests,
    clearSession,
  } = useCohostStore()
  
  const [showImport, setShowImport] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  
  // Wait for hydration
  useEffect(() => {
    const timeout = window.setTimeout(() => setHydrated(true), 0)
    return () => window.clearTimeout(timeout)
  }, [])
  
  // Fetch guests when event is set
  useEffect(() => {
    if (event) {
      fetchGuests()
    }
  }, [event, fetchGuests])
  
  // Show nothing until hydrated
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    )
  }
  
  // Show onboarding if no session
  if (!event || !currentHost) {
    return <Onboarding />
  }
  
  // Filter and search
  const filteredGuests = guests.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filter === 'all') return matchesSearch
    if (filter === 'flagged') return matchesSearch && (g.is_flagged || g.has_conflict)
    return matchesSearch && g.partiful_status === filter
  })
  
  // Separate flagged for "needs attention" section
  const flaggedGuests = guests.filter(g => g.is_flagged || g.has_conflict)
  
  // Group by status
  const guestsByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = guests.filter(g => 
      g.partiful_status === status && !g.is_flagged && !g.has_conflict
    )
    return acc
  }, {} as Record<PartifulStatus, typeof guests>)
  
  // Status counts
  const statusCounts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = guests.filter(g => g.partiful_status === status).length
    return acc
  }, {} as Record<PartifulStatus, number>)
  
  const handleImport = async () => {
    if (!importJson.trim()) {
      setImportError('Please paste guest data')
      return
    }
    
    setImportLoading(true)
    setImportError('')
    
    try {
      let guestData
      try {
        guestData = JSON.parse(importJson)
      } catch {
        throw new Error('Invalid JSON')
      }
      
      // Handle different formats
      const guests = Array.isArray(guestData) ? guestData :
                     guestData.result?.data ? guestData.result.data :
                     guestData.guests ? guestData.guests :
                     guestData.data ? guestData.data : []
      
      if (!Array.isArray(guests) || guests.length === 0) {
        throw new Error('No guests found in data')
      }
      
      // Normalize guest format
      const normalizedGuests = guests.map((g: Record<string, unknown>) => ({
        partiful_id: String(g.id || g.userId || g.guestId || 'unknown-' + Math.random()),
        name: String(g.name || g.displayName || 'Unknown'),
        photo: g.photo || g.photoUrl || g.avatar || null,
        status: normalizeStatus(String(g.status || g.rsvpStatus || 'pending')),
        rsvp_timestamp: g.rsvpTimestamp || g.timestamp || null,
      }))
      
      const res = await fetch('/api/sync/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          guests: normalizedGuests,
        }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Import failed')
      }
      
      const result = await res.json()
      alert(`Imported ${result.imported} guests!`)
      setShowImport(false)
      setImportJson('')
      fetchGuests()
    } catch (err) {
      setImportError(String(err))
    } finally {
      setImportLoading(false)
    }
  }
  
  function normalizeStatus(status: string): PartifulStatus {
    const s = status.toLowerCase()
    if (s.includes('approv') || s === 'going' || s === 'yes') return 'approved'
    if (s.includes('pending') || s === 'maybe') return 'pending'
    if (s.includes('wait')) return 'waitlist'
    if (s.includes('reject') || s.includes('declin')) return 'rejected'
    if (s.includes('invite')) return 'invited'
    if (s.includes('cant') || s.includes("can't") || s === 'no') return 'cant_go'
    return 'pending'
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
                <span className="text-[#6365C0]">co</span>host
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {event.name}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Host avatars */}
              <div className="flex -space-x-2">
                {hosts.slice(0, 5).map((host) => (
                  <div 
                    key={host.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6365C0] to-[#73499D] flex items-center justify-center text-xs font-medium text-white border-2 border-[var(--color-bg-elevated)]"
                    title={host.name}
                  >
                    {host.name.slice(0, 1).toUpperCase()}
                  </div>
                ))}
                {hosts.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center text-xs text-[var(--color-text-muted)] border-2 border-[var(--color-bg-elevated)]">
                    +{hosts.length - 5}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowImport(true)}
                className="px-3 py-1.5 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] transition-colors"
              >
                Import
              </button>
              
              <button
                onClick={fetchGuests}
                disabled={isLoading}
                className="px-3 py-1.5 bg-[#6365C0] hover:brightness-110 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {isLoading ? 'Syncing...' : 'Sync'}
              </button>
              
              <button
                onClick={clearSession}
                className="p-1.5 hover:bg-[var(--color-bg-hover)] rounded-lg text-[var(--color-text-muted)] transition-colors"
                title="Leave event"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guests..."
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#6365C0]"
            />
          </div>
          
          {/* Filter tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-[#6365C0] text-white'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              All ({guests.length})
            </button>
            
            <button
              onClick={() => setFilter('flagged')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                filter === 'flagged'
                  ? 'bg-[var(--color-status-flagged)] text-white'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              🚩 Flagged ({flaggedGuests.length})
            </button>
            
            {STATUS_ORDER.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  filter === status
                    ? 'bg-[#6365C0] text-white'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {STATUS_EMOJI[status]} {STATUS_LABELS[status]} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {guests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-text-muted)]">No guests yet</p>
            <button
              onClick={() => setShowImport(true)}
              className="mt-4 px-4 py-2 bg-[#6365C0] text-white rounded-lg font-medium hover:brightness-110 transition-all"
            >
              Import from Partiful
            </button>
          </div>
        ) : filter === 'all' ? (
          <>
            {/* Needs Attention */}
            {flaggedGuests.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-medium text-[var(--color-status-flagged)] mb-4 flex items-center gap-2">
                  🚩 Needs Attention
                  <span className="text-sm font-normal text-[var(--color-text-muted)]">
                    ({flaggedGuests.length})
                  </span>
                </h2>
                <div className="space-y-3">
                  {flaggedGuests
                    .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((guest) => (
                      <GuestCard key={guest.id} guest={guest} />
                    ))}
                </div>
              </section>
            )}
            
            {/* Status sections */}
            {STATUS_ORDER.map((status) => {
              const statusGuests = guestsByStatus[status].filter(g => 
                g.name.toLowerCase().includes(searchQuery.toLowerCase())
              )
              if (statusGuests.length === 0) return null
              
              return (
                <section key={status} className="mb-8">
                  <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                    {STATUS_EMOJI[status]} {STATUS_LABELS[status]}
                    <span className="text-sm font-normal text-[var(--color-text-muted)]">
                      ({statusGuests.length})
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {statusGuests.map((guest) => (
                      <GuestCard key={guest.id} guest={guest} />
                    ))}
                  </div>
                </section>
              )
            })}
          </>
        ) : (
          <div className="space-y-3">
            {filteredGuests.length === 0 ? (
              <p className="text-center py-8 text-[var(--color-text-muted)]">
                No guests found
              </p>
            ) : (
              filteredGuests.map((guest) => (
                <GuestCard key={guest.id} guest={guest} />
              ))
            )}
          </div>
        )}
      </main>
      
      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                Import Guests
              </h2>
              <button
                onClick={() => setShowImport(false)}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded text-[var(--color-text-muted)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  Paste guest data from Partiful (JSON format)
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  Open DevTools on your Partiful event page, find the API response with guest data, and paste it here
                </p>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"result": {"data": [{"id": "...", "name": "...", "status": "..."}]}}'
                  className="w-full h-48 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#6365C0] font-mono resize-none"
                />
              </div>
              
              <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] rounded-lg p-3">
                <p className="font-medium mb-1">How to get guest data:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to your Partiful event page</li>
                  <li>Open DevTools (F12 or Cmd+Opt+I)</li>
                  <li>Go to Network tab</li>
                  <li>Look for requests containing guest/contact data</li>
                  <li>Copy the response and paste here</li>
                </ol>
              </div>
              
              {importError && (
                <p className="text-red-400 text-sm">{importError}</p>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowImport(false)}
                  className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importLoading || !importJson.trim()}
                  className="px-4 py-2 bg-[#6365C0] text-white font-medium rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {importLoading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
