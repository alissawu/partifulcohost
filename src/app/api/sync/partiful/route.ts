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

// Extract user ID from Firestore reference like "projects/getpartiful/databases/(default)/documents/users/abc123"
function extractUserId(ref: string | null | undefined): string | null {
  if (!ref) return null
  const match = ref.match(/\/users\/([^/]+)$/)
  return match ? match[1] : null
}

// Fetch guests from public API (only APPROVED guests)
async function fetchPublicGuests(eventId: string): Promise<Array<{
  id: string
  name: string
  status: string | null
  rsvpDate?: string
  userId?: string
}>> {
  const guests: Array<{
    id: string
    name: string
    status: string | null
    rsvpDate?: string
    userId?: string
  }> = []
  
  let cursor: string | null = null
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: Response = await fetch('https://api.partiful.com/getGuests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://partiful.com',
        'Referer': 'https://partiful.com/',
      },
      body: JSON.stringify({
        data: {
          params: {
            eventId,
            includeInvitedGuests: true,
          },
          paging: {
            cursor,
            maxResults: 500,
          },
          userId: null,
        },
      }),
    })

    if (!res.ok) break

    const data = await res.json()
    const pageGuests = data.result?.data || []
    
    for (const g of pageGuests) {
      guests.push({
        id: g.user?.id || g.id,
        name: g.user?.name || g.name || 'Unknown',
        status: g.status,
        rsvpDate: g.rsvpDate,
        userId: g.user?.id,
      })
    }
    
    cursor = data.result?.paging?.nextCursor || null
    if (!cursor) break
  }
  
  return guests
}

// Fetch user photos from Partiful API
async function fetchUserPhotos(userIds: string[]): Promise<Map<string, string>> {
  const photoMap = new Map<string, string>()
  
  if (userIds.length === 0) return photoMap
  
  // Batch in groups of 100
  const batchSize = 100
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize)
    
    try {
      const res = await fetch('https://api.partiful.com/getUsers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://partiful.com',
          'Referer': 'https://partiful.com/',
        },
        body: JSON.stringify({
          data: {
            userIds: batch,
          },
        }),
      })
      
      if (!res.ok) {
        console.error('getUsers API error:', res.status)
        continue
      }
      
      const data = await res.json()
      const users = data.result?.data || []
      
      for (const user of users) {
        if (!user.id) continue
        
        let photoUrl: string | null = null
        if (user.photo) {
          if (user.photo.upload?.path) {
            // Use Imgix CDN thumbnail
            photoUrl = `https://partiful.imgix.net/${user.photo.upload.path}_thumbnail?fit=clip&w=80&auto=format`
          } else if (user.photo.url) {
            photoUrl = user.photo.url
          } else if (user.photo.upload?.url) {
            photoUrl = user.photo.upload.url
          }
        }
        
        if (photoUrl) {
          photoMap.set(user.id, photoUrl)
        }
      }
    } catch (err) {
      console.error('Error fetching user photos batch:', err)
    }
  }
  
  return photoMap
}

export async function POST(request: NextRequest) {
  try {
    const { event_id, partiful_event_id, token } = await request.json()

    if (!event_id || !partiful_event_id) {
      return NextResponse.json({ error: 'Missing event_id or partiful_event_id' }, { status: 400 })
    }

    const guests: Array<{ 
      id: string
      name: string
      status: string | null
      rsvpDate?: string
      userId?: string // Partiful user ID for photo lookup
    }> = []

    // Step 1: Fetch all guests from Firestore (needs token)
    if (token) {
      console.log('Fetching guests from Firestore...')
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
          const userRef = extractValue(fields.user) as string || null
          const userId = extractUserId(userRef)
          
          guests.push({
            id: docId,
            name,
            status,
            rsvpDate: rsvpDate || undefined,
            userId: userId || undefined,
          })
        }

        nextPageToken = data.nextPageToken || null
      } while (nextPageToken)
      
      console.log(`Firestore returned ${guests.length} guests`)
    }

    // If no token or Firestore failed, fall back to public API (only APPROVED)
    if (guests.length === 0) {
      console.log('No Firestore data, falling back to public API...')
      const publicGuests = await fetchPublicGuests(partiful_event_id)
      guests.push(...publicGuests)
    }

    if (guests.length === 0) {
      return NextResponse.json({ imported: 0, total_from_partiful: 0 })
    }

    // Step 2: Fetch photos for all users via getUsers API
    const userIds = guests.map(g => g.userId).filter((id): id is string => !!id)
    console.log(`Fetching photos for ${userIds.length} users...`)
    const photoMap = await fetchUserPhotos(userIds)
    console.log(`Got ${photoMap.size} photos`)

    const supabase = createServiceClient()

    // Upsert guests with photos
    const guestRows = guests.map((g) => ({
      event_id,
      partiful_id: g.id,
      name: g.name,
      photo: (g.userId ? photoMap.get(g.userId) : null) || null,
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
    
    const withPhotos = guestRows.filter(g => g.photo).length

    return NextResponse.json({ 
      imported: guestRows.length, 
      photos: withPhotos,
      statuses: statusCounts,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
