import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Toggle guest flag
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { is_flagged } = await request.json() as { is_flagged: boolean }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('guests')
      .update({ is_flagged })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Flag error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Flag error:', err)
    return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 })
  }
}
