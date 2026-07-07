import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Verify a Partiful Firebase token and link to user account
export async function POST(request: NextRequest) {
  try {
    const { token, cohost_user_id, cosign_user_id } = await request.json()
    const userId = cohost_user_id || cosign_user_id

    if (!token || !userId) {
      return NextResponse.json({ error: 'Missing token or user_id' }, { status: 400 })
    }

    // Decode the Firebase JWT to get user_id
    // Firebase tokens are JWTs - we can decode without verification for now
    // (In production, you'd verify with Firebase Admin SDK)
    const parts = token.split('.')
    if (parts.length !== 3) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    const partiful_user_id = payload.user_id || payload.sub

    if (!partiful_user_id) {
      return NextResponse.json({ error: 'Could not extract user_id from token' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check if this Partiful ID is already linked to another account
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('partiful_user_id', partiful_user_id)
      .single()

    if (existing && existing.user_id !== userId) {
      return NextResponse.json({ 
        error: 'This Partiful account is already linked to another user' 
      }, { status: 409 })
    }

    // Upsert the user profile with Partiful ID
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        partiful_user_id,
        partiful_name: payload.name || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      partiful_user_id,
      partiful_name: payload.name || null,
    })
  } catch (error) {
    console.error('Error linking Partiful:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
