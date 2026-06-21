import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://guiecvmmidrxbsqpynva.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0EOBo2pc3kXzLiE4r92fGA_PqTX3pBV";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);