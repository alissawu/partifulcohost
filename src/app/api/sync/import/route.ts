import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { PartifulStatus } from '@/types'

interface ImportGuest {
  partiful_id: string
  name: string
  photo?: string
  status: PartifulStatus
  rsvp_timestamp?: string
}

// Import guests from Partiful data (manual or bookmarklet)
export async function POST(request: NextRequest) {
  try {
    const { event_id, guests } = await request.json() as {
      event_id: string
      guests: ImportGuest[]
    }

    if (!event_id || !guests?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Upsert guests (update existing, insert new)
    const guestsToUpsert = guests.map(g => ({
      event_id,
      partiful_id: g.partiful_id,
      name: g.name,
      photo: g.photo || null,
      partiful_status: g.status,
      rsvp_timestamp: g.rsvp_timestamp || null,
    }))

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
      guests: upsertedGuests,
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Failed to import guests' }, { status: 500 })
  }
}
