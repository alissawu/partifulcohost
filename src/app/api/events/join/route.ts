import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { access_code, user_id, host_name } = await request.json()

    if (!access_code) {
      return NextResponse.json({ error: 'Missing access code' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Find event by access code
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('access_code', access_code.trim())
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 404 })
    }

    // Check if user already joined
    if (user_id) {
      const { data: existingHost } = await supabase
        .from('hosts')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user_id)
        .single()

      if (existingHost) {
        return NextResponse.json({ event, host: existingHost })
      }

      // Get user's Partiful ID
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('partiful_user_id')
        .eq('user_id', user_id)
        .single()

      if (!profile?.partiful_user_id) {
        return NextResponse.json({ 
          error: 'Please link your Partiful account first',
          code: 'PARTIFUL_NOT_LINKED'
        }, { status: 403 })
      }

      // Verify user is a host on this Partiful event
      const partifulEventId = event.partiful_event_id
      if (partifulEventId) {
        try {
          // Fetch public event data to get ownerIds
          const eventRes = await fetch(
            `https://partiful.com/_next/data/hubl0BhPNUl8MB8DH4JMu/e/${partifulEventId}.json`
          )
          
          if (eventRes.ok) {
            const eventData = await eventRes.json()
            const ownerIds = eventData?.pageProps?.event?.ownerIds || []
            
            if (!ownerIds.includes(profile.partiful_user_id)) {
              return NextResponse.json({ 
                error: 'You are not a host of this Partiful event',
                code: 'NOT_A_HOST'
              }, { status: 403 })
            }
          }
        } catch (err) {
          console.error('Failed to verify host status:', err)
          // If we can't verify, allow join but log it
          // In production, might want to be stricter
        }
      }
    }

    // Create host entry
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .insert({
        event_id: event.id,
        user_id: user_id || null,
        name: host_name || 'Host',
        is_admin: false,
      })
      .select()
      .single()

    if (hostError) {
      console.error('Host creation error:', hostError)
      return NextResponse.json({ error: hostError.message }, { status: 500 })
    }

    return NextResponse.json({ event, host })
  } catch (error) {
    console.error('Error joining event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
