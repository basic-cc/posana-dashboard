import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — server-only, bypasses RLS. Never import this from client components.
export const createAdminClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
};
