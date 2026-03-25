import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
