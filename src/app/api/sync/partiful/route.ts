import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface FirestoreValue {
  stringValue?: string
  integerValue?: string
  timestampValue?: string
  mapValue?: { fields: Record<string, FirestoreValue> }
  arrayValue?: { values?: FirestoreValue[] }
  referenceValue?: string
}

interface FirestoreDocument {
  name: string
  fields: Record<string, FirestoreValue>
  createTime: string
  updateTime: string
}

function extractValue(val: FirestoreValue | undefined): unknown {
  if (!val) return null
  if (val.stringValue !== undefined) return val.stringValue
  if (val.integerValue !== undefined) return parseInt(val.integerValue)
  if (val.timestampValue !== undefined) return val.timestampValue
  if (val.referenceValue !== undefined) return val.referenceValue
  if (val.mapValue) {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      result[k] = extractValue(v)
    }
    return result
  }
  if (val.arrayValue) {
    return (val.arrayValue.values || []).map(extractValue)
  }
  return null
}

function normalizeStatus(status: string): string {
  const s = status.toLowerCase().replace(/_/g, ' ')
  if (s.includes('approved') || s === 'going') return 'approved'
  if (s.includes('pending')) return 'pending'
  if (s.includes('waitlist')) return 'waitlist'
  if (s.includes('rejected') || s.includes('declined')) return 'rejected'
  if (s.includes('invited')) return 'invited'
  if (s.includes('cant') || s.includes("can't")) return 'cant_go'
  return 'pending'
}

export async function POST(request: NextRequest) {
  try {
    const { event_id, partiful_event_id, token } = await request.json()

    if (!event_id || !partiful_event_id) {
      return NextResponse.json({ error: 'Missing event_id or partiful_event_id' }, { status: 400 })
    }

    let guests: Array<{ id: string; name: string; status: string; rsvpDate?: string; photo?: string }> = []

    // If we have a token, use Firestore REST API for full names
    if (token) {
      let nextPageToken: string | null = null
      
      do {
        const url = new URL(`https://firestore.googleapis.com/v1/projects/getpartiful/databases/(default)/documents/events/${partiful_event_id}/guests`)
        url.searchParams.set('pageSize', '300')
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken)
        }

        const res = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const text = await res.text()
          console.error('Firestore API error:', res.status, text)
          // Fall back to public API if Firestore fails
          break
        }

        const data = await res.json()
        const documents: FirestoreDocument[] = data.documents || []
        
        for (const doc of documents) {
          const fields = doc.fields
          const docId = doc.name.split('/').pop() || ''
          
          const name = extractValue(fields.name) as string || 'Unknown'
          const status = extractValue(fields.status) as string || 'PENDING'
          const rsvpDate = extractValue(fields.rsvpDate) as string || null
          
          // Try to get photo from user reference if available
          const user = extractValue(fields.user) as Record<string, unknown> | null
          const photo = user?.photo as string || null

          guests.push({
            id: docId,
            name,
            status,
            rsvpDate: rsvpDate || undefined,
            photo: photo || undefined,
          })
        }

        nextPageToken = data.nextPageToken || null
      } while (nextPageToken)
    }

    // Fall back to public API if no token or Firestore failed
    if (guests.length === 0) {
      let cursor: string | null = null
      
      do {
        const body = {
          data: {
            params: {
              eventId: partiful_event_id,
              includeInvitedGuests: true,
            },
            paging: {
              cursor,
              maxResults: 500,
            },
            userId: null,
          },
        }

        const res = await fetch('https://api.partiful.com/getGuests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://partiful.com',
            'Referer': 'https://partiful.com/',
          },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          console.error('Partiful API error:', res.status)
          break
        }

        const data = await res.json()
        const pageGuests = data.result?.data || []
        
        for (const g of pageGuests) {
          guests.push({
            id: g.user?.id || g.id,
            name: g.user?.name || g.name || 'Unknown',
            status: g.status,
            rsvpDate: g.rsvpDate,
            photo: g.user?.photo || null,
          })
        }
        
        cursor = data.result?.paging?.nextCursor || null
      } while (cursor)
    }

    if (guests.length === 0) {
      return NextResponse.json({ imported: 0, total_from_partiful: 0 })
    }

    const supabase = createServiceClient()

    // Upsert guests
    const guestRows = guests.map((g) => ({
      event_id,
      partiful_id: g.id,
      name: g.name,
      photo: g.photo || null,
      partiful_status: normalizeStatus(g.status),
      rsvp_timestamp: g.rsvpDate ? new Date(g.rsvpDate).toISOString() : null,
    }))

    const { error: upsertError } = await supabase
      .from('guests')
      .upsert(guestRows, {
        onConflict: 'event_id,partiful_id',
        ignoreDuplicates: false,
      })

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      imported: guestRows.length, 
      total_from_partiful: guests.length,
      used_firestore: !!token && guests.length > 0,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
