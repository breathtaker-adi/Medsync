-- Migration to add created_at timestamp to pending_reviews
-- This migration adds a column with default now() for ordering reviews

ALTER TABLE public.pending_reviews
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Backfill existing rows (if any) with current timestamp
UPDATE public.pending_reviews SET created_at = timezone('utc'::text, now()) WHERE created_at IS NULL;
