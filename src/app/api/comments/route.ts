import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Add a comment
export async function POST(request: NextRequest) {
  try {
    const { guest_id, host_id, text } = await request.json() as {
      guest_id: string
      host_id: string
      text: string
    }

    if (!guest_id || !host_id || !text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('comments')
      .insert({
        guest_id,
        host_id,
        text: text.trim(),
      })
      .select(`
        *,
        host:hosts(*)
      `)
      .single()

    if (error) {
      console.error('Comment error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Comment error:', err)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}

// Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    const { comment_id, host_id } = await request.json() as {
      comment_id: string
      host_id: string
    }

    if (!comment_id || !host_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Only allow deleting your own comments
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', comment_id)
      .eq('host_id', host_id)

    if (error) {
      console.error('Delete comment error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete comment error:', err)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
