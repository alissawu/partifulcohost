-- Cosign Database Schema

-- Events table (links to Partiful events)
create table events (
  id uuid primary key default gen_random_uuid(),
  partiful_event_id text unique not null,
  name text not null,
  date timestamptz,
  access_code text unique not null, -- simple auth: hosts share this code
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Hosts table
create table hosts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  name text not null,
  email text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

create index hosts_event_id_idx on hosts(event_id);

-- Guests table (synced from Partiful)
create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade not null,
  partiful_id text not null,
  name text not null,
  photo text,
  partiful_status text not null, -- approved, pending, waitlist, rejected, invited, cant_go
  rsvp_timestamp timestamptz,
  is_flagged boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(event_id, partiful_id)
);

create index guests_event_id_idx on guests(event_id);
create index guests_partiful_status_idx on guests(partiful_status);

-- Votes table
create table votes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete cascade not null,
  host_id uuid references hosts(id) on delete cascade not null,
  vote text not null check (vote in ('keep', 'remove', 'unsure')),
  relationship text check (relationship in ('my_friend', 'friend_of_friend', 'acquaintance', 'dont_know')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(guest_id, host_id)
);

create index votes_guest_id_idx on votes(guest_id);
create index votes_host_id_idx on votes(host_id);

-- Comments table
create table comments (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references guests(id) on delete cascade not null,
  host_id uuid references hosts(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);

create index comments_guest_id_idx on comments(guest_id);

-- Partiful tokens (encrypted, for syncing)
create table partiful_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade unique not null,
  token_encrypted text not null, -- we'll encrypt the token
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- Function to update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at before update on events
  for each row execute function update_updated_at();

create trigger guests_updated_at before update on guests
  for each row execute function update_updated_at();

create trigger votes_updated_at before update on votes
  for each row execute function update_updated_at();

-- RLS policies
alter table events enable row level security;
alter table hosts enable row level security;
alter table guests enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;
alter table partiful_tokens enable row level security;

-- For now, we'll use service role key for all operations
-- In production, you'd add proper RLS policies based on access_code auth
