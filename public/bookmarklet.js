// Cosign Bookmarklet - Run on your Partiful event guest list page
// This intercepts Partiful API calls or scrapes the DOM to extract guest data

(async function() {
  const COSIGN_API = 'REPLACE_WITH_YOUR_URL/api/sync/import';
  
  // Try to get event ID from URL
  const urlMatch = window.location.pathname.match(/\/e\/([^\/]+)/);
  if (!urlMatch) {
    alert('Please run this on a Partiful event page (partiful.com/e/...)');
    return;
  }
  const eventSlug = urlMatch[1];
  
  console.log('[Cosign] Starting guest extraction for event:', eventSlug);
  
  // Strategy 1: Intercept fetch to find API responses
  // We'll look for guest data in window.__NEXT_DATA__ or intercept XHR
  
  let guests = [];
  
  // Check for Next.js hydration data
  const nextData = document.getElementById('__NEXT_DATA__');
  if (nextData) {
    try {
      const data = JSON.parse(nextData.textContent);
      console.log('[Cosign] Found Next.js data:', data);
      // Navigate to find guests in the data structure
      // This path may vary - need to inspect actual Partiful pages
    } catch (e) {
      console.log('[Cosign] Could not parse Next.js data');
    }
  }
  
  // Strategy 2: Find guest elements in DOM
  // Partiful uses virtualized lists, so we need to scroll and capture
  const guestContainer = document.querySelector('[class*="guest"]') || 
                         document.querySelector('[data-testid*="guest"]');
  
  if (!guestContainer && guests.length === 0) {
    // Strategy 3: Prompt user to paste API response
    const apiResponse = prompt(
      'Could not automatically extract guests.\n\n' +
      'Please open DevTools (F12), go to Network tab, find "getContacts" or similar request, ' +
      'copy the Response, and paste it here:'
    );
    
    if (apiResponse) {
      try {
        const data = JSON.parse(apiResponse);
        // Try common response shapes
        const guestArray = data.result?.data || data.data || data.guests || data;
        
        if (Array.isArray(guestArray)) {
          guests = guestArray.map(g => ({
            partiful_id: g.id || g.userId || g.guestId,
            name: g.name || g.displayName || 'Unknown',
            photo: g.photo || g.photoUrl || g.avatar,
            status: normalizeStatus(g.status || g.rsvpStatus || 'pending'),
            rsvp_timestamp: g.rsvpTimestamp || g.timestamp,
          }));
        }
      } catch (e) {
        alert('Could not parse the pasted data: ' + e.message);
        return;
      }
    }
  }
  
  function normalizeStatus(status) {
    const s = String(status).toLowerCase();
    if (s.includes('approv') || s === 'going' || s === 'yes') return 'approved';
    if (s.includes('pending') || s === 'maybe') return 'pending';
    if (s.includes('wait')) return 'waitlist';
    if (s.includes('reject') || s.includes('declin')) return 'rejected';
    if (s.includes('invite')) return 'invited';
    if (s.includes('cant') || s.includes("can't") || s === 'no') return 'cant_go';
    return 'pending';
  }
  
  if (guests.length === 0) {
    alert('No guests found. Please try again or manually import.');
    return;
  }
  
  console.log('[Cosign] Extracted guests:', guests);
  
  // Prompt for event_id in Cosign
  const eventId = prompt(
    `Found ${guests.length} guests!\n\n` +
    'Enter your Cosign event ID to import:'
  );
  
  if (!eventId) {
    // Just copy to clipboard instead
    const json = JSON.stringify(guests, null, 2);
    navigator.clipboard.writeText(json);
    alert(`Copied ${guests.length} guests to clipboard as JSON.\nPaste this in Cosign's import.`);
    return;
  }
  
  // Send to Cosign API
  try {
    const response = await fetch(COSIGN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, guests }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const result = await response.json();
    alert(`Success! Imported ${result.imported} guests to Cosign.`);
  } catch (e) {
    alert('Failed to import: ' + e.message + '\n\nGuests copied to clipboard instead.');
    navigator.clipboard.writeText(JSON.stringify(guests, null, 2));
  }
})();
