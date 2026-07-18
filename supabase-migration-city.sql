-- ============================================================
-- Posana Dashboard — Migration: allow arbitrary cities
-- Run this once in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

ALTER TABLE public.leads DROP CONSTRAINT leads_city_check;
