import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { GuestWithDetails, DbVote, DbComment, DbHost } from '@/types'

// Get all guests for an event with their votes and comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: event_id } = await params

    const supabase = createServiceClient()

    // Get all guests with votes and comments
    const { data: guests, error: guestsError } = await supabase
      .from('guests')
      .select(`
        *,
        votes:votes(*, host:hosts(*)),
        comments:comments(*, host:hosts(*))
      `)
      .eq('event_id', event_id)
      .order('name')

    if (guestsError) {
      console.error('Guests fetch error:', guestsError)
      return NextResponse.json({ error: guestsError.message }, { status: 500 })
    }

    // Get all hosts for this event
    const { data: hosts, error: hostsError } = await supabase
      .from('hosts')
      .select('*')
      .eq('event_id', event_id)

    if (hostsError) {
      console.error('Hosts fetch error:', hostsError)
      return NextResponse.json({ error: hostsError.message }, { status: 500 })
    }

    // Enrich guests with vote summaries and conflict detection
    const enrichedGuests: GuestWithDetails[] = guests.map((guest) => {
      const votes = guest.votes as (DbVote & { host: DbHost })[]
      const comments = guest.comments as (DbComment & { host: DbHost })[]
      
      const vote_summary = {
        keep: votes.filter(v => v.vote === 'keep').length,
        remove: votes.filter(v => v.vote === 'remove').length,
        unsure: votes.filter(v => v.vote === 'unsure').length,
      }

      // Conflict = has both keep and remove votes
      const has_conflict = vote_summary.keep > 0 && vote_summary.remove > 0

      return {
        ...guest,
        votes,
        comments: comments.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
        vote_summary,
        has_conflict,
      }
    })

    return NextResponse.json({ guests: enrichedGuests, hosts })
  } catch (err) {
    console.error('Fetch guests error:', err)
    return NextResponse.json({ error: 'Failed to fetch guests' }, { status: 500 })
  }
}
