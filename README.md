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
- `/app/api/sync/partiful` - syncs guests from Partiful's Firestore
- `/app/api/events` - CRUD for events and access codes
- `/app/api/votes` - co-host voting system
- `/app/api/comments` - per-guest discussion threads

## Hacky Workarounds

**No public API:** Partiful has no public API and no OAuth. We can't just "log in with Partiful" - so we use a bookmarklet that runs in the host's browser while they're already logged into Partiful. The bookmarklet grabs their session context and sends guest data to our app. No credential handling on our side.

**Firestore reverse-engineering:** Partiful stores data in Firebase/Firestore with a nested document format. We had to figure out their schema by inspecting network requests - fields like `stringValue`, `mapValue`, `arrayValue` all need recursive extraction. Status strings are also inconsistent (`PENDING_APPROVAL`, `NOT_APPROVED`, `GOING`, etc.) so we normalize everything.

**Public guest API:** We discovered their `getGuests` endpoint works without auth for public events and returns ALL statuses - pending, approved, waitlist, rejected. So we only need the bookmarklet once to verify someone is actually a host (checking their user_id against the event's ownerIds). After that, guest syncing works unauthenticated.

**Photo extraction:** Guest photos come from different places depending on RSVP status. For approved guests, the public API has photos. For pending/invited guests, we fall back to the `getUsers` endpoint which requires the host session.
