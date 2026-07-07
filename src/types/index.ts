// Database types

export type PartifulStatus = 'approved' | 'pending' | 'waitlist' | 'rejected' | 'invited' | 'cant_go'
export type HostVote = 'keep' | 'remove' | 'unsure'
export type HostRelationship = 'my_friend' | 'friend_of_friend' | 'acquaintance' | 'dont_know'

// Database row types
export interface DbEvent {
  id: string
  partiful_event_id: string
  name: string
  date: string | null
  access_code: string
  created_at: string
  updated_at: string
}

export interface DbHost {
  id: string
  event_id: string
  name: string
  email: string | null
  is_admin: boolean
  created_at: string
}

export interface DbGuest {
  id: string
  event_id: string
  partiful_id: string
  name: string
  photo: string | null
  partiful_status: PartifulStatus
  rsvp_timestamp: string | null
  is_flagged: boolean
  created_at: string
  updated_at: string
}

export interface DbVote {
  id: string
  guest_id: string
  host_id: string
  vote: HostVote
  relationship: HostRelationship | null
  created_at: string
  updated_at: string
}

export interface DbComment {
  id: string
  guest_id: string
  host_id: string
  text: string
  created_at: string
}

// Enriched types for the UI
export interface GuestWithDetails extends DbGuest {
  votes: (DbVote & { host: DbHost })[]
  comments: (DbComment & { host: DbHost })[]
  vote_summary: {
    keep: number
    remove: number
    unsure: number
  }
  has_conflict: boolean
}

export interface EventWithHosts extends DbEvent {
  hosts: DbHost[]
}

// Session types
export interface CosignSession {
  event_id: string
  host_id: string
  host_name: string
  is_admin: boolean
}
