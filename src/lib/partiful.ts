// Partiful API client

const PARTIFUL_API = 'https://api.partiful.com'

export type PartifulGuestStatus = 
  | 'APPROVED' 
  | 'PENDING_APPROVAL' 
  | 'WAITLISTED'
  | 'DECLINED'
  | 'INVITED'
  | 'MAYBE'

export interface PartifulGuest {
  id: string
  status: PartifulGuestStatus
  count: number
  plusOneCount: number
  plusOnes: unknown[]
  rsvpDate: string
  invitedBy: string | null
  name: string
  user?: {
    id: string
    name: string
    photo?: {
      url?: string
    }
    socials?: unknown
    bio?: string
  }
  rsvpHistory?: Array<{
    id: string
    status: PartifulGuestStatus
    date: string
    count: number
    message: string | null
  }>
}

export interface GetGuestsResponse {
  result: {
    data: PartifulGuest[]
    paging: {
      nextCursor: string | null
      pageResultCount: number
    }
  }
}

// Fetch guests for a specific event
// No auth needed for public events
export async function getEventGuests(
  eventId: string,
  cursor?: string | null,
  password?: string
): Promise<GetGuestsResponse> {
  const response = await fetch(`${PARTIFUL_API}/getGuests`, {
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
          ...(password && { password }),
        },
        paging: {
          cursor: cursor || null,
          maxResults: 500,
        },
        userId: null,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Partiful API error: ${response.status} - ${text}`)
  }

  const data = await response.json()
  
  // Check for API-level errors
  if (data.error) {
    throw new Error(data.error.message || 'Partiful API error')
  }

  return data
}

// Fetch all guests with pagination
export async function getAllEventGuests(
  eventId: string,
  password?: string
): Promise<PartifulGuest[]> {
  const allGuests: PartifulGuest[] = []
  let cursor: string | null = null

  do {
    const response = await getEventGuests(eventId, cursor, password)
    allGuests.push(...response.result.data)
    cursor = response.result.paging.nextCursor
  } while (cursor)

  return allGuests
}

// Convert Partiful status to our normalized status
export function normalizePartifulStatus(status: PartifulGuestStatus): string {
  switch (status) {
    case 'APPROVED':
      return 'approved'
    case 'PENDING_APPROVAL':
      return 'pending'
    case 'WAITLISTED':
      return 'waitlist'
    case 'DECLINED':
      return 'rejected'
    case 'INVITED':
      return 'invited'
    case 'MAYBE':
      return 'pending'
    default:
      return 'pending'
  }
}
