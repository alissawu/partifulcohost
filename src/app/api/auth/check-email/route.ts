import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Query auth.users
    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.error('Error checking email:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const exists = data.users.some(user => user.email?.toLowerCase() === email.toLowerCase())

    return NextResponse.json({ exists })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
