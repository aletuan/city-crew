import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Public client credentials (publishable key) — RLS serves only
// published + approved content to this client, the same view the
// mockup snapshot ships. Override via EXPO_PUBLIC_* env when rotating.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://amdvitzpogaejzzqroco.supabase.co';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_VVol99Jqs0QYzeVrmOawlw_ZpXqcv7B';

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
