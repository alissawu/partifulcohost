-- Add user_id column to hosts table (links to auth.users)
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create unique constraint so one user can only join an event once
ALTER TABLE hosts ADD CONSTRAINT hosts_event_user_unique UNIQUE (event_id, user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hosts_user_id ON hosts(user_id);

-- User profiles table to store Partiful user IDs
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partiful_user_id TEXT UNIQUE,
  partiful_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up by Partiful ID
CREATE INDEX IF NOT EXISTS idx_user_profiles_partiful_id ON user_profiles(partiful_user_id);
