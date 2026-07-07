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

interface PartifulGuestsRequestBody {
  data: {
    params: {
      eventId: string
      includeInvitedGuests: boolean
    }
    paging: {
      cursor: string | null
      maxResults: number
    }
    userId: null
  }
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

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'invited' // No status = invited but not RSVPed
  
  const s = status.toUpperCase()
  // Exact matches first
  if (s === 'APPROVED' || s === 'GOING') return 'approved'
  if (s === 'PENDING_APPROVAL' || s === 'PENDING') return 'pending'
  if (s === 'INVITED') return 'invited'
  if (s === 'WAITLISTED' || s === 'WAITLIST') return 'waitlist'
  if (s === 'REJECTED' || s === 'DECLINED' || s === 'NOT_APPROVED') return 'rejected'
  if (s === 'CANT_GO' || s === 'NOT_GOING') return 'cant_go'
  
  // Fallback partial matches
  if (s.includes('APPROVED') || s.includes('GOING')) return 'approved'
  if (s.includes('PENDING')) return 'pending'
  if (s.includes('INVITED')) return 'invited'
  if (s.includes('WAITLIST')) return 'waitlist'
  if (s.includes('REJECT') || s.includes('DECLINE')) return 'rejected'
  if (s.includes('CANT') || s.includes('NOT_GOING')) return 'cant_go'
  
  console.warn('Unknown Partiful status:', status)
  return 'invited' // Default to invited if unknown
}

export async function POST(request: NextRequest) {
  try {
    const { event_id, partiful_event_id, token } = await request.json()

    if (!event_id || !partiful_event_id) {
      return NextResponse.json({ error: 'Missing event_id or partiful_event_id' }, { status: 400 })
    }

    const guests: Array<{ id: string; name: string; status: string | null; rsvpDate?: string; photo?: string }> = []
    const photoMap = new Map<string, string>() // id -> photo URL

    // Step 1: If we have a token, use Firestore to get ALL guests (including PENDING, INVITED)
    if (token) {
      console.log('Using Firestore with token for full guest list...')
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
          break
        }

        const data = await res.json()
        const documents: FirestoreDocument[] = data.documents || []
        
        for (const doc of documents) {
          const fields = doc.fields
          const docId = doc.name.split('/').pop() || ''
          
          const name = extractValue(fields.name) as string || 'Unknown'
          const status = extractValue(fields.status) as string || null
          const rsvpDate = extractValue(fields.rsvpDate) as string || null
          
          guests.push({
            id: docId,
            name,
            status,
            rsvpDate: rsvpDate || undefined,
            photo: undefined, // Will be filled from public API
          })
        }

        nextPageToken = data.nextPageToken || null
      } while (nextPageToken)
      
      console.log(`Firestore returned ${guests.length} guests`)
    }

    // Step 2: Get photos from public API (only has APPROVED guests, but that's where photos are)
    let cursor: string | null = null
    
    do {
      const body: PartifulGuestsRequestBody = {
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
        console.log('Public API failed with status:', res.status)
        break
      }

      const data = await res.json()
      const pageGuests = data.result?.data || []
      
      for (const g of pageGuests) {
        const id = g.user?.id || g.id
        
        // Extract photo URL
        let photoUrl: string | null = null
        if (g.user?.photo) {
          if (g.user.photo.upload?.path) {
            // Use Imgix CDN thumbnail - smaller, faster
            photoUrl = `https://partiful.imgix.net/${g.user.photo.upload.path}_thumbnail?fit=clip&w=80&auto=format`
          } else if (g.user.photo.url) {
            photoUrl = g.user.photo.url
          } else if (g.user.photo.upload?.url) {
            photoUrl = g.user.photo.upload.url
          }
        }
        
        if (photoUrl) {
          photoMap.set(id, photoUrl)
        }
        
        // If we didn't get guests from Firestore, use public API as source
        if (guests.length === 0) {
          guests.push({
            id,
            name: g.user?.name || g.name || 'Unknown',
            status: g.status,
            rsvpDate: g.rsvpDate,
            photo: photoUrl || undefined,
          })
        }
      }
      
      cursor = data.result?.paging?.nextCursor || null
    } while (cursor)
    
    console.log(`Public API returned ${photoMap.size} photos`)

    // Step 3: Merge photos into Firestore guests
    if (guests.length > 0 && photoMap.size > 0) {
      for (const guest of guests) {
        const photo = photoMap.get(guest.id)
        if (photo) {
          guest.photo = photo
        }
      }
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

    // Count statuses for response
    const statusCounts = guestRows.reduce((acc, g) => {
      acc[g.partiful_status] = (acc[g.partiful_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({ 
      imported: guestRows.length, 
      photos: photoMap.size,
      statuses: statusCounts,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
