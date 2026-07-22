-- ============================================================
-- Posana Dashboard — Migration: associate labels + unclaimed-store self-assign
-- Run this once in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Self-assignable free-text labels per associate (e.g. "Brooklyn gyms")
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';

-- Allow any authenticated associate to claim (self-assign) a currently-unassigned lead.
-- The existing "Associates can update their own leads" policy only covers rows already
-- assigned to them (sales_associate_id = auth.uid()), so claiming an unassigned row
-- (sales_associate_id IS NULL) needs its own policy. USING scopes which rows are
-- claimable (must currently be unassigned); WITH CHECK ensures you can only claim for
-- yourself, not hand it to someone else.
CREATE POLICY "Associates can claim unassigned leads"
  ON public.leads FOR UPDATE
  USING (sales_associate_id IS NULL)
  WITH CHECK (sales_associate_id = auth.uid());
