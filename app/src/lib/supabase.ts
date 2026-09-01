import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Public client credentials (publishable key) — RLS serves only
// published + approved content to this client, the same view the
// mockup snapshot ships. Override via EXPO_PUBLIC_* env when rotating.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://amdvitzpogaejzzqroco.supabase.co';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_VVol99Jqs0QYzeVrmOawlw_ZpXqcv7B';

// Exported for the one caller that needs the address without the client:
// `lib/signup` asks GoTrue's public settings endpoint a question the
// client library has no method for. Same values, one source.
export const supabaseUrl = url;
export const supabaseAnonKey = key;

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // No web redirect flow in the app — sign-in is email OTP, so there is
    // never a session in a URL to detect.
    detectSessionInUrl: false,
  },
});
