-- ============================================================
-- Posana Dashboard — Supabase Schema
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Profiles (extends auth.users with name + role)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'associate' CHECK (role IN ('admin', 'associate')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'associate');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name         TEXT NOT NULL,
  address            TEXT,
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  store_type         TEXT CHECK (store_type IN ('coffee_shop', 'gym_fitness', 'smoothie_shop', 'local_deli', 'specialty_grocer', 'other')),
  chain_type         TEXT CHECK (chain_type IN ('local', 'corporate_chain')),
  status             TEXT NOT NULL DEFAULT 'not_contacted'
                       CHECK (status IN ('not_contacted', 'in_contact', 'samples_shipped', 'actively_selling', 'declined')),
  sales_associate_id UUID REFERENCES public.profiles(id),
  contact_name       TEXT,
  contact_phone      TEXT,
  contact_email      TEXT,
  neighborhood       TEXT,
  chain_group        TEXT,
  notes              TEXT,
  last_contacted_date DATE,
  city               TEXT DEFAULT 'nyc', -- free text city slug; see components/types.ts CITY_META for known slugs
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all leads"
  ON public.leads FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Associates can insert leads"
  ON public.leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Associates can update their own leads"
  ON public.leads FOR UPDATE USING (
    sales_associate_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS leads_status_idx           ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_associate_idx        ON public.leads(sales_associate_id);
CREATE INDEX IF NOT EXISTS leads_city_idx             ON public.leads(city);
CREATE INDEX IF NOT EXISTS leads_store_type_idx       ON public.leads(store_type);
CREATE INDEX IF NOT EXISTS leads_chain_group_idx      ON public.leads(chain_group);
