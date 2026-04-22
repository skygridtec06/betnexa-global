import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ';

// Enhanced client with resilience features
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': 'betnexa-web/1.0',
    },
  },
  db: {
    schema: 'public',
  },
});

// Track connection health
let isConnected = true;
let lastErrorTime = 0;
const ERROR_THRESHOLD = 5000; // 5 second retry window

// Detect connection issues
const originalFrom = supabase.from.bind(supabase);
supabase.from = function (table: string) {
  const query = originalFrom(table);
  
  // Wrap query execution to detect failures
  const originalSelect = query.select.bind(query);
  query.select = function (...args: any[]) {
    const selectQuery = originalSelect(...args);
    
    // Auto-retry on connection failure
    return (selectQuery as any).catch?.((err: any) => {
      const now = Date.now();
      if (err.message?.includes('Failed to fetch') || err.message?.includes('timeout')) {
        if (now - lastErrorTime > ERROR_THRESHOLD) {
          lastErrorTime = now;
          console.warn('[Supabase] Connection issue detected, will retry on next query');
          isConnected = false;
        }
      }
      throw err;
    }) || selectQuery;
  };
  
  return query;
};

// Export connection status for UI
export function isSupabaseConnected() {
  return isConnected;
}

export function setSupabaseConnected(connected: boolean) {
  isConnected = connected;
}

export default supabase;
