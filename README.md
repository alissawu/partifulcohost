# Partiful Cohost

Multi-host guest vetting for Partiful events. When you're throwing a party with co-hosts, everyone needs to weigh in on who to approve - but Partiful doesn't have collaborative approval features. This app syncs your guest list and lets co-hosts vote, flag, and comment on guests before you make decisions.

## Setup

```bash
git clone https://github.com/alissawu/partifulcohost.git
cd partifulcohost
bun install
cp .env.example .env
# fill in your Supabase credentials
bun dev
```

**Supabase setup:**
1. Create a project at supabase.com
2. Run the SQL in `src/lib/supabase/schema.sql` and `supabase-schema-v2.sql`
3. Go to Authentication > Providers > Email and disable "Confirm email"
4. Copy your project URL and keys to `.env`

## Technical Notes

- Next.js 16 + React 19 + TypeScript
- Supabase for auth and database
- Zustand for client state
- Tailwind 4 for styling

**Architecture:**
- `/app/api/sync/partiful` - syncs guests from Partiful using host's auth token
- `/app/api/events` - CRUD for events and access codes
- `/app/api/votes` - co-host voting system
- `/app/api/comments` - per-guest discussion threads

## Hacky Workarounds

**No public API:** Partiful has no public API and no OAuth. To get guest data with real names (not redacted like "Axxxxx Wx"), you need to be authenticated as a host. We built a console command (a one-liner that extracts Firebase auth token from IndexedDB) that hosts run in devtools on partiful.com. The command redirects them back to our app with the token, which we use immediately while fresh to query the Firestore REST API for full guest data.

**Host verification:** We verify someone is actually a host by checking their Partiful user ID against the event's ownerIds. The console command captures both their identity and auth in one step.

**Firestore REST API:** The main data source is Partiful's Firestore database, accessed via REST API with the host's Firebase token. The endpoint is `firestore.googleapis.com/v1/projects/getpartiful/databases/(default)/documents/events/{eventId}/guests`. Firestore uses a nested document format where every value is wrapped in type objects (`stringValue`, `mapValue`, `arrayValue`, etc.) that we recursively extract. Status strings are also inconsistent (`PENDING_APPROVAL`, `NOT_APPROVED`, `GOING`, etc.) so we normalize everything.

**Fallback for no token:** If we don't have a host's token, we fall back to the public `getGuests` API. This returns redacted names ("Axxxxx Wx") and only approved guests, but it's better than nothing.

**Photo extraction:** Guest photos aren't included in the Firestore guest documents. We call a separate `getUsers` endpoint with the host's auth token to fetch photos for all guests, then merge them with the guest data.

**getGuests quirks:** The public `getGuests` endpoint has weird behavior - calling it while authenticated as a host returns a "User is host" error. That's why we use Firestore REST API directly instead.

**Note:** There's a `bookmarklet.js` file in public/ from early prototyping - we ended up using a simpler console command instead.
