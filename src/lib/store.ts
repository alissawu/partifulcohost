import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { 
  GuestWithDetails, 
  DbHost, 
  DbEvent, 
  PartifulStatus, 
  HostVote 
} from '@/types'

interface CosignState {
  event: DbEvent | null
  currentHost: DbHost | null
  hosts: DbHost[]
  guests: GuestWithDetails[]
  isLoading: boolean
  error: string | null
  filter: 'all' | 'flagged' | PartifulStatus
  searchQuery: string
  
  setSession: (event: DbEvent, host: DbHost) => void
  clearSession: () => void
  setGuests: (guests: GuestWithDetails[], hosts: DbHost[]) => void
  setFilter: (filter: 'all' | 'flagged' | PartifulStatus) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  toggleFlag: (guestId: string) => void
  vote: (guestId: string, vote: HostVote) => void
  addComment: (guestId: string, text: string) => void
  
  fetchGuests: () => Promise<void>
  submitVote: (guestId: string, vote: HostVote) => Promise<void>
  submitFlag: (guestId: string, isFlagged: boolean) => Promise<void>
  submitComment: (guestId: string, text: string) => Promise<void>
}

export const useCosignStore = create<CosignState>()(
  persist(
    (set, get) => ({
      event: null,
      currentHost: null,
      hosts: [],
      guests: [],
      isLoading: false,
      error: null,
      filter: 'all',
      searchQuery: '',
      
      setSession: (event, host) => set({ event, currentHost: host }),
      clearSession: () => set({ 
        event: null, 
        currentHost: null, 
        hosts: [], 
        guests: [],
        filter: 'all',
        searchQuery: '',
      }),
      
      setGuests: (guests, hosts) => set({ guests, hosts }),
      setFilter: (filter) => set({ filter }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      toggleFlag: (guestId) => set((state) => ({
        guests: state.guests.map(g => 
          g.id === guestId ? { ...g, is_flagged: !g.is_flagged } : g
        ),
      })),
      
      vote: (guestId, voteType) => set((state) => {
        const host = state.currentHost
        if (!host) return state
        
        return {
          guests: state.guests.map(g => {
            if (g.id !== guestId) return g
            
            const otherVotes = g.votes.filter(v => v.host_id !== host.id)
            const newVote = {
              id: 'temp-' + Date.now(),
              guest_id: guestId,
              host_id: host.id,
              vote: voteType,
              relationship: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              host: host,
            }
            
            const votes = [...otherVotes, newVote]
            const summary = {
              keep: votes.filter(v => v.vote === 'keep').length,
              remove: votes.filter(v => v.vote === 'remove').length,
              unsure: votes.filter(v => v.vote === 'unsure').length,
            }
            
            return {
              ...g,
              votes,
              vote_summary: summary,
              has_conflict: summary.keep > 0 && summary.remove > 0,
            }
          }),
        }
      }),
      
      addComment: (guestId, text) => set((state) => {
        const host = state.currentHost
        if (!host) return state
        
        return {
          guests: state.guests.map(g => {
            if (g.id !== guestId) return g
            return {
              ...g,
              comments: [...g.comments, {
                id: 'temp-' + Date.now(),
                guest_id: guestId,
                host_id: host.id,
                text,
                created_at: new Date().toISOString(),
                host: host,
              }],
            }
          }),
        }
      }),
      
      fetchGuests: async () => {
        const { event } = get()
        if (!event) return
        
        set({ isLoading: true, error: null })
        
        try {
          const res = await fetch('/api/events/' + event.id + '/guests')
          if (!res.ok) throw new Error('Failed to fetch guests')
          
          const data = await res.json()
          set({ guests: data.guests, hosts: data.hosts, isLoading: false })
        } catch (err) {
          set({ error: String(err), isLoading: false })
        }
      },
      
      submitVote: async (guestId, voteType) => {
        const { currentHost, fetchGuests, vote } = get()
        if (!currentHost) return
        
        vote(guestId, voteType)
        
        try {
          const res = await fetch('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guest_id: guestId,
              host_id: currentHost.id,
              vote: voteType,
            }),
          })
          
          if (!res.ok) throw new Error('Failed to save vote')
          fetchGuests()
        } catch (err) {
          set({ error: String(err) })
          fetchGuests()
        }
      },
      
      submitFlag: async (guestId, isFlagged) => {
        const { toggleFlag, fetchGuests } = get()
        toggleFlag(guestId)
        
        try {
          const res = await fetch('/api/guests/' + guestId + '/flag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_flagged: isFlagged }),
          })
          
          if (!res.ok) throw new Error('Failed to update flag')
        } catch (err) {
          set({ error: String(err) })
          fetchGuests()
        }
      },
      
      submitComment: async (guestId, text) => {
        const { currentHost, addComment, fetchGuests } = get()
        if (!currentHost) return
        
        addComment(guestId, text)
        
        try {
          const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guest_id: guestId,
              host_id: currentHost.id,
              text,
            }),
          })
          
          if (!res.ok) throw new Error('Failed to add comment')
          fetchGuests()
        } catch (err) {
          set({ error: String(err) })
          fetchGuests()
        }
      },
    }),
    {
      name: 'cosign-session',
      partialize: (state) => ({
        event: state.event,
        currentHost: state.currentHost,
      }),
    }
  )
)
