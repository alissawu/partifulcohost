import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAllEventGuests, normalizePartifulStatus } from '@/lib/partiful'

// Sync guests directly from Partiful API
export async function POST(request: NextRequest) {
  try {
    const { event_id, partiful_event_id, password } = await request.json() as {
      event_id: string
      partiful_event_id: string
      password?: string
    }

    if (!event_id || !partiful_event_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fetch guests from Partiful
    let partifulGuests
    try {
      partifulGuests = await getAllEventGuests(partiful_event_id, password)
    } catch (err) {
      console.error('Partiful fetch error:', err)
      return NextResponse.json({ 
        error: 'Failed to fetch from Partiful: ' + (err as Error).message 
      }, { status: 502 })
    }

    if (!partifulGuests.length) {
      return NextResponse.json({ 
        imported: 0, 
        message: 'No guests found on Partiful' 
      })
    }

    const supabase = createServiceClient()

    // Prepare guests for upsert
    const guestsToUpsert = partifulGuests.map(g => ({
      event_id,
      partiful_id: g.id,
      name: g.name || g.user?.name || 'Unknown',
      photo: g.user?.photo?.url || null,
      partiful_status: normalizePartifulStatus(g.status),
      rsvp_timestamp: g.rsvpDate || null,
    }))

    // Upsert all guests
    const { data: upsertedGuests, error: upsertError } = await supabase
      .from('guests')
      .upsert(guestsToUpsert, {
        onConflict: 'event_id,partiful_id',
        ignoreDuplicates: false,
      })
      .select()

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      imported: upsertedGuests?.length || 0,
      total_from_partiful: partifulGuests.length,
    })
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }
}
