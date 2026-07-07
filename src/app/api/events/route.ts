import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { partiful_event_id, name, user_id, host_name } = await request.json()

    if (!partiful_event_id || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Generate access code
    const access_code = nanoid(8)

    // Create event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        partiful_event_id,
        name,
        access_code,
      })
      .select()
      .single()

    if (eventError) {
      console.error('Event creation error:', eventError)
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    // Create host entry for the creator
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .insert({
        event_id: event.id,
        user_id: user_id || null,
        name: host_name || 'Host',
        is_admin: true,
      })
      .select()
      .single()

    if (hostError) {
      console.error('Host creation error:', hostError)
      return NextResponse.json({ error: hostError.message }, { status: 500 })
    }

    return NextResponse.json({ event, host, access_code })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get all events this user is a host of
    const { data: hosts, error } = await supabase
      .from('hosts')
      .select('*, events(*)')
      .eq('user_id', user_id)

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const events = hosts.map(h => ({ ...h.events, host: h }))
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
