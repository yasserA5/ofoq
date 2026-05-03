import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://oieyzqthxaxffjgojwbp.supabase.co';
const SUPABASE_ANON_KEY = 'PUT_YOUR_ANON_KEY_HERE';

window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);