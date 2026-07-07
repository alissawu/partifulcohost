import { NextRequest, NextResponse } from 'next/server'

const PARTIFUL_API = 'https://api.partiful.com'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = path?.join('/') || ''
  const url = `${PARTIFUL_API}/${pathStr}`
  
  console.log(`[API Proxy] POST ${url}`)

  try {
    const body = await request.text()
    
    const headers: Record<string, string> = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'Origin': 'https://partiful.com',
      'Referer': 'https://partiful.com/',
    }
    
    // Forward auth header
    const auth = request.headers.get('authorization')
    if (auth) {
      headers['Authorization'] = auth
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })

    const contentType = response.headers.get('content-type') || ''
    const responseBody = await response.text()
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'content-type': contentType },
    })
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = path?.join('/') || ''
  const url = `${PARTIFUL_API}/${pathStr}`
  
  console.log(`[API Proxy] GET ${url}`)

  try {
    const headers: Record<string, string> = {
      'Origin': 'https://partiful.com',
      'Referer': 'https://partiful.com/',
    }
    
    const auth = request.headers.get('authorization')
    if (auth) {
      headers['Authorization'] = auth
    }
    
    const response = await fetch(url, { headers })

    const contentType = response.headers.get('content-type') || ''
    const responseBody = await response.text()
    
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'content-type': contentType },
    })
  } catch (error) {
    console.error('[API Proxy] Error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
