import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { HostVote, HostRelationship } from '@/types'

// Upsert a vote
export async function POST(request: NextRequest) {
  try {
    const { guest_id, host_id, vote, relationship } = await request.json() as {
      guest_id: string
      host_id: string
      vote: HostVote
      relationship?: HostRelationship
    }

    if (!guest_id || !host_id || !vote) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('votes')
      .upsert({
        guest_id,
        host_id,
        vote,
        relationship: relationship || null,
      }, {
        onConflict: 'guest_id,host_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Vote error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Vote error:', err)
    return NextResponse.json({ error: 'Failed to save vote' }, { status: 500 })
  }
}

// Delete a vote
export async function DELETE(request: NextRequest) {
  try {
    const { guest_id, host_id } = await request.json() as {
      guest_id: string
      host_id: string
    }

    if (!guest_id || !host_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('votes')
      .delete()
      .eq('guest_id', guest_id)
      .eq('host_id', host_id)

    if (error) {
      console.error('Delete vote error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete vote error:', err)
    return NextResponse.json({ error: 'Failed to delete vote' }, { status: 500 })
  }
}
