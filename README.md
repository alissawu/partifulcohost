# Cosign

Multi-host guest vetting for Partiful events. Coordinate with your co-hosts on who to approve.

## Setup

```bash
git clone https://github.com/alissawu/partifulcosign.git
cd partifulcosign
bun install
cp .env.example .env
# fill in your Supabase credentials in .env
bun dev
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL in `src/lib/supabase/schema.sql` and `supabase-schema-v2.sql`
3. Go to Authentication > Providers > Email and disable "Confirm email"
4. Copy your project URL and keys to `.env`

## How it works

1. Sign up with email + password
2. Link your Partiful account (one-time console command)
3. Create an event or join with access code
4. Only verified Partiful hosts can join
5. Vote on guests, flag for review, leave comments
