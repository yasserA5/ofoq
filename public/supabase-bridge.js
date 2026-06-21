import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://guiecvmmidrxbsqpynva.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0EOBo2pc3kXzLiE4r92fGA_PqTX3pBV";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

window.sb = { supabase };

export { supabase };
export default supabase;