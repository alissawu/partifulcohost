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

**No public API:** Partiful has no public API and no OAuth. To get guest data with real names (not redacted like "Axxxxx Wx"), you need to be authenticated as a host. We built a console command that hosts run on partiful.com - it extracts their Firebase auth token from IndexedDB and sends it to our app. The token is used immediately while fresh to sync the full guest list.

**Host verification:** We verify someone is actually a host by checking their Partiful user ID against the event's ownerIds. The console command captures both their identity and their auth in one step.

**Firestore reverse-engineering:** Partiful stores data in Firebase/Firestore with a nested document format. We had to figure out their schema by inspecting network requests - fields like `stringValue`, `mapValue`, `arrayValue` all need recursive extraction. Status strings are also inconsistent (`PENDING_APPROVAL`, `NOT_APPROVED`, `GOING`, etc.) so we normalize everything.

**Photo extraction:** Guest photos aren't included in the basic guest list response. We call a separate `getUsers` endpoint with the host's auth token to fetch photos for all guests, then merge them with the guest data.

**getGuests quirks:** The `getGuests` endpoint has weird behavior - calling it while authenticated as a host returns a "User is host" error. We work around this by using the Firestore subscription data that hosts already have access to, or by calling getUsers which doesn't have this restriction.
