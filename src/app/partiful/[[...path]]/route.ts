import { NextRequest, NextResponse } from 'next/server'

const PARTIFUL_BASE = 'https://partiful.com'
const PARTIFUL_API = 'https://api.partiful.com'

// Rewrite URLs in HTML/JS to go through our proxy
function rewriteContent(content: string, contentType: string): string {
  if (!contentType.includes('text/html') && !contentType.includes('javascript')) {
    return content
  }

  return content
    // Rewrite absolute URLs to partiful.com
    .replace(/https:\/\/partiful\.com/g, '/partiful')
    .replace(/https:\/\/api\.partiful\.com/g, '/partiful-api')
    // Rewrite protocol-relative URLs
    .replace(/\/\/partiful\.com/g, '/partiful')
    .replace(/\/\/api\.partiful\.com/g, '/partiful-api')
    // Handle escaped URLs in JSON/JS
    .replace(/https:\\\/\\\/partiful\.com/g, '\\/partiful')
    .replace(/https:\\\/\\\/api\.partiful\.com/g, '\\/partiful-api')
    // Rewrite relative paths that start with / (but not /partiful)
    .replace(/href="\//g, 'href="/partiful/')
    .replace(/src="\//g, 'src="/partiful/')
    .replace(/href='\//g, "href='/partiful/")
    .replace(/src='\//g, "src='/partiful/")
    // Fix double /partiful/partiful
    .replace(/\/partiful\/partiful/g, '/partiful')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = path?.join('/') || ''
  const url = `${PARTIFUL_BASE}/${pathStr}`
  
  console.log(`[Proxy] GET ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
        'Accept': request.headers.get('accept') || '*/*',
        'Accept-Language': request.headers.get('accept-language') || 'en-US,en;q=0.9',
        'Cookie': request.headers.get('cookie') || '',
      },
      redirect: 'manual',
    })

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (location) {
        const newLocation = location
          .replace(PARTIFUL_BASE, '/partiful')
          .replace(PARTIFUL_API, '/partiful-api')
        return NextResponse.redirect(new URL(newLocation, request.url))
      }
    }

    const contentType = response.headers.get('content-type') || ''
    
    // For HTML/JS, rewrite content
    if (contentType.includes('text/html') || contentType.includes('javascript')) {
      const text = await response.text()
      const rewritten = rewriteContent(text, contentType)
      
      const headers = new Headers()
      headers.set('content-type', contentType)
      
      // Forward cookies
      const setCookie = response.headers.get('set-cookie')
      if (setCookie) {
        headers.set('set-cookie', setCookie)
      }
      
      return new NextResponse(rewritten, {
        status: response.status,
        headers,
      })
    }

    // For other content (images, etc), pass through
    const body = await response.arrayBuffer()
    const headers = new Headers()
    headers.set('content-type', contentType)
    
    return new NextResponse(body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('[Proxy] Error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const pathStr = path?.join('/') || ''
  const url = `${PARTIFUL_BASE}/${pathStr}`
  
  console.log(`[Proxy] POST ${url}`)

  try {
    const body = await request.text()
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body,
    })

    const contentType = response.headers.get('content-type') || ''
    const responseBody = await response.text()
    
    const headers = new Headers()
    headers.set('content-type', contentType)
    
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      headers.set('set-cookie', setCookie)
    }
    
    return new NextResponse(
      contentType.includes('text/html') || contentType.includes('javascript')
        ? rewriteContent(responseBody, contentType)
        : responseBody,
      { status: response.status, headers }
    )
  } catch (error) {
    console.error('[Proxy] Error:', error)
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
